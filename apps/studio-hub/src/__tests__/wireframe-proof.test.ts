/**
 * Phase 5: reproducible proof for the Wireframe Architect compiler.
 *
 * Input:   __tests__/fixtures/wireframe-proof.excalidraw (a real Excalidraw v2 scene file)
 * Output:  __tests__/__snapshots__/wireframe-proof.spec.json (compiled GenUI Spec)
 *          __tests__/__snapshots__/wireframe-proof.mmd       (generated Mermaid graph)
 *
 * Proves, for compileExcalidrawToGenUI only:
 *   - the 3 primitives (① catalog blocks, ② directed interaction links, ③ tags + guardrails)
 *   - byte-identical output for identical input (repeated runs, cloned input, foreign locale)
 *   - zero network / model / clock / randomness calls during compilation
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { afterEach, describe, expect, it } from "vitest";
import { inspectSpecGraph } from "@genui-studio/core";
import { SHOWCASE_PACK_TEMPLATES } from "@genui-studio/templates";
import {
  compileExcalidrawToGenUI,
  type ExcalidrawCompileResult,
} from "../lib/excalidraw-compiler.js";

const FIXTURE_URL = new URL("./fixtures/wireframe-proof.excalidraw", import.meta.url);
const scene = JSON.parse(fs.readFileSync(FIXTURE_URL, "utf8")) as {
  type: string;
  version: number;
  elements: Record<string, unknown>[];
};

// Same catalog + base Spec the Studio Hub preview hands to <WireframeArchitectCanvas>.
const template = SHOWCASE_PACK_TEMPLATES.find(
  (t) => t.manifest.slug === "saas-dashboard-starter",
);
if (!template) throw new Error("saas-dashboard-starter showcase template missing");
const catalog = template.catalog;
const baseSpec = Object.values(template.pageSpecs)[0] ?? null;
const compileOptions = { catalog, baseSpec, slug: template.manifest.slug } as const;

const compile = (elements: readonly unknown[]): ExcalidrawCompileResult =>
  compileExcalidrawToGenUI(elements, compileOptions);

const serialize = (r: ExcalidrawCompileResult): string => JSON.stringify(r);
const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

const restorers: (() => void)[] = [];
afterEach(() => {
  while (restorers.length) restorers.pop()!();
});

/** Replace obj[key] with a tripwire that records the call and then throws. */
function tripwire(obj: object, key: string, label: string, calls: string[]): void {
  const target = obj as Record<string, unknown>;
  const had = Object.prototype.hasOwnProperty.call(target, key);
  const original = target[key];
  const wire = function tripwireFn() {
    calls.push(label);
    throw new Error(`compileExcalidrawToGenUI must not call ${label}`);
  };
  Object.defineProperty(target, key, { value: wire, configurable: true, writable: true });
  restorers.push(() => {
    if (had) Object.defineProperty(target, key, { value: original, configurable: true, writable: true });
    else delete target[key];
  });
}

