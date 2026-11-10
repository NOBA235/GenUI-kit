import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { schema } from "@json-render/react/schema";
import { defineRegistry, JSONUIProvider } from "@json-render/react";
import { z } from "zod";
import {
  createGuardrailedStreamCompiler,
  createVerifiedCatalog,
  SafeGenUIRenderer,
  wrapRegistryWithTelemetry,
} from "../index.js";

/**
 * Regression suite for BUG-INT-01 (found while integrating App #1, not by the Phase 2 suite):
 *
 * GuardrailedStreamCompiler heals props *before* render. The renderer-level wrapper then
 * received already-valid props, so `<DiagnosticHealedBadge />` never appeared for any
 * streamed content — only for hand-built specs passed straight to SafeGenUIRenderer
 * (which is exactly what the Phase 2 boundary test did, so it stayed green).
 *
 * Fix: the compiler now exposes per-element healing provenance (`healedDiagnostics`),
 * and SafeGenUIRenderer forwards it to every wrapped node via context.
 */
const catalog = createVerifiedCatalog(schema, {
  components: {
    Gauge: {
      description: "Bounded gauge",
      props: z.object({
        label: z.string(),
        value: z.number().min(0).max(100),
      }),
    },
  },
  actions: {},
});

const { registry } = defineRegistry(catalog.catalog, {
  components: {
    Gauge: ({ props }) =>
      React.createElement(
        "div",
        { "data-gauge-value": props.value },
        props.label,
      ),
  },
  actions: {},
});
const safeRegistry = wrapRegistryWithTelemetry(catalog, registry);

function render(spec: unknown, healedDiagnostics?: unknown): string {
  return renderToStaticMarkup(
    React.createElement(
      JSONUIProvider,
      { registry: safeRegistry, initialState: {}, children: null },
      React.createElement(SafeGenUIRenderer, {
        spec: spec as never,
        registry: safeRegistry,
        catalog,
        healedDiagnostics: healedDiagnostics as never,
      }),
    ),
  );
}

describe("BUG-INT-01: streamed healing provenance reaches the render boundary", () => {
  it("PROPERTY: any out-of-bounds streamed value is clamped AND badged; in-bounds values are never badged", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: -1e9, max: 1e9, noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
        ),
        (value) => {
          const compiler = createGuardrailedStreamCompiler({ catalog });
          compiler.push(
            [
              JSON.stringify({ op: "add", path: "/root", value: "g" }),
              JSON.stringify({
                op: "add",
                path: "/elements/g",
                value: { type: "Gauge", props: { label: "cpu", value }, children: [] },
              }),
            ].join("\n") + "\n",
          );
          const result = compiler.finalize();
          const html = render(result.spec, result.healedDiagnostics);
          const outOfBounds = value < 0 || value > 100;

          expect(html.includes('data-genui-diagnostic-badge="healed"')).toBe(
            outOfBounds,
          );
          const rendered = Number(/data-gauge-value="([^"]+)"/.exec(html)?.[1]);
          expect(rendered).toBeGreaterThanOrEqual(0);
          expect(rendered).toBeLessThanOrEqual(100);
          expect(Object.keys(result.healedDiagnostics)).toEqual(
            outOfBounds ? ["g"] : [],
          );
        },
      ),
      { numRuns: 150 },
    );
  });

  it("provenance tracks the CURRENT spec: a later corrective patch clears the badge", () => {
    const compiler = createGuardrailedStreamCompiler({ catalog });
    compiler.push(
      [
        JSON.stringify({ op: "add", path: "/root", value: "g" }),
        JSON.stringify({
          op: "add",
          path: "/elements/g",
          value: { type: "Gauge", props: { label: "cpu", value: 999 }, children: [] },
        }),
      ].join("\n") + "\n",
    );
    expect(Object.keys(compiler.getHealedDiagnostics())).toEqual(["g"]);

    const corrected = compiler.push(
      JSON.stringify({ op: "replace", path: "/elements/g/props/value", value: 42 }) +
        "\n",
    );
    expect(corrected.healedDiagnostics).toEqual({});
    expect(render(corrected.spec, corrected.healedDiagnostics)).not.toContain(
      "data-genui-diagnostic-badge",
    );
  });

  it("SafeGenUIRenderer never mutates the caller's spec when stamping element keys", () => {
    const spec = {
      root: "g",
      elements: { g: { type: "Gauge", props: { label: "x", value: 5 }, children: [] } },
    };
    const before = JSON.stringify(spec);
    render(spec);
    expect(JSON.stringify(spec)).toBe(before);
  });
});
