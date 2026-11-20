/**
 * End-to-end test of the workbench first-success journey ("the Hard Test"):
 *
 *   1. Open the sample wireframe   2. Compile to Spec   3. Inspect diagnostics
 *   4. Preview the interactive UI  5. Export a runnable React starter (.zip)
 *
 * Every step runs through the real pipeline: `compileExcalidrawToGenUI` ->
 * `catalog.validateFull()` -> `<SafeGenUIRenderer>` + `TimeTravelStateStore` ->
 * `generateTemplateZip()`. Step 5 unpacks the archive, writes it to disk and imports the
 * exported catalog, components and `app/page.tsx` to prove the starter renders the
 * user's compiled wireframe.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React, { useId, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { afterAll, describe, expect, it } from "vitest";
import type { Spec } from "@json-render/core";
import { JSONUIProvider, type ComponentRegistry } from "@json-render/react";
import {
  createTimeTravelStateStore,
  inspectSpecGraph,
  SafeGenUIRenderer,
  wrapRegistryWithTelemetry,
  type HealedDiagnosticsByElement,
  type PropDiagnostic,
} from "@genui-studio/core";
import {
  generateTemplateZip,
  getTemplateBySlug,
  WIREFRAME_SPEC_EXPORT_PATH,
} from "@genui-studio/templates";
import { App, resolveSampleWireframeSlug } from "../App.js";
import {
  collectWireframeDiagnostics,
  WireframeDiagnosticsStrip,
} from "../components/WireframeDiagnosticsStrip.js";
import {
  compileExcalidrawToGenUI,
  createSkeletonRectAndText,
  type ExcalidrawCompileResult,
} from "../lib/excalidraw-compiler.js";
import {
  buildDashboardSampleWireframeElements,
  buildSampleWireframeElements,
} from "../lib/sample-wireframe.js";
import { buildWireframeExport } from "../lib/wireframe-export.js";

const slug = resolveSampleWireframeSlug();
const template = getTemplateBySlug(slug);
if (!template) throw new Error(`sample template "${slug}" is not registered`);
const catalog = template.catalog;
const baseSpec = Object.values(template.pageSpecs)[0] ?? null;
const compile = (elements: readonly unknown[]): ExcalidrawCompileResult =>
  compileExcalidrawToGenUI(elements, { catalog, baseSpec, slug });

const sampleElements = buildSampleWireframeElements();
const sampleResult = compile(sampleElements);

const KEYS = {
  root: "wf-sample-frame-shell",
  hero: "wf-sample-hero-rect",
  metrics: "wf-sample-metrics-rect",
  pricing: "wf-sample-pricing-rect",
} as const;

function groupHealed(diagnostics: readonly PropDiagnostic[]): HealedDiagnosticsByElement {
  const out: Record<string, PropDiagnostic[]> = {};
  for (const d of diagnostics) {
    if (d.status !== "healed") continue;
    (out[d.elementKey] ??= []).push(d);
  }
  return out;
}

/** Same composition PreviewPage uses: JSONUIProvider + SafeGenUIRenderer over a time-travel store. */
function renderPreview(
  spec: Spec,
  registry: ComponentRegistry,
  store: ReturnType<typeof createTimeTravelStateStore>,
  healedDiagnostics: HealedDiagnosticsByElement = {},
): string {
  const safeRegistry = wrapRegistryWithTelemetry(catalog, registry, { showHealedBadges: true });
  return renderToStaticMarkup(
    <JSONUIProvider registry={safeRegistry} store={store}>
      <SafeGenUIRenderer
        spec={spec}
        registry={safeRegistry}
        catalog={catalog}
        healedDiagnostics={healedDiagnostics}
      />
    </JSONUIProvider>,
  );
}

const EXPORT_ROOT = fileURLToPath(new URL("../../.e2e-export/", import.meta.url));
const exportDir = path.join(EXPORT_ROOT, `journey-${process.pid}-${Date.now()}`);

