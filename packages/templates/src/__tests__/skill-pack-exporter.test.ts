import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { afterAll, describe, expect, it } from "vitest";
import type { Spec } from "@json-render/core";
import type { CreativeBrief } from "@genui-studio/core";
import {
  buildSkillPack,
  generateSkillPackZip,
  generateTemplateZip,
  getTemplateBySlug,
  readBehavioralSpecSource,
  showcasePreviewCatalog,
  skillPackInputFromTemplate,
  WIREFRAME_SPEC_EXPORT_PATH,
  type SkillPackInput,
} from "../index.js";

// ---------------------------------------------------------------------------
// Fixture: a small playable behavioral spec on the showcase catalog
// ---------------------------------------------------------------------------

const CONSTRAINTS = [
  {
    id: "C-API-1",
    category: "backend-api",
    sourceSection: "## Backend",
    requirement:
      "POST /api/vault/unlock must verify the HMAC-signed session token before returning 200.",
  },
  {
    id: "C-DB-1",
    category: "database",
    sourceSection: "## Data model",
    requirement:
      "Store unlock attempts in Postgres table vault_attempts(id uuid primary key, user_id uuid not null, created_at timestamptz).",
  },
] as const;

// The title exercises code generation: quotes, backticks, a block-comment terminator
// and U+2028 must not break the generated TypeScript.
const HOSTILE_TITLE = 'Signal "Relay" Vault */ `x`\u2028end';

const brief: CreativeBrief = {
  title: HOSTILE_TITLE,
  slug: "Signal Relay Vault!",
  inputMode: "master-prompt",
  promptSummary: "Charge the relay, arm the vault and open it before the signal drains.",
  elevatorPitch: "A tactile vault puzzle: charge, arm, open before the signal dies.",
  aestheticDirection: "Dark control room, amber indicators, chunky switches.",
  coreLoop: "Click the hero to charge, click the metrics to arm, press Enter to open.",
  winCondition: "Open the vault.",
  loseCondition: "The signal reaches zero.",
  targetStack: "Next.js 15, React 19",
  scenes: ["main", "vault"],
  preservedConstraints: [...CONSTRAINTS],
};

const spec: Spec = {
  root: "shell",
  state: { vault: { charge: 0, armed: false }, signal: 3 },
  elements: {
    shell: {
      type: "SiteShell",
      props: { brandName: "Relay", tagline: "Keep the signal alive", badge: "LIVE", layoutDensity: "compact" },
      children: ["hero", "metrics", "features"],
    },
    hero: {
      type: "HeroSection",
      props: { eyebrow: "Step 1", headline: "Charge the relay", summary: "Click three times.", primaryCta: "Charge", secondaryCta: null },
      children: [],
    },
    metrics: {
      type: "MetricStrip",
      props: { heading: "Vault", primaryValue: "0", primaryLabel: "Charge", secondaryValue: "3", secondaryLabel: "Signal", uptimePercent: 140 },
      children: [],
    },
    features: {
      type: "FeatureGrid",
      props: { sectionTitle: "Rules", columns: 2, items: [{ title: "Arm", detail: "Needs full charge." }] },
      children: [],
    },
  },
};

