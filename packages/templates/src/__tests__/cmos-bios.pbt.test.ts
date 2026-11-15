import * as fc from "fast-check";
import JSZip from "jszip";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSONUIProvider } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { afterEach, describe, expect, it } from "vitest";
import { SafeGenUIRenderer, createGuardrailedStreamCompiler, wrapRegistryWithTelemetry } from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { buildChaosPackets, buildRemixJsonl, initialPageSpecs, verifiedCatalog } from "../cmos-cloud-bios/catalog.js";
import { templateComponents } from "../cmos-cloud-bios/components/index.js";
import { applyCmosRegisterPacket } from "../cmos-cloud-bios/components/CmosRegisterPacket.js";
import { getCmosStore, resetCmosStoreForTests, setCmosUi } from "../cmos-cloud-bios/components/cmos-store.js";
import {
  BIOS_DEFAULTS,
  CMOS_PRESETS,
  CACHE_TIERS,
  CPU_MULTIPLIERS,
  DRIVE_CAPACITIES_GB,
  DRIVE_TYPES,
  ECC_MODES,
  FSB_CLOCKS_MHZ,
  IRQ_LINES,
  PCI_CLOCKS_MHZ,
  PCI_DEVICES,
  PEAK_FACTORS,
  POWER_MODES,
  RAID_MODES,
  STANDBY_TIMERS_MIN,
  SYSTEM_RAM_MB,
  THROTTLE_TEMPS_C,
  TIME_ZONES,
  VECTOR_MODES,
  WATCHDOG_TIMEOUTS_SEC,
  cmosChecksum,
  deriveCloudTopology,
  simulateCmos,
  type CmosConfig,
} from "../cmos-cloud-bios/lib/cmos/engine.js";
import {
  compileCmos,
  compileToDockerCompose,
  compileToTerraform,
  compileToVercelJson,
} from "../cmos-cloud-bios/lib/cmos/compiler.js";
import { generateTemplateZip } from "../exporter.js";
import { getTemplateBySlug } from "../registry.js";

const NUM_RUNS_COMPILE = 500;

/* ═══════════════════════════ Arbitraries ═══════════════════════════ */

const slotArb = fc.record({
  device: fc.constantFrom(...PCI_DEVICES),
  irq: fc.oneof(fc.constant("auto" as const), fc.constantFrom(...IRQ_LINES)),
});

const storageArb = fc
  .record({
    primaryMaster: fc.constantFrom(...DRIVE_TYPES),
    capacityGb: fc.constantFrom(...DRIVE_CAPACITIES_GB),
    raid: fc.constantFrom(...RAID_MODES),
    primarySlave: fc.constantFrom(...VECTOR_MODES),
    secondaryMaster: fc.constantFrom(...CACHE_TIERS),
  })
  .map((s) => (s.primaryMaster === "none" ? { ...s, raid: "none" as const, primarySlave: "none" as const } : s));

const configArb: fc.Arbitrary<CmosConfig> = fc.record({
  standard: fc.record({ timeZone: fc.constantFrom(...TIME_ZONES) }),
  cpu: fc.record({
    fsbMhz: fc.constantFrom(...FSB_CLOCKS_MHZ),
    multiplier: fc.constantFrom(...CPU_MULTIPLIERS),
    coreVoltageMv: fc.integer({ min: 0, max: 16 }).map((i) => 2800 + i * 50),
  }),
  memory: fc.record({ systemRamMb: fc.constantFrom(...SYSTEM_RAM_MB), ecc: fc.constantFrom(...ECC_MODES) }),
  storage: storageArb,
  bus: fc.record({
    pciClockMhz: fc.constantFrom(...PCI_CLOCKS_MHZ),
    slots: fc.tuple(slotArb, slotArb, slotArb, slotArb).map((t) => [...t]),
  }),
  power: fc.record({
    mode: fc.constantFrom(...POWER_MODES),
    standbyMin: fc.constantFrom(...STANDBY_TIMERS_MIN),
    watchdogSec: fc.constantFrom(...WATCHDOG_TIMEOUTS_SEC),
    budgetCapUsd: fc.integer({ min: 1, max: 2000 }).map((i) => i * 25),
  }),
  health: fc.record({
    fanRpm: fc.integer({ min: 12, max: 60 }).map((i) => i * 100),
    throttleC: fc.constantFrom(...THROTTLE_TEMPS_C),
  }),
  workload: fc.record({
    averageRps: fc.integer({ min: 1, max: 50000 }),
    peakFactor: fc.constantFrom(...PEAK_FACTORS),
  }),
});

