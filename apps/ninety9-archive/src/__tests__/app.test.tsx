import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { auditCatalogRegistryParity } from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { getTemplateBySlug } from "@genui-studio/templates";
import { App } from "../App.js";

describe("Standalone App #1: NINETY9 Monochrome Archive (apps/ninety9-archive)", () => {
  it("renders all 6 standalone routes cleanly through @genui-studio/core SafeGenUIRenderer", () => {
    const routes: readonly [string, string][] = [
      ["/", 'id="ninety9-arcade-bay"'],
      ["/ninety9", 'id="ninety9-arcade-bay"'],
      ["/archive", 'data-testid="ninety9-archive-catalog-view"'],
      ["/ninety9/archive", 'data-testid="ninety9-archive-catalog-view"'],
      ["/timeline", 'data-testid="ninety9-timeline-section"'],
      ["/categories", 'data-testid="ninety9-categories-view"'],
      ["/about", 'data-testid="ninety9-about-view"'],
      ["/arcade", 'data-testid="ninety9-arcade-view"'],
    ];

    for (const [routePath, expectedSnippet] of routes) {
      const html = renderToStaticMarkup(<App initialPath={routePath} />);
      expect(html).toContain('data-testid="standalone-app-ninety9"');
      expect(html).toContain('data-template-theme="ninety9-archive"');
      expect(html).toContain('data-testid="ninety9-cobol-boot-terminal"');
      expect(html).toContain(expectedSnippet);
      expect(html).not.toContain('data-genui-fault-card="true"');
    }
  });

  it("maintains 1:1 catalog-registry parity and passes fast-check invariants on @genui-studio/core", () => {
    const template = getTemplateBySlug("ninety9-archive")!;
    const parity = auditCatalogRegistryParity(template.catalog, template.registry);
    expect(parity.synchronized).toBe(true);
    expect(parity.missingComponents).toEqual([]);
    expect(parity.extraComponents).toEqual([]);

    const report = runCatalogInvariantSuite(template.catalog, { numRuns: 15 });
    expect(report.allPassed).toBe(true);
  });
});