const rules: unknown[] = [
  {
    id: "charge-relay",
    label: "Charge the relay",
    sourceSection: "## Core loop",
    trigger: { type: "onClick", elementKey: "hero" },
    effects: [
      { type: "inc", path: "/vault/charge", by: 1, max: 3 },
      { type: "playSynthSound", cue: "click" },
    ],
  },
  {
    id: "arm-vault",
    label: "Arm the vault",
    sourceSection: "## Core loop",
    trigger: { type: "onClick", elementKey: "metrics" },
    guards: [{ op: "gte", path: "/vault/charge", value: 3 }],
    effects: [{ type: "set", path: "/vault/armed", value: true }],
  },
  {
    id: "open-vault",
    label: "Open the vault",
    sourceSection: "## Win condition",
    trigger: { type: "onKeyPress", key: "Enter" },
    guards: [{ op: "truthy", path: "/vault/armed" }],
    effects: [
      { type: "navigateScene", sceneId: "vault" },
      { type: "setOutcome", outcome: "win", reason: "Vault opened" },
    ],
  },
  {
    id: "drain-signal",
    label: "Signal drains",
    sourceSection: "## Timer",
    trigger: { type: "onTimerTick", timerId: "drain", intervalMs: 1000 },
    effects: [{ type: "dec", path: "/signal", by: 1, min: 0 }],
  },
  {
    id: "signal-lost",
    label: "Signal lost",
    sourceSection: "## Lose condition",
    once: true,
    trigger: { type: "onStateMatch" },
    guards: [{ op: "lte", path: "/signal", value: 0 }],
    effects: [{ type: "setOutcome", outcome: "lose", reason: "Signal lost" }],
  },
  {
    id: "bonus-relay",
    label: "Bonus relay",
    sourceSection: "## Stretch goals",
    trigger: { type: "onEvent", eventName: "never-emitted" },
    effects: [{ type: "set", path: "/bonus", value: true }],
  },
  // Hostile rules: both must be dropped by sanitizeInteractionRules.
  {
    id: "pollute",
    label: "Pollute",
    trigger: { type: "onClick", elementKey: "hero" },
    effects: [{ type: "set", path: "/__proto__/polluted", value: true }],
  },
  { id: "broken", label: "Broken", trigger: { type: "onTeleport" }, effects: [] },
];

const input: SkillPackInput = {
  brief,
  spec,
  rules,
  catalog: showcasePreviewCatalog,
  excalidrawJson: JSON.stringify({ type: "excalidraw", version: 2, elements: [] }),
};

const SLUG = "signal-relay-vault";

// ---------------------------------------------------------------------------
// Running an extracted pack with a child Vitest process
// ---------------------------------------------------------------------------

// `.temp` is in Vitest's default exclude list, so a leftover pack is never collected by
// this package's own test run. Node resolution from here reaches packages/templates/node_modules.
const PACK_ROOT = fileURLToPath(new URL("../../.temp/", import.meta.url));
const runDir = path.join(PACK_ROOT, `skill-pack-${process.pid}-${Date.now()}`);
const require = createRequire(import.meta.url);
const VITEST_ENTRY = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");

afterAll(() => {
  fs.rmSync(runDir, { recursive: true, force: true });
  if (fs.existsSync(PACK_ROOT) && fs.readdirSync(PACK_ROOT).length === 0) {
    fs.rmdirSync(PACK_ROOT);
  }
});

async function extractZip(bytes: Uint8Array, dir: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes);
  const written: string[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const target = path.resolve(dir, entry.name);
    expect(target.startsWith(path.resolve(dir) + path.sep)).toBe(true);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async("string"));
    written.push(entry.name);
  }
  return written.sort();
}