describe("Wireframe Architect proof (compileExcalidrawToGenUI)", () => {
  it("(a) input fixture is a genuine Excalidraw v2 scene", () => {
    expect(scene.type).toBe("excalidraw");
    expect(scene.version).toBe(2);
    expect(scene.elements.length).toBe(16);
  });

  it("(b)+(c) compiles the sketch to the committed golden Spec and Mermaid graph", async () => {
    const result = compile(scene.elements);
    await expect(`${JSON.stringify(result.spec, null, 2)}\n`).toMatchFileSnapshot(
      "./__snapshots__/wireframe-proof.spec.json",
    );
    await expect(`${result.mermaidDiagram}\n`).toMatchFileSnapshot(
      "./__snapshots__/wireframe-proof.mmd",
    );
  });

  it("① catalog blocks: shapes resolve to real catalog components by label", () => {
    const { spec, resolvedMappings } = compile(scene.elements);
    const byId = Object.fromEntries(resolvedMappings.map((m) => [m.elementId, m]));

    expect(spec.root).toBe("wf-frame-page");
    expect(spec.elements[spec.root]?.type).toBe("SiteShell");
    expect(byId["blk-hero"]?.componentType).toBe("HeroSection"); // exact name in label
    expect(byId["blk-metrics"]?.componentType).toBe("MetricStrip"); // keyword "kpi telemetry"
    for (const m of resolvedMappings) {
      expect(catalog.metadata.componentNames).toContain(m.componentType);
    }
    // Children follow (y, x, id) order inside the frame.
    expect(spec.elements[spec.root]?.children).toEqual([
      "wf-blk-hero",
      "wf-blk-metrics",
      "wf-blk-features",
      "wf-aa-note",
      "wf-zz-note",
      "wf-blk-rogue",
    ]);
  });

  it("② directed interaction link: labelled arrow becomes a $state binding + Mermaid edge", () => {
    const { spec, stateBindings, mermaidDiagram } = compile(scene.elements);
    expect(stateBindings).toEqual([
      {
        arrowId: "arr-region",
        sourceSpecKey: "wf-blk-metrics",
        targetSpecKey: "wf-blk-hero",
        pointerPath: "/wireframeBindings/selectedRegion",
        label: "selectedRegion",
        boundPropName: "summary",
      },
    ]);
    expect(spec.elements["wf-blk-hero"]?.props).toMatchObject({
      summary: { $state: "/wireframeBindings/selectedRegion" },
    });
    expect(spec.state).toMatchObject({ wireframeBindings: { selectedRegion: "selectedRegion" } });
    expect(mermaidDiagram).toContain(
      'wf_blk_metrics -.->|"/wireframeBindings/selectedRegion"| wf_blk_hero',
    );
  });

  it("③ tags + guardrails: explicit tags honoured, unknown/dangerous metadata rejected", () => {
    const { spec, resolvedMappings, compiledNodeCount } = compile(scene.elements);
    const byId = Object.fromEntries(resolvedMappings.map((m) => [m.elementId, m]));

    // Explicit customData tag wins over the label text.
    expect(byId["blk-features"]?.componentType).toBe("FeatureGrid");
    // Unknown tag "EvilWidget" is not in the catalog: ignored, falls back to label matching.
    expect(byId["blk-rogue"]?.componentType).toBe("HeroSection");
    expect(JSON.stringify(spec)).not.toContain("EvilWidget");
    // Prototype-pollution keys never reach the Spec or the global prototype.
    expect(JSON.stringify(spec)).not.toMatch(/__proto__|"constructor"|polluted|hijack/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Deleted shapes are dropped. 16 elements -> 7 visual nodes (frame + 6 live blocks);
    // bound text labels fold into their container and the arrow becomes a binding.
    expect(resolvedMappings.some((m) => m.elementId === "blk-deleted")).toBe(false);
    expect(compiledNodeCount).toBe(7);

    // The output passes the catalog's full validation and is an acyclic DAG.
    const verdict = catalog.validateFull(spec);
    expect(verdict.valid).toBe(true);
    expect(verdict.issues).toEqual([]);
    const graph = inspectSpecGraph(spec);
    expect(graph.hasCycles).toBe(false);
    expect(graph.issues).toEqual([]);
  });

  it("(d) identical input -> byte-identical output: 50 runs and a deep-cloned input", () => {
    const baseline = serialize(compile(scene.elements));
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      hashes.add(sha256(serialize(compile(scene.elements))));
    }
    hashes.add(sha256(serialize(compile(structuredClone(scene.elements)))));
    hashes.add(sha256(serialize(compile(JSON.parse(JSON.stringify(scene.elements))))));
    expect([...hashes]).toEqual([sha256(baseline)]);
  });

  it("(d) output does not depend on the runtime's default locale", () => {
    const baseline = serialize(compile(scene.elements));
    // Simulate a Danish runtime, where "aa" collates after "z" (aa = å).
    const danish = new Intl.Collator("da");
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = function localeCompareDa(this: string, that: string) {
      return danish.compare(String(this), String(that));
    } as typeof String.prototype.localeCompare;
    restorers.push(() => {
      String.prototype.localeCompare = original;
    });
    expect(serialize(compile(scene.elements))).toBe(baseline);
  });

  it("(f) makes zero network, model, clock or randomness calls", () => {
    const calls: string[] = [];
    const g = globalThis as unknown as Record<string, unknown>;
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "importScripts"]) {
      tripwire(g, name, `globalThis.${name}`, calls);
    }
    for (const [mod, label] of [[http, "http"], [https, "https"]] as const) {
      tripwire(mod, "request", `${label}.request`, calls);
      tripwire(mod, "get", `${label}.get`, calls);
    }
    tripwire(net, "connect", "net.connect", calls);
    tripwire(net, "createConnection", "net.createConnection", calls);
    tripwire(tls, "connect", "tls.connect", calls);
    tripwire(Math, "random", "Math.random", calls);
    tripwire(Date, "now", "Date.now", calls);
    tripwire(performance, "now", "performance.now", calls);
    tripwire(globalThis.crypto, "getRandomValues", "crypto.getRandomValues", calls);
    tripwire(globalThis.crypto, "randomUUID", "crypto.randomUUID", calls);

    const guarded = compile(scene.elements);
    expect(calls).toEqual([]);

    while (restorers.length) restorers.pop()!();
    expect(serialize(guarded)).toBe(serialize(compile(scene.elements)));
  });
});
