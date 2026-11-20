import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inspectSpecGraph } from "@genui-studio/core";
import {
  showcasePreviewCatalog,
  SHOWCASE_PACK_TEMPLATES,
} from "@genui-studio/templates";
import { App } from "../App.js";
import { PreviewPage } from "../pages/PreviewPage.js";
import {
  catalogToExcalidrawLibrary,
  compileExcalidrawToGenUI,
  exportExcalidrawToKiroArtifacts,
  MAX_CANVAS_ELEMENTS,
  specToInitialExcalidrawElements,
} from "../lib/excalidraw-compiler.js";

const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"] as const;

const chaoticCoordArb = fc.oneof(
  fc.double({ min: -50_000, max: 50_000, noNaN: false }),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.constant(-0),
  fc.constant(0),
);

const chaoticIdArb = fc.oneof(
  fc.stringMatching(/^[a-zA-Z0-9_-]{1,18}$/),
  fc.constantFrom(...DANGEROUS_KEYS),
  fc.constant(""),
);

const chaoticLabelArb = fc.oneof(
  fc.constantFrom(
    "HeroSection\nAI Firewall Banner",
    "MetricStrip\nTelemetry Strip",
    "FeatureGrid\nCore Capabilities",
    "SiteShell",
    "pricing",
    "kpi dashboard",
    "__proto__\nconstructor",
    "<script>alert(1)</script>",
    "javascript:alert(1)",
  ),
  fc.string({ maxLength: 90 }),
);

const chaoticElementArb = fc.record({
  id: chaoticIdArb,
  type: fc.constantFrom(
    "rectangle",
    "diamond",
    "ellipse",
    "frame",
    "magicframe",
    "text",
    "arrow",
    "selection",
    "freedraw",
  ),
  x: chaoticCoordArb,
  y: chaoticCoordArb,
  width: chaoticCoordArb,
  height: chaoticCoordArb,
  isDeleted: fc.boolean(),
  text: chaoticLabelArb,
  name: chaoticLabelArb,
  frameId: fc.option(chaoticIdArb, { nil: null }),
  containerId: fc.option(chaoticIdArb, { nil: null }),
  startBinding: fc.option(
    fc.record({
      elementId: chaoticIdArb,
      focus: fc.constant(0),
      gap: fc.constant(4),
    }),
    { nil: null },
  ),
  endBinding: fc.option(
    fc.record({
      elementId: chaoticIdArb,
      focus: fc.constant(0),
      gap: fc.constant(4),
    }),
    { nil: null },
  ),
  customData: fc.option(
    fc.record({
      catalogComponent: fc.oneof(
        fc.constantFrom("SiteShell", "HeroSection", "MetricStrip", "FeatureGrid"),
        fc.constantFrom(...DANGEROUS_KEYS),
        fc.string({ maxLength: 24 }),
      ),
      __proto__: fc.constant("polluted"),
    }),
    { nil: undefined },
  ),
});

