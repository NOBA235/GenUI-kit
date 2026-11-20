import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { auditCatalogRegistryParity } from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { getTemplateBySlug } from "@genui-studio/templates";
import { App } from "../App.js";

describe("Standalone App #2: BIOS // NECROMANCER (apps/cmos-cloud-bios)", () => {
  it("renders the standalone Award CMOS BIOS & 3D PCB cloud compiler cleanly via @genui-studio/core", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('data-testid="standalone-app-cmos-bios"');
    expect(html).toContain('data-template-theme="cmos-cloud-bios"');
    expect(html).toContain('data-testid="cmos-telemetry-monitor"');
    expect(html).toContain("PC HEALTH STATUS");
    expect(html).not.toContain('data-genui-fault-card="true"');
  });

  it("maintains 1:1 catalog-registry parity and passes fast-check invariants on @genui-studio/core", () => {
    const template = getTemplateBySlug("cmos-cloud-bios")!;
    const parity = auditCatalogRegistryParity(template.catalog, template.registry);
    expect(parity.synchronized).toBe(true);
    expect(parity.missingComponents).toEqual([]);
    expect(parity.extraComponents).toEqual([]);

    const report = runCatalogInvariantSuite(template.catalog, { numRuns: 15 });
    expect(report.allPassed).toBe(true);
  });
});
