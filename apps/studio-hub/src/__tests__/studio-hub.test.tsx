import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearRuntimeTemplates,
  registerRuntimeTemplate,
  showcasePreviewCatalog,
  SHOWCASE_PACK_TEMPLATES,
  useAfterdarkStore,
} from "@genui-studio/templates";
import { createTelemetryTracker } from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { App } from "../App.js";
import { TemplateExportDialog } from "../components/TemplateExportDialog.js";
import { TemplateXRayDrawer } from "../components/TemplateXRayDrawer.js";

describe("GenUI Studio Hub — Dual-Mode Storefront, Scoped Preview & HUD", () => {
  afterEach(() => {
    clearRuntimeTemplates();
  });

  it("renders unified Marketplace storefront with Mode A, Mode B, and all 6 filter tags", () => {
    const base = SHOWCASE_PACK_TEMPLATES[0]!;
    registerRuntimeTemplate({
      ...base,
      manifest: {
        ...base.manifest,
        slug: "chronos-web3-standalone",
        id: "chronos-web3-standalone",
        name: "chronos-web3-standalone",
        title: "Chronos DeFi Standalone",
        mode: "standalone",
        category: "Web3 / DeFi",
        tags: ["Web3 / DeFi", "Full-Stack Standalone", "GenUI Verified"],
        verified: true,
      },
    });

    const html = renderToStaticMarkup(<App initialPath="/" />);

    expect(html).toContain("GenUI Studio Hub");
    expect(html).toContain("Aegis 3D Spatial Infrastructure War-Room");
    expect(html).toContain("Chronos DeFi Standalone");
    expect(html).toContain("Mode A · Native");
    expect(html).toContain("Mode B · Standalone");

    // Required 6 filter tags
    expect(html).toContain("3D / WebGL");
    expect(html).toContain("B2B SaaS");
    expect(html).toContain("E-Commerce");
    expect(html).toContain("Web3 / DeFi");
    expect(html).toContain("Full-Stack Standalone");
    expect(html).toContain("GenUI Verified");
  });

  it("wraps /preview/[slug] in strict data-template-theme isolation container and renders collapsible Studio HUD", () => {
    const base = SHOWCASE_PACK_TEMPLATES[0]!;
    registerRuntimeTemplate({
      ...base,
      manifest: {
        ...base.manifest,
        slug: "saas-light-starter",
        id: "saas-light-starter",
        name: "saas-light-starter",
        title: "SaaS Light Starter",
        theme: {
          ...base.manifest.theme,
          defaultColorScheme: "light",
          surfaceBg: "#f8fafc",
          surfaceElevated: "#ffffff",
          textColor: "#0f172a",
        },
      },
    });

    const darkHtml = renderToStaticMarkup(
      <App initialPath="/preview/spatial-ops-3d-pro" instantStreamForTest />,
    );

    expect(darkHtml).toContain('data-template-theme="spatial-ops-3d-pro"');
    expect(darkHtml).toContain('data-color-scheme="dark"');
    expect(darkHtml).toContain('data-template-style="spatial-ops-3d-pro"');
    expect(darkHtml).toContain("@scope ([data-template-theme=");
    expect(darkHtml).toContain("color-scheme: only dark");
    expect(darkHtml).toContain('data-testid="studio-hud"');
    expect(darkHtml).toContain('data-testid="viewport-btn-desktop"');
    expect(darkHtml).toContain('data-testid="viewport-btn-tablet"');
    expect(darkHtml).toContain('data-testid="viewport-btn-mobile"');
    expect(darkHtml).toContain("?fullscreen=true");
    expect(darkHtml).toContain('data-testid="toggle-remix-bar-btn"');
    expect(darkHtml).toContain('data-testid="open-hub-xray-btn"');
    expect(darkHtml).toContain('data-testid="open-hub-export-btn"');
    expect(darkHtml).toContain('data-testid="collapse-hud-btn"');

    const lightHtml = renderToStaticMarkup(
      <App initialPath="/preview/saas-light-starter" instantStreamForTest />,
    );
    expect(lightHtml).toContain('data-template-theme="saas-light-starter"');
    expect(lightHtml).toContain('data-color-scheme="light"');
    expect(lightHtml).toContain("color-scheme: only light");
  });

  it("supports ?fullscreen=true mode by hiding full HUD while keeping template theme isolation intact", () => {
    const fullscreenHtml = renderToStaticMarkup(
      <App
        initialPath="/preview/spatial-ops-3d-pro"
        initialFullscreen
        instantStreamForTest
      />,
    );

    expect(fullscreenHtml).toContain('data-template-theme="spatial-ops-3d-pro"');
    expect(fullscreenHtml).toContain('data-viewport="fullscreen"');
    expect(fullscreenHtml).toContain('data-testid="exit-fullscreen-btn"');
    expect(fullscreenHtml).not.toContain('data-testid="studio-hud"');
  });

  it("renders X-Ray PBT Inspector, Export Website dialog, and passes showcasePreviewCatalog formal PBT invariants", () => {
    const pbtReport = runCatalogInvariantSuite(showcasePreviewCatalog, {
      numRuns: 15,
    });
    expect(pbtReport.allPassed).toBe(true);

    const template = SHOWCASE_PACK_TEMPLATES[0]!;
    const noop = () => {};

    const xrayHtml = renderToStaticMarkup(
      <TemplateXRayDrawer
        isOpen
        onClose={noop}
        templateTitle={template.manifest.title}
        templateSlug={template.manifest.slug}
        catalog={template.catalog}
        telemetry={{
          ...createTelemetryTracker().getSnapshot(),
          patchCount: 4,
          evaluatedPropsCount: 4,
        }}
        patchLog={[]}
        currentSpec={template.pageSpecs.home ?? null}
      />,
    );
    expect(xrayHtml).toContain('data-testid="hub-xray-drawer"');
    expect(xrayHtml).toContain("X-Ray Telemetry &amp; PBT");

    const exportHtml = renderToStaticMarkup(
      <TemplateExportDialog
        isOpen
        onClose={noop}
        template={template}
      />,
    );
    expect(exportHtml).toContain('data-testid="hub-export-dialog"');
    expect(exportHtml).toContain("npx genui-studio add spatial-ops-3d-pro");
    expect(exportHtml).toContain("2. SKILL.md &amp; POWER.md");
    expect(exportHtml).toContain("3. Standalone Next.js .ZIP");
  });

  it("handles unknown template slugs gracefully without crashing", () => {
    const notFoundHtml = renderToStaticMarkup(
      <App initialPath="/preview/does-not-exist" />,
    );
    expect(notFoundHtml).toContain('data-testid="template-not-found"');
    expect(notFoundHtml).toContain("Not Found");
    expect(notFoundHtml).toContain("Return to Marketplace");
  });

  it("renders AFTERDARK in full-window Immersion Mode, timed Scene 01 typography, and ?debug=true overlay", () => {
    try {
      // 1. Default Immersion Entry (#000000 Shutdown + Hidden Studio HUD + Corner Indicator)
      useAfterdarkStore.getState().resetExperience();
      const shutdownHtml = renderToStaticMarkup(
        <App initialPath="/preview/afterdark-horror" instantStreamForTest />,
      );

      expect(shutdownHtml).toContain('data-template-theme="afterdark-horror"');
      expect(shutdownHtml).toContain('data-viewport="immersion"');
      expect(shutdownHtml).not.toContain('data-testid="studio-hud"');
      expect(shutdownHtml).toContain('data-testid="immersion-hud-indicator"');
      expect(shutdownHtml).toContain(
        "Press [Alt+G] for GenUI Studio / Export | [?debug=true] for Debug",
      );
      expect(shutdownHtml).toContain('data-testid="afterdark-shutdown-overlay"');
      expect(shutdownHtml).toContain("SIGNAL LOST");

      // 2. Timed Typography Progression ("2:17 AM" -> "Why did you come here?" -> "Something is waiting." -> CTA)
      useAfterdarkStore.getState().startSequence();
      useAfterdarkStore.getState().setTypographyStep(4);
      const typographyHtml = renderToStaticMarkup(
        <App initialPath="/preview/afterdark-horror" instantStreamForTest />,
      );

      expect(typographyHtml).toContain("2:17 AM");
      expect(typographyHtml).toContain("Why did you come here?");
      expect(typographyHtml).toContain("Something is waiting.");
      expect(typographyHtml).toContain("ENTER THE CEMETERY");

      // 3. Exploration + ?debug=true Telemetry Overlay + Quality Presets + Zone Teleports
      useAfterdarkStore.getState().finishGateEntry();
      useAfterdarkStore.getState().toggleDebug(true);
      const debugHtml = renderToStaticMarkup(
        <App initialPath="/preview/afterdark-horror" instantStreamForTest />,
      );

      expect(debugHtml).toContain('data-testid="afterdark-debug-overlay"');
      expect(debugHtml).toContain("QUALITY PRESET:");
      expect(debugHtml).toContain("TELEPORT TO ZONE:");
      expect(debugHtml).toContain("Chapel Steps");
    } finally {
      useAfterdarkStore.getState().resetExperience();
      useAfterdarkStore.getState().toggleDebug(false);
    }
  });
});