describe("Excalidraw Spatial-to-GenUI Compiler — Formal PBT & Unit Invariants", () => {
  it("PBT (500 runs): arbitrary chaotic Excalidraw scenes compile without throwing into cycle-free bounded Spec DAGs", () => {
    const baseSpec = SHOWCASE_PACK_TEMPLATES[0]?.pageSpecs.home ?? null;

    fc.assert(
      fc.property(
        fc.array(chaoticElementArb, { minLength: 0, maxLength: 45 }),
        (elements) => {
          const result = compileExcalidrawToGenUI(elements, {
            catalog: showcasePreviewCatalog,
            baseSpec,
            slug: "saas-dashboard-starter",
          });

          expect(result.spec.root).toBeTruthy();
          expect(typeof result.spec.elements).toBe("object");
          expect(result.spec.elements[result.spec.root]).toBeDefined();

          // Graph structural safety (no cycles, bounded depth <= 16)
          const inspection = inspectSpecGraph(result.spec, {
            maxDepth: 16,
            maxElements: 500,
          });
          expect(inspection.hasCycles).toBe(false);
          expect(inspection.maxObservedDepth).toBeLessThanOrEqual(16);

          // Catalog compliance after validation/healing
          const catalogCheck = showcasePreviewCatalog.validateFull(result.spec);
          expect(catalogCheck.valid).toBe(true);

          // Prototype pollution check on top-level elements & state
          for (const key of Object.keys(result.spec.elements)) {
            expect(DANGEROUS_KEYS).not.toContain(key);
          }
          expect(
            Object.prototype.hasOwnProperty.call(result.spec.elements, "__proto__"),
          ).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("PBT (500 runs): non-deleted spatial boxes are deterministically sorted top-to-bottom then left-to-right by (y, x)", () => {
    const pairArb = fc
      .tuple(
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 450, max: 900 }),
        fc.integer({ min: 0, max: 600 }),
        fc.integer({ min: 0, max: 600 }),
      )
      .map(([yTop, yBottom, xTop, xBottom]) => ({
        yTop,
        yBottom,
        xTop,
        xBottom,
      }));

    fc.assert(
      fc.property(pairArb, ({ yTop, yBottom, xTop, xBottom }) => {
        const bottomFirst = [
          {
            id: "bottom-box",
            type: "rectangle",
            x: xBottom,
            y: yBottom,
            width: 240,
            height: 90,
            isDeleted: false,
            customData: { catalogComponent: "MetricStrip" },
          },
          {
            id: "top-box",
            type: "rectangle",
            x: xTop,
            y: yTop,
            width: 240,
            height: 90,
            isDeleted: false,
            customData: { catalogComponent: "HeroSection" },
          },
        ];

        const compiled = compileExcalidrawToGenUI(bottomFirst, {
          catalog: showcasePreviewCatalog,
          slug: "saas-dashboard-starter",
        });

        const rootChildren = compiled.spec.elements[compiled.spec.root]?.children ?? [];
        expect(rootChildren).toEqual(["wf-top-box", "wf-bottom-box"]);
      }),
      { numRuns: 500 },
    );
  });

  it("caps massive canvases at MAX_CANVAS_ELEMENTS and emits a deterministic warning", () => {
    const hugeCanvas = Array.from({ length: MAX_CANVAS_ELEMENTS + 40 }, (_, i) => ({
      id: `bulk-${i}`,
      type: "rectangle",
      x: (i % 5) * 200,
      y: Math.floor(i / 5) * 120,
      width: 180,
      height: 80,
      isDeleted: false,
    }));

    const result = compileExcalidrawToGenUI(hugeCanvas, {
      catalog: showcasePreviewCatalog,
    });
    expect(result.compiledNodeCount).toBe(MAX_CANVAS_ELEMENTS);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(inspectSpecGraph(result.spec).hasCycles).toBe(false);
  });

  it("compiles arrow bindings into safe RFC 6901 JSON pointers and Mermaid state edges", () => {
    const scene = [
      {
        id: "hero-node",
        type: "rectangle",
        x: 100,
        y: 80,
        width: 300,
        height: 100,
        isDeleted: false,
        boundElements: [{ id: "hero-txt", type: "text" }],
      },
      {
        id: "hero-txt",
        type: "text",
        x: 110,
        y: 95,
        width: 260,
        height: 40,
        containerId: "hero-node",
        text: "HeroSection\nInteractive Funnel",
        isDeleted: false,
      },
      {
        id: "metric-node",
        type: "rectangle",
        x: 100,
        y: 250,
        width: 300,
        height: 100,
        isDeleted: false,
        boundElements: [{ id: "metric-txt", type: "text" }],
      },
      {
        id: "metric-txt",
        type: "text",
        x: 110,
        y: 265,
        width: 260,
        height: 40,
        containerId: "metric-node",
        text: "MetricStrip\nSynced Telemetry",
        isDeleted: false,
      },
      {
        id: "arrow-1",
        type: "arrow",
        x: 250,
        y: 180,
        width: 10,
        height: 70,
        isDeleted: false,
        text: "checkoutPlan",
        startBinding: { elementId: "hero-node", focus: 0, gap: 4 },
        endBinding: { elementId: "metric-node", focus: 0, gap: 4 },
      },
    ];

    const compiled = compileExcalidrawToGenUI(scene, {
      catalog: showcasePreviewCatalog,
      slug: "saas-dashboard-starter",
    });

    expect(compiled.compiledNodeCount).toBe(2);
    expect(compiled.stateBindings).toHaveLength(1);
    expect(compiled.stateBindings[0]?.pointerPath).toBe("/wireframeBindings/checkoutPlan");
    expect(compiled.mermaidDiagram).toContain("flowchart TD");
    expect(compiled.mermaidDiagram).toContain("/wireframeBindings/checkoutPlan");
    expect(compiled.spec.elements["wf-hero-node"]?.props?.headline).toBe(
      "Interactive Funnel",
    );

    const kiroExport = exportExcalidrawToKiroArtifacts({
      elements: scene,
      compileResult: compiled,
      slug: "saas-dashboard-starter",
      title: "SaaS Dashboard",
    });
    expect(kiroExport.filenameExcalidraw).toBe("saas-dashboard-starter.excalidraw.json");
    expect(kiroExport.filenameDesignMd).toBe(".kiro/specs/saas-dashboard-starter/design.md");
    expect(kiroExport.designMdSection).toContain("```mermaid");
    expect(kiroExport.designMdSection).toContain("/wireframeBindings/checkoutPlan");
  });

  it("generates catalog library blocks and round-trips active template Specs through Excalidraw scene", () => {
    const template = SHOWCASE_PACK_TEMPLATES[0]!;
    const baseSpec = template.pageSpecs.home ?? null;

    const lib = catalogToExcalidrawLibrary(template.catalog, {
      baseSpec,
      slug: template.manifest.slug,
    });
    expect(lib.libraryItems.length).toBe(
      template.catalog.metadata.componentNames.length,
    );
    expect(lib.libraryItems[0]?.elements[0]?.customData?.catalogComponent).toBe(
      lib.libraryItems[0]?.name,
    );

    const starterElements = specToInitialExcalidrawElements(baseSpec, template.catalog);
    expect(starterElements.length).toBeGreaterThan(2);

    const roundTripped = compileExcalidrawToGenUI(starterElements, {
      catalog: template.catalog,
      baseSpec,
      slug: template.manifest.slug,
    });
    expect(roundTripped.compiledNodeCount).toBeGreaterThan(0);
    expect(template.catalog.validateFull(roundTripped.spec).valid).toBe(true);
  });

  it("exposes Wireframe Architect HUD button and isolates Excalidraw behind React.lazy Suspense boundary", () => {
    const previewHtml = renderToStaticMarkup(
      <App initialPath="/preview/saas-dashboard-starter" instantStreamForTest />,
    );
    expect(previewHtml).toContain('data-testid="toggle-wireframe-btn"');
    expect(previewHtml).toContain('aria-pressed="false"');
    expect(previewHtml).not.toContain('data-testid="wireframe-architect-panel"');

    const wireframeLazyHtml = renderToStaticMarkup(
      <PreviewPage
        slug="saas-dashboard-starter"
        isFullscreen={false}
        onToggleFullscreen={() => {}}
        onNavigateHome={() => {}}
        instantStreamForTest
        initialWireframeMode
      />,
    );
    expect(wireframeLazyHtml).toContain('aria-pressed="true"');
    expect(wireframeLazyHtml).toContain('data-testid="wireframe-architect-loading"');
    expect(wireframeLazyHtml).toContain('data-testid="viewport-stage"');
  });
});