afterAll(() => {
  fs.rmSync(exportDir, { recursive: true, force: true });
  if (fs.existsSync(EXPORT_ROOT) && fs.readdirSync(EXPORT_ROOT).length === 0) {
    fs.rmdirSync(EXPORT_ROOT);
  }
});

describe("Workbench first-success journey (sketch → compile → diagnose → preview → export)", () => {
  it("step 1: the front door opens the sample wireframe in the workbench", () => {
    const marketplaceHtml = renderToStaticMarkup(<App initialPath="/" />);
    expect(marketplaceHtml).toContain('data-testid="hero-open-sample-wireframe"');
    expect(marketplaceHtml).toContain("Open Sample Wireframe in Workbench");
    expect(marketplaceHtml).toContain('data-testid="first-success-steps"');

    // /preview/<slug>?wireframe=sample opens Wireframe Architect (lazy; SSR shows its fallback)
    // next to the scoped preview stage.
    const workbenchHtml = renderToStaticMarkup(
      <App initialPath={`/preview/${slug}`} initialWireframe="sample" instantStreamForTest />,
    );
    expect(workbenchHtml).toContain('data-testid="wireframe-architect-loading"');
    expect(workbenchHtml).toContain(`data-template-theme="${slug}"`);
    expect(workbenchHtml).toContain('data-testid="viewport-stage"');

    // Without ?wireframe the preview keeps its default behaviour.
    const plainHtml = renderToStaticMarkup(
      <App initialPath={`/preview/${slug}`} instantStreamForTest />,
    );
    expect(plainHtml).not.toContain('data-testid="wireframe-architect-loading"');

    // The sample deliberately contains one unknown tag and one out-of-range prop.
    const tags = sampleElements.map(
      (el) => (el.customData as Record<string, unknown> | undefined)?.catalogComponent,
    );
    expect(tags).toContain("PricingTable");
    expect(catalog.metadata.componentNames).not.toContain("PricingTable");
    expect(JSON.stringify(sampleElements)).toContain('"uptimePercent":140');
  });

  it("step 2: compiles the sketch to a deterministic Spec and Mermaid graph", () => {
    const again = compile(sampleElements);
    const cloned = compile(structuredClone(sampleElements));
    expect(JSON.stringify(again)).toBe(JSON.stringify(sampleResult));
    expect(JSON.stringify(cloned)).toBe(JSON.stringify(sampleResult));

    const { spec } = sampleResult;
    expect(spec.root).toBe(KEYS.root);
    expect(spec.elements[KEYS.root]?.type).toBe("SiteShell");
    expect(spec.elements[KEYS.root]?.children).toEqual([KEYS.hero, KEYS.metrics, KEYS.pricing]);
    expect(spec.elements[KEYS.hero]?.type).toBe("HeroSection");
    expect(spec.elements[KEYS.metrics]?.type).toBe("MetricStrip");
    expect(spec.elements[KEYS.pricing]?.type).toBe("FeatureGrid");

    // Labelled arrow -> RFC 6901 pointer bound to the hero summary + dashed Mermaid edge.
    expect(sampleResult.stateBindings).toEqual([
      {
        arrowId: "sample-arrow-plan",
        sourceSpecKey: KEYS.pricing,
        targetSpecKey: KEYS.hero,
        pointerPath: "/wireframeBindings/selectedPlan",
        label: "selectedPlan",
        boundPropName: "summary",
      },
    ]);
    expect(spec.elements[KEYS.hero]?.props).toMatchObject({
      summary: { $state: "/wireframeBindings/selectedPlan" },
    });
    expect(spec.state).toEqual({ wireframeBindings: { selectedPlan: "selectedPlan" } });
    expect(sampleResult.mermaidDiagram).toContain(
      'wf_sample_pricing_rect -.->|"/wireframeBindings/selectedPlan"| wf_sample_hero_rect',
    );
    expect(inspectSpecGraph(spec).hasCycles).toBe(false);
  });

  it("step 3: surfaces actionable diagnostics for the healed prop and the ignored tag", () => {
    const sources = Object.fromEntries(
      sampleResult.resolvedMappings.map((m) => [m.specKey, m.matchSource]),
    );
    expect(sources).toEqual({
      [KEYS.root]: "tag",
      [KEYS.hero]: "label",
      [KEYS.metrics]: "tag",
      [KEYS.pricing]: "label",
    });

    expect(sampleResult.warnings).toEqual([
      'Shape "sample-pricing-rect": tag "PricingTable" is not in the catalog; resolved by label to FeatureGrid.',
    ]);
    expect(sampleResult.propDiagnostics).toHaveLength(1);
    expect(sampleResult.propDiagnostics[0]).toMatchObject({
      elementKey: KEYS.metrics,
      propName: "uptimePercent",
      status: "healed",
      originalValue: 140,
      resolvedValue: 100,
    });
    expect(sampleResult.validationIssues).toEqual([]);
    expect(catalog.validateFull(sampleResult.spec).valid).toBe(true);

    const rows = collectWireframeDiagnostics(sampleResult);
    expect(rows.map((r) => r.severity)).toEqual(["warning", "warning"]);

    const stripHtml = renderToStaticMarkup(<WireframeDiagnosticsStrip result={sampleResult} />);
    expect(stripHtml).toContain('data-testid="wireframe-diagnostics-strip"');
    expect(stripHtml).toContain('data-diagnostics-status="warning"');
    expect(stripHtml).toContain("0 errors · 2 warnings");
    expect(stripHtml).toContain("PricingTable");
    expect(stripHtml).toContain("MetricStrip.uptimePercent healed 140 → 100");
    expect(stripHtml).toContain("/wireframeBindings/selectedPlan");
    expect(stripHtml).toContain(`${KEYS.hero}.summary`);
  });

  it("step 3 (failure states): hostile or broken sketches produce errors, never a crash or unsafe output", () => {
    const block = (idPrefix: string, y: number, label: string, customData: Record<string, unknown>) =>
      createSkeletonRectAndText({
        idPrefix,
        x: 100,
        y,
        width: 320,
        height: 100,
        label,
        strokeColor: "#0b1221",
        backgroundColor: "#ffffff",
        customData,
        indexBase: y,
      });
    const hostile = [
      ...block("uri", 100, "HeroSection\njavascript:alert(1)", {}),
      ...block("bad", 250, "FeatureGrid", {
        catalogComponent: "FeatureGrid",
        defaultProps: { items: "not-an-array", columns: "many" },
      }),
      ...block("evil", 400, "Some block", { catalogComponent: "__proto__" }),
      ...block("blank", 550, "", {}),
    ];

    const result = compile(hostile);
    const serialized = JSON.stringify(result.spec);
    expect(serialized).not.toContain("javascript:");
    expect(serialized).toContain("#blocked-unsafe-uri");
    expect(serialized).not.toContain("__proto__");
    expect(inspectSpecGraph(result.spec).hasCycles).toBe(false);

    expect(result.validationIssues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["blocked_unsafe_uri", "unknown_component"]),
    );
    expect(
      result.propDiagnostics.filter((d) => d.status === "rejected").map((d) => d.propName).sort(),
    ).toEqual(["columns", "items"]);
    expect(result.warnings.join("\n")).toContain("rejected dangerous catalogComponent tag");
    expect(result.warnings.join("\n")).toContain("unlabelled shape; fell back to");

    const stripHtml = renderToStaticMarkup(<WireframeDiagnosticsStrip result={result} />);
    expect(stripHtml).toContain('data-diagnostics-status="error"');
    expect(stripHtml).toContain("FeatureGrid.columns rejected");

    // The broken block is isolated to a fault card; its siblings still render.
    const html = renderPreview(result.spec, template.registry, createTimeTravelStateStore({}));
    expect(html).toContain('data-genui-fault-card="true"');
    expect(html).toContain('data-element-key="wf-bad-rect"');
    expect(html).toContain("#blocked-unsafe-uri");
    expect(html).not.toContain("javascript:");
  });

  it("step 4: previews the Spec through SafeGenUIRenderer with hook components, healed badges and live $state", () => {
    // A user's own HeroSection implementation that uses hooks (useState, useId, useMemo).
    // Raw registry entries receive `{ element }`; props arrive already resolved ($state) and healed.
    const HookHero: ComponentRegistry[string] = ({ element }) => {
      const [renders] = useState(1);
      const id = useId();
      const p = element.props as { headline: string; summary: string };
      const headline = useMemo(() => p.headline.toUpperCase(), [p.headline]);
      return (
        <section data-testid="hook-hero" data-hook-id={id ? "set" : "missing"}>
          <h1>{headline}</h1>
          <p data-testid="hook-hero-summary">{p.summary}</p>
          <span>renders:{renders}</span>
        </section>
      );
    };
    const registry: ComponentRegistry = { ...template.registry, HeroSection: HookHero };
    const store = createTimeTravelStateStore(
      (sampleResult.spec.state ?? {}) as Record<string, unknown>,
    );
    const healed = groupHealed(sampleResult.propDiagnostics);

    const html = renderPreview(sampleResult.spec, registry, store, healed);
    expect(html).toContain('data-testid="hook-hero"');
    expect(html).toContain('data-hook-id="set"');
    expect(html).toContain("TURN A SKETCH INTO A LIVE UI");
    expect(html).toContain('<p data-testid="hook-hero-summary">selectedPlan</p>');
    // The uptime value cell shows the clamped value (the label text mentions 140% on purpose).
    expect(html).toContain('mt-1">100%</div>');
    expect(html).not.toContain(">140%<");
    expect(html).toContain('data-genui-diagnostic-badge="healed"');
    expect(html).toContain(`data-element-key="${KEYS.metrics}"`);
    expect(html).not.toContain('data-genui-fault-card="true"');

    // The arrow binding is live: writing the pointer updates the bound hero summary.
    store.set("/wireframeBindings/selectedPlan", "Pro plan, billed yearly");
    const updated = renderPreview(sampleResult.spec, registry, store, healed);
    expect(updated).toContain('<p data-testid="hook-hero-summary">Pro plan, billed yearly</p>');
    store.undo();
    expect(store.get("/wireframeBindings/selectedPlan")).toBe("selectedPlan");
  });

  it("step 5: exports a runnable Next.js starter that renders the compiled wireframe", async () => {
    const wireframe = buildWireframeExport({
      result: sampleResult,
      sceneElements: sampleElements,
      slug,
      title: template.manifest.title,
    });
    const zip = await JSZip.loadAsync(await generateTemplateZip(template, { wireframe }));
    const read = async (file: string): Promise<string> => {
      const entry = zip.file(file);
      if (!entry) throw new Error(`missing ${file} in exported .zip`);
      return entry.async("string");
    };

    const pkg = JSON.parse(await read("package.json")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts.dev).toContain("next dev");
    expect(pkg.dependencies.next).toBeDefined();
    expect(pkg.dependencies["@genui-studio/core"]).toBeDefined();
    const tsconfig = JSON.parse(await read("tsconfig.json")) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions.resolveJsonModule).toBe(true);

    const page = await read("app/page.tsx");
    expect(page).toContain('from "../src/template/wireframe.spec.json"');
    expect(page).toContain("<SafeGenUIRenderer");

    expect(WIREFRAME_SPEC_EXPORT_PATH).toBe("src/template/wireframe.spec.json");
    const exportedSpec = JSON.parse(await read(WIREFRAME_SPEC_EXPORT_PATH)) as Spec;
    expect(exportedSpec).toEqual(sampleResult.spec);

    const designMd = await read(`.kiro/specs/${slug}/design.md`);
    expect(designMd).toContain(`# Design — ${template.manifest.title}`);
    expect(designMd).toContain("```mermaid");
    expect(designMd).toContain(sampleResult.mermaidDiagram);
    expect(designMd).toContain("`/wireframeBindings/selectedPlan`");

    const scene = JSON.parse(await read(`wireframe/${slug}.excalidraw.json`)) as {
      type: string;
      elements: unknown[];
    };
    expect(scene.type).toBe("excalidraw");
    expect(compile(scene.elements).spec).toEqual(sampleResult.spec);
    expect(zip.file(".env")).toBeNull();

    // Write the project to disk and load it like Next.js would.
    const textFiles = Object.values(zip.files).filter((f) => !f.dir);
    for (const file of textFiles) {
      const target = path.join(exportDir, ...file.name.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await file.async("string"), "utf8");
    }
    const importExported = (rel: string) =>
      import(/* @vite-ignore */ pathToFileURL(path.join(exportDir, rel)).href);

    const exportedCatalog = (await importExported("src/template/catalog.ts")) as {
      verifiedCatalog: typeof catalog;
      initialPageSpecs: Record<string, Spec>;
    };
    // The exported catalog source is identical to the one the workbench validated against.
    expect(exportedCatalog.verifiedCatalog.metadata.catalogHash).toBe(catalog.metadata.catalogHash);
    expect(exportedCatalog.initialPageSpecs.home).toEqual(template.pageSpecs.home);
    const verdict = exportedCatalog.verifiedCatalog.validateFull(exportedSpec);
    expect(verdict.valid).toBe(true);
    expect(verdict.issues).toEqual([]);

    const exportedPage = (await importExported("app/page.tsx")) as {
      default: React.ComponentType;
    };
    const pageHtml = renderToStaticMarkup(<exportedPage.default />);
    expect(pageHtml).toContain(`data-template-theme="${slug}"`);
    expect(pageHtml).toContain("Turn a sketch into a live UI");
    expect(pageHtml).toContain("selectedPlan");
    expect(pageHtml).toContain('mt-1">100%</div>');
    expect(pageHtml).not.toContain(">140%<");
    expect(pageHtml).not.toContain('data-genui-fault-card="true"');
  });

  it("skeleton crew versatility: compiles and exports a second distinct SaaS Dashboard wireframe through the exact same foundation", async () => {
    const dashTemplate = getTemplateBySlug("saas-dashboard-starter")!;
    expect(dashTemplate).toBeDefined();
    const dashElements = buildDashboardSampleWireframeElements();
    const dashResult = compileExcalidrawToGenUI(dashElements, {
      catalog: dashTemplate.catalog,
      baseSpec: dashTemplate.pageSpecs.home ?? null,
      slug: dashTemplate.manifest.slug,
    });

    expect(dashResult.warnings).toEqual([]);
    expect(dashResult.validationIssues).toEqual([]);
    expect(dashResult.spec.elements[dashResult.spec.root]?.children).toEqual([
      "wf-dash-kpis-rect",
      "wf-dash-summary-rect",
      "wf-dash-services-rect",
    ]);
    expect(dashResult.stateBindings).toEqual([
      expect.objectContaining({
        pointerPath: "/wireframeBindings/activeRegion",
        targetSpecKey: "wf-dash-summary-rect",
      }),
    ]);

    const dashStore = createTimeTravelStateStore(
      (dashResult.spec.state ?? {}) as Record<string, unknown>,
    );
    const dashHtml = renderPreview(dashResult.spec, dashTemplate.registry, dashStore);
    expect(dashHtml).toContain("SaaS Operations Overview");
    expect(dashHtml).toContain("99.95%");
    expect(dashHtml).not.toContain('data-genui-fault-card="true"');

    const dashExport = buildWireframeExport({
      result: dashResult,
      sceneElements: dashElements,
      slug: dashTemplate.manifest.slug,
      title: dashTemplate.manifest.title,
    });
    const dashZip = await JSZip.loadAsync(
      await generateTemplateZip(dashTemplate, { wireframe: dashExport }),
    );
    const dashSpecJson = JSON.parse(
      await dashZip.file(WIREFRAME_SPEC_EXPORT_PATH)!.async("string"),
    ) as Spec;
    expect(dashSpecJson).toEqual(dashResult.spec);
    expect(dashSpecJson).not.toEqual(sampleResult.spec);
  });
});