/* ═══════════════════════════ Strict YAML-subset reader ═══════════════════════════ */

type Yaml = string | number | boolean | null | Yaml[] | { [key: string]: Yaml };

/**
 * Parses the YAML subset the compiler emits and rejects anything outside it: tabs, unquoted
 * strings, duplicate keys and inconsistent indentation. Full YAML parsers accept a superset of
 * this grammar, so anything this reader accepts is valid YAML.
 */
function parseYamlSubset(text: string): Yaml {
  if (text.includes("\t")) throw new Error("Tabs are not allowed in YAML indentation");
  const lines = text.split("\n");
  let i = 0;
  const KEY = /^("(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_.\-]*):(?: (.*))?$/;
  const indentOf = (line: string) => line.length - line.trimStart().length;
  const skip = () => {
    while (i < lines.length && (lines[i]!.trim() === "" || lines[i]!.trimStart().startsWith("#"))) i++;
  };
  const scalar = (raw: string): Yaml => {
    if (raw === "[]") return [];
    if (raw === "{}") return {};
    if (raw === "null") return null;
    if (raw === "true" || raw === "false") return raw === "true";
    if (raw.startsWith('"')) return JSON.parse(raw) as string;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    throw new Error(`Unquoted scalar: ${raw}`);
  };

  function parseNode(indent: number): Yaml {
    skip();
    const line = lines[i];
    if (line === undefined || indentOf(line) < indent) return {};
    if (indentOf(line) !== indent) throw new Error(`Bad indent at line ${i + 1}`);
    return line.slice(indent).startsWith("- ") ? parseList(indent) : parseMap(indent);
  }

  function parseMap(indent: number): { [key: string]: Yaml } {
    const out: { [key: string]: Yaml } = {};
    for (;;) {
      skip();
      const line = lines[i];
      if (line === undefined || indentOf(line) < indent) return out;
      if (indentOf(line) > indent) throw new Error(`Bad indent at line ${i + 1}`);
      const body = line.slice(indent);
      if (body.startsWith("- ")) return out;
      const match = KEY.exec(body);
      if (!match) throw new Error(`Not a mapping entry at line ${i + 1}: ${body}`);
      const key = match[1]!.startsWith('"') ? (JSON.parse(match[1]!) as string) : match[1]!;
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new Error(`Duplicate key ${key}`);
      const rest = match[2];
      i++;
      if (rest === undefined) {
        out[key] = parseNode(indent + 2);
      } else if (rest === "|") {
        const block: string[] = [];
        while (i < lines.length && (lines[i] === "" || indentOf(lines[i]!) >= indent + 2)) {
          block.push(lines[i]!.slice(indent + 2));
          i++;
        }
        out[key] = `${block.join("\n").replace(/\n+$/, "")}\n`;
      } else {
        out[key] = scalar(rest);
      }
    }
  }

  function parseList(indent: number): Yaml[] {
    const out: Yaml[] = [];
    for (;;) {
      skip();
      const line = lines[i];
      if (line === undefined || indentOf(line) !== indent || !line.slice(indent).startsWith("- ")) return out;
      const rest = line.slice(indent + 2);
      if (KEY.test(rest) || /^[A-Za-z_][A-Za-z0-9_.\-]*:$/.test(rest)) {
        lines[i] = `${" ".repeat(indent + 2)}${rest}`;
        out.push(parseMap(indent + 2));
      } else {
        out.push(scalar(rest));
        i++;
      }
    }
  }

  const doc = parseMap(0);
  skip();
  if (i < lines.length) throw new Error(`Unparsed content at line ${i + 1}`);
  return doc;
}

const asMap = (value: Yaml | undefined): { [key: string]: Yaml } =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};

/* ═══════════════════════════ Rendering helpers ═══════════════════════════ */

const safeRegistry = wrapRegistryWithTelemetry(verifiedCatalog, templateComponents);

function renderSpec(spec: Spec, healedDiagnostics?: unknown): string {
  return renderToStaticMarkup(
    React.createElement(
      JSONUIProvider,
      { registry: safeRegistry, initialState: {}, children: null },
      React.createElement(SafeGenUIRenderer, {
        spec,
        registry: safeRegistry,
        catalog: verifiedCatalog,
        healedDiagnostics: healedDiagnostics as never,
      }),
    ),
  );
}