function runContract(dir: string, target: "reference" | "production") {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("VITEST") && key !== "TEST" && key !== "NODE_ENV") env[key] = value;
  }
  env.GENUI_DRIVER_TARGET = target;
  env.NO_COLOR = "1";
  const result = spawnSync(
    process.execPath,
    [VITEST_ENTRY, "run", "--root", dir, "--reporter=verbose", "contracts/invariants.pbt.test.ts"],
    { cwd: dir, env, encoding: "utf8", timeout: 120_000 },
  );
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Universal Agent Skill & Contract Pack exporter", () => {
  const pack = buildSkillPack(input);

  it("writes the documented file layout under a path-safe slug", () => {
    expect(pack.slug).toBe(SLUG);
    expect(Object.keys(pack.files).sort()).toEqual(
      [
        "SKILL.md",
        "AGENTS.md",
        `.kiro/specs/${SLUG}/requirements.md`,
        `.kiro/specs/${SLUG}/design.md`,
        `.kiro/specs/${SLUG}/tasks.md`,
        ".kiro/steering/visual-intent.md",
        ".cursor/rules/genui-spec.mdc",
        "contracts/app-driver.ts",
        "contracts/reference-driver.ts",
        "contracts/production-driver.ts",
        "contracts/wireframe.spec.json",
        "contracts/catalog.ts",
        "contracts/invariants.pbt.test.ts",
        `wireframe/${SLUG}.excalidraw.json`,
      ].sort(),
    );
  });

  it("sanitizes the spec and rules before export", () => {
    const doc = JSON.parse(pack.files["contracts/wireframe.spec.json"]!) as {
      format: string;
      catalogHash: string;
      spec: Spec;
      rules: Array<{ id: string }>;
    };
    expect(doc.format).toBe("genui-behavioral-spec/v1");
    expect(doc.catalogHash).toBe(showcasePreviewCatalog.metadata.catalogHash);
    // Out-of-range prop healed by the catalog.
    expect(doc.spec.elements.metrics?.props.uptimePercent).toBe(100);
    // Prototype-pollution and malformed rules dropped.
    expect(doc.rules.map((r) => r.id)).toEqual([
      "charge-relay",
      "arm-vault",
      "open-vault",
      "drain-signal",
      "signal-lost",
      "bonus-relay",
    ]);
    expect(pack.issues.some((i) => i.code === "blocked_unsafe_path")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("bakes verified win and lose traces and reports the dead rule", () => {
    const outcomes = pack.verifiedTraces.map((t) => t.outcome).sort();
    expect(outcomes).toEqual(["lose", "win"]);
    const win = pack.verifiedTraces.find((t) => t.outcome === "win")!;
    expect(win.expectedScene).toBe("vault");
    expect(win.expectedState["/vault/armed"]).toBe(true);
    expect(pack.fuzzReport.deadRules.map((r) => r.id)).toEqual(["bonus-relay"]);

    const testFile = pack.files["contracts/invariants.pbt.test.ts"]!;
    expect(testFile).toContain('"outcome": "win"');
    expect(testFile).toContain('"outcome": "lose"');
    expect(testFile).toContain('"expectedScene": "vault"');
    expect(pack.files["SKILL.md"]).toContain("`bonus-relay` Bonus relay (from `## Stretch goals`)");
    expect(pack.files[`.kiro/specs/${SLUG}/design.md`]).toContain("bonus-relay");
  });

  it("copies every preserved constraint verbatim into SKILL.md, requirements, design and tasks", () => {
    for (const file of [
      "SKILL.md",
      `.kiro/specs/${SLUG}/requirements.md`,
      `.kiro/specs/${SLUG}/design.md`,
      `.kiro/specs/${SLUG}/tasks.md`,
    ]) {
      for (const constraint of CONSTRAINTS) {
        expect(pack.files[file], `${file} / ${constraint.id}`).toContain(constraint.requirement);
      }
    }
  });

  it("ends tasks.md with wiring the production driver and keeps rule traceability", () => {
    const tasks = pack.files[`.kiro/specs/${SLUG}/tasks.md`]!;
    const lastTask = tasks.trimEnd().split(/\n(?=- \[ \] \d+\. )/).pop()!;
    expect(lastTask).toContain("contracts/production-driver.ts");
    expect(tasks).toContain("_Source: `## Win condition`_");
    expect(pack.files[`.kiro/specs/${SLUG}/requirements.md`]).toContain(
      "WHEN the user presses the `Enter` key AND `/vault/armed` is truthy, THE SYSTEM SHALL switch to scene `vault`",
    );
    expect(pack.files[`.kiro/specs/${SLUG}/design.md`]).toContain("```mermaid\nflowchart TD");
  });

  it("neutralizes unsafe URIs in brief text", () => {
    const hostile = buildSkillPack({
      ...input,
      brief: { ...brief, elevatorPitch: "javascript:alert(1)" },
      excalidrawJson: undefined,
    });
    expect(hostile.document.brief.elevatorPitch).toBe("#blocked-unsafe-uri");
    expect(hostile.files["SKILL.md"]).not.toContain("javascript:");
  });

  it("round-trips contracts/wireframe.spec.json through readBehavioralSpecSource", () => {
    const source = readBehavioralSpecSource(JSON.parse(pack.files["contracts/wireframe.spec.json"]!));
    const rebuilt = buildSkillPack({
      brief: source.brief!,
      spec: source.spec,
      rules: source.rules,
      initialScene: source.initialScene,
      catalog: showcasePreviewCatalog,
      excalidrawJson: input.excalidrawJson,
    });
    expect(rebuilt.files).toEqual(pack.files);
  });

  it("exports a registered template with no rules", () => {
    const template = getTemplateBySlug("product-landing-starter")!;
    const templatePack = buildSkillPack(skillPackInputFromTemplate(template));
    expect(templatePack.slug).toBe("product-landing-starter");
    expect(templatePack.document.rules).toEqual([]);
    expect(templatePack.verifiedTraces).toEqual([]);
    expect(templatePack.files["contracts/invariants.pbt.test.ts"]).toContain("it.skipIf(ACTION_VOCABULARY.length === 0)");
  });

  it(
    "gate: the extracted pack passes with the reference driver and fails with the production stub",
    async () => {
      const bytes = await generateSkillPackZip(input);
      const written = await extractZip(bytes, runDir);
      expect(written).toEqual(Object.keys(pack.files).sort());

      const reference = runContract(runDir, "reference");
      expect(reference.status, reference.output).toBe(0);
      expect(reference.output).toContain("driver: reference");
      expect(reference.output).toContain('reaches "win" through the verified');
      expect(reference.output).toContain('reaches "lose" through the verified');
      expect(reference.output).toContain("matches the reference model on random event sequences");

      const production = runContract(runDir, "production");
      expect(production.status, production.output).not.toBe(0);
      expect(production.output).toContain("NotImplementedError");
      expect(production.output).toContain("driver: production");
    },
    240_000,
  );
});

describe("Next.js starter export with interaction rules", () => {
  const template = getTemplateBySlug("product-landing-starter")!;
  const wireframe = { spec, designMd: "# Design\n", rules: rules as never, initialScene: "main" };

  it("bundles sanitized rules in wireframe.spec.json and runs them through the rule engine", async () => {
    const zip = await JSZip.loadAsync(await generateTemplateZip(template, { wireframe }));
    const specJson = JSON.parse(await zip.file(WIREFRAME_SPEC_EXPORT_PATH)!.async("string")) as Spec & {
      rules: Array<{ id: string }>;
      initialScene: string;
    };
    expect(specJson.root).toBe("shell");
    expect(specJson.initialScene).toBe("main");
    expect(specJson.rules.map((r) => r.id)).not.toContain("pollute");
    expect(specJson.rules).toHaveLength(6);

    const page = await zip.file("app/page.tsx")!.async("string");
    expect(page).toContain("createInteractionRuleEngine");
    expect(page).toContain("sanitizeInteractionRules(wireframeDoc.rules ?? [])");
    expect(page).toContain("handlers={handlers}");
    expect(page).toContain("<InteractionSurface");
    expect(page).toContain("useInteractionDrivers({");
    expect(page).toContain("withInteractionKeys(templateComponents");
    expect(page).not.toContain("dangerouslySetInnerHTML");
  });

  it("leaves rule-free wireframe exports unchanged", async () => {
    const zip = await JSZip.loadAsync(
      await generateTemplateZip(template, { wireframe: { spec, designMd: "# Design\n" } }),
    );
    const specJson = JSON.parse(await zip.file(WIREFRAME_SPEC_EXPORT_PATH)!.async("string")) as Record<string, unknown>;
    expect(specJson.rules).toBeUndefined();
    const page = await zip.file("app/page.tsx")!.async("string");
    expect(page).not.toContain("createInteractionRuleEngine");
  });
});