afterEach(() => {
  resetCmosStoreForTests();
});

/* ═══════════════════════════ Properties ═══════════════════════════ */

describe("BIOS // NECROMANCER: fast-check property suite", () => {
  it(`Property 1: IaC compilation is valid, parseable and deterministic across ${NUM_RUNS_COMPILE} random register sets`, () => {
    fc.assert(
      fc.property(configArb, (config) => {
        const topology = deriveCloudTopology(config);
        const telemetry = simulateCmos(config, topology);

        // docker-compose.yml
        const composeText = compileToDockerCompose(topology, telemetry, "cmos-fuzz");
        expect(compileToDockerCompose(topology, telemetry, "cmos-fuzz")).toBe(composeText);
        const compose = asMap(parseYamlSubset(composeText));
        const services = asMap(compose.services);
        const networks = asMap(compose.networks);
        const volumes = asMap(compose.volumes);
        const configs = asMap(compose.configs);
        expect(Object.keys(services)).toContain("app");
        for (const [name, raw] of Object.entries(services)) {
          const service = asMap(raw);
          expect(typeof service.image, `${name}.image`).toBe("string");
          const deploy = asMap(service.deploy);
          const limits = asMap(asMap(deploy.resources).limits);
          expect(Number(limits.cpus), `${name} cpus`).toBeGreaterThan(0);
          expect(String(limits.memory), `${name} memory`).toMatch(/^[1-9]\d*M$/);
          if (deploy.replicas !== undefined) expect(Number(deploy.replicas)).toBeGreaterThanOrEqual(1);
          for (const net of (service.networks as Yaml[] | undefined) ?? []) expect(Object.keys(networks)).toContain(net);
          for (const dep of Object.keys(asMap(service.depends_on))) expect(Object.keys(services)).toContain(dep);
          for (const mount of (service.volumes as Yaml[] | undefined) ?? []) {
            const source = String(mount).split(":")[0]!;
            if (!source.startsWith("/")) expect(Object.keys(volumes)).toContain(source);
          }
          for (const cfg of (service.configs as Yaml[] | undefined) ?? []) {
            expect(Object.keys(configs)).toContain(String(asMap(cfg).source));
          }
          // Secrets only ever come from .env interpolation.
          for (const [key, value] of Object.entries(asMap(service.environment))) {
            if (/PASSWORD/.test(key)) expect(String(value)).toMatch(/^\$\{[A-Z_]+:\?/);
          }
        }

        // vercel.json
        const vercelText = compileToVercelJson(topology);
        const vercel = JSON.parse(vercelText) as {
          fluid: boolean;
          regions: string[];
          functions: Record<string, { maxDuration: number; memory?: number }>;
        };
        expect(vercel.fluid).toBe(true);
        expect(vercel.regions).toHaveLength(1);
        expect(vercel.regions[0]).toMatch(/^[a-z]{3}\d$/);
        for (const fn of Object.values(vercel.functions)) {
          expect(Number.isInteger(fn.maxDuration)).toBe(true);
          expect(fn.maxDuration).toBeGreaterThanOrEqual(1);
          expect(fn.maxDuration).toBeLessThanOrEqual(300);
          expect(fn.memory).toBeUndefined();
        }

        // main.tf
        const tf = compileToTerraform(topology, telemetry, "cmos-fuzz");
        expect(tf.split("{").length).toBe(tf.split("}").length);
        expect(tf.split("[").length).toBe(tf.split("]").length);
        const resources = [...tf.matchAll(/^resource "([^"]+)" "([^"]+)"/gm)].map((m) => `${m[1]}.${m[2]}`);
        expect(new Set(resources).size).toBe(resources.length);
        expect(tf).toContain(`CMOS checksum ${cmosChecksum(config)}`);

        // Simulator outputs stay finite and in range.
        expect(Number.isFinite(telemetry.monthlyCostUsd)).toBe(true);
        expect(telemetry.monthlyCostUsd).toBeGreaterThan(0);
        expect(telemetry.stabilityPct).toBeGreaterThanOrEqual(0);
        expect(telemetry.stabilityPct).toBeLessThanOrEqual(100);
        expect(telemetry.maxRps).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS_COMPILE },
    );
  }, 60_000);

  it("Property 2: raising the CPU multiplier or the replica count never lowers power draw or cost", () => {
    fc.assert(
      fc.property(configArb, (config) => {
        // Multiplier sweep: rated power and per-instance price never drop.
        let previousPower = -Infinity;
        let previousInstancePrice = -Infinity;
        for (const multiplier of CPU_MULTIPLIERS) {
          const next = { ...config, cpu: { ...config.cpu, multiplier } };
          const telemetry = simulateCmos(next);
          const topology = deriveCloudTopology(next);
          expect(telemetry.powerDrawW).toBeGreaterThanOrEqual(previousPower);
          expect(topology.compute.instanceHourlyUsd).toBeGreaterThanOrEqual(previousInstancePrice);
          previousPower = telemetry.powerDrawW;
          previousInstancePrice = topology.compute.instanceHourlyUsd;
        }

        // Replica sweep (0 -> 1 -> 2 -> 3 read replicas): monthly burn never drops.
        const withDrive: CmosConfig = {
          ...config,
          storage: { ...config.storage, primaryMaster: config.storage.primaryMaster === "none" ? "ide-hdd" : config.storage.primaryMaster },
        };
        let previousCost = -Infinity;
        let previousRatedPower = -Infinity;
        for (const raid of ["none", "raid1", "raid5", "raid10"] as const) {
          const telemetry = simulateCmos({ ...withDrive, storage: { ...withDrive.storage, raid } });
          expect(telemetry.monthlyCostUsd).toBeGreaterThanOrEqual(previousCost);
          expect(telemetry.powerDrawW).toBeGreaterThanOrEqual(previousRatedPower);
          previousCost = telemetry.monthlyCostUsd;
          previousRatedPower = telemetry.powerDrawW;
        }
      }),
      { numRuns: 300 },
    );
  }, 60_000);

  it("Property 3: every catalog component survives adversarial props without crashing the tree", () => {
    const report = runCatalogInvariantSuite(verifiedCatalog, { numRuns: 20 });
    expect(report.allPassed).toBe(true);

    const componentNames = Object.keys(verifiedCatalog.catalog.data.components);
    const junk = fc.oneof(
      fc.string({ maxLength: 40 }),
      fc.integer(),
      fc.double(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.oneof(fc.integer(), fc.string({ maxLength: 8 })), { maxLength: 6 }),
      fc.constantFrom("__proto__", "<script>alert(1)</script>", "javascript:alert(1)"),
    );
    fc.assert(
      fc.property(fc.constantFrom(...componentNames), fc.dictionary(fc.string({ maxLength: 16 }), junk, { maxKeys: 8 }), (type, props) => {
        resetCmosStoreForTests();
        const base = initialPageSpecs.home!;
        const shell = base.elements["cmos-shell"]!;
        const spec: Spec = {
          ...base,
          elements: {
            ...base.elements,
            "cmos-shell": { ...shell, children: [...(shell.children ?? []), "fuzzed"] },
            fuzzed: { type, props, children: [] },
          },
        };
        // Direct render: SafeGenUIRenderer isolates the bad element.
        expect(() => renderSpec(spec)).not.toThrow();
        // Streamed render: the guardrailed compiler heals props before mount.
        const compiler = createGuardrailedStreamCompiler({ catalog: verifiedCatalog });
        compiler.push(`${JSON.stringify({ op: "add", path: "/root", value: spec.root })}\n`);
        for (const [key, element] of Object.entries(spec.elements)) {
          compiler.push(`${JSON.stringify({ op: "add", path: `/elements/${key}`, value: element })}\n`);
        }
        const finalized = compiler.finalize();
        const html = renderSpec(finalized.spec, finalized.healedDiagnostics);
        expect(html).toContain('data-testid="cmos-workstation"');
        expect(html).not.toContain("<script>");
      }),
      { numRuns: 60 },
    );
  }, 60_000);
});

describe("BIOS // NECROMANCER: remix presets, fail-safe recovery, SSR and export", () => {
  it("streams the overclock and undervolt presets into the shell boot preset", () => {
    for (const [prompt, preset] of [
      ["Stream Preset: AI Agent Cluster Overclock (Max GPU PCIe + High Memory Bus)", "overclock"],
      ["Stream Preset: Zero-Cost Indie Hacker Undervolt (Strict FinOps Spend Cap)", "undervolt"],
    ] as const) {
      const compiler = createGuardrailedStreamCompiler({ catalog: verifiedCatalog });
      compiler.push(buildRemixJsonl(prompt, initialPageSpecs.home!));
      const finalized = compiler.finalize();
      expect(finalized.issues).toHaveLength(0);
      expect((finalized.spec.elements["cmos-shell"]?.props as Record<string, unknown>).bootPreset).toBe(preset);
    }
    // Every built-in preset passes POST and compiles.
    for (const preset of ["bios", "setup", "overclock", "undervolt"] as const) {
      const config = CMOS_PRESETS[preset];
      expect(simulateCmos(config).post.passed, `${preset} POST`).toBe(true);
      expect(compileCmos(config).artifacts).toHaveLength(3);
    }
  });

  it("heals the corrupted voltage / negative IRQ packet and loads fail-safe BIOS defaults", () => {
    const compiler = createGuardrailedStreamCompiler({ catalog: verifiedCatalog });
    compiler.push(buildRemixJsonl("Inject Corrupted Voltage / Negative IRQ Packet", initialPageSpecs.home!));
    const finalized = compiler.finalize();
    const packet = finalized.spec.elements["chaos-packet"]?.props as {
      packetId: string;
      coreVoltageMv: number;
      multiplier: number;
      irqSlot1: number;
      irqSlot2: number;
    };
    expect(finalized.issues).toHaveLength(0);
    expect(finalized.healedDiagnostics["chaos-packet"]?.map((d) => d.propName).sort()).toEqual(
      ["coreVoltageMv", "irqSlot1", "irqSlot2", "multiplier"],
    );
    expect(packet.coreVoltageMv).toBe(2000);
    expect(packet.irqSlot1).toBe(0);
    expect(packet.irqSlot2).toBe(15);

    // The clamped packet is still off the CMOS register grid, so the BIOS recovers.
    const outcome = applyCmosRegisterPacket(packet);
    expect(outcome.applied).toBe(false);
    expect(outcome.notice).toContain("FAIL-SAFE BIOS DEFAULTS LOADED");
    expect(cmosChecksum(getCmosStore().getState().draft)).toBe(cmosChecksum(BIOS_DEFAULTS));

    // The tree still renders with the healed packet mounted.
    const html = renderSpec(finalized.spec, finalized.healedDiagnostics);
    expect(html).toContain('data-testid="cmos-workstation"');

    // The X-Ray chaos packets heal the same way.
    const chaos = createGuardrailedStreamCompiler({ catalog: verifiedCatalog });
    chaos.push(buildRemixJsonl("", initialPageSpecs.home!));
    const step = chaos.push(`${buildChaosPackets("cmos-shell").join("\n")}\n`);
    expect(step.healedDiagnostics["chaos-packet"]).toBeDefined();
  });

  it("server-renders the POST screen in setup mode and every landing module in landing mode", () => {
    const setupHtml = renderSpec(initialPageSpecs.home!);
    expect(setupHtml).toContain('data-testid="cmos-post-screen"');
    expect(setupHtml).toContain("Press DEL or Click to Enter SETUP // Press SPACE to Skip");
    expect(setupHtml).toContain('data-testid="cmos-motherboard-twin"');

    getCmosStore().getState().dispatch({ type: "ENTER_SETUP" });
    const biosHtml = renderSpec(initialPageSpecs.home!);
    expect(biosHtml).toContain('data-testid="cmos-bios-utility"');
    expect(biosHtml).toContain("STANDARD CLOUD CMOS FEATURES");

    setCmosUi({ mode: "landing" });
    const landingHtml = renderSpec(initialPageSpecs.home!);
    for (const id of ["cmos-landing-hero", "cmos-iac-panel", "cmos-modem-panel", "cmos-telemetry-monitor", "cmos-bios-utility"]) {
      expect(landingHtml).toContain(`data-testid="${id}"`);
    }
    expect(landingHtml).toContain("npx genui-studio add cmos-cloud-bios");
  });

  it("is registered in the marketplace and exports SKILL.md and POWER.md in the .zip", async () => {
    const entry = getTemplateBySlug("cmos-cloud-bios");
    expect(entry).toBeDefined();
    expect(entry!.manifest.title).toBe("BIOS // NECROMANCER — 1994 CMOS Utility & 3D Motherboard Cloud Compiler");
    expect(entry!.manifest.license).toBe("MIT");
    const zip = await JSZip.loadAsync(await generateTemplateZip(entry!));
    const paths = Object.keys(zip.files);
    expect(paths).toContain("SKILL.md");
    expect(paths).toContain(".kiro/powers/cmos-cloud-bios/POWER.md");
    expect(paths.some((p) => p.endsWith("lib/cmos/compiler.ts"))).toBe(true);
  });
});
