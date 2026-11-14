// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { schema } from "@json-render/react/schema";
import { defineRegistry, JSONUIProvider } from "@json-render/react";
import { z } from "zod";
import {
  createVerifiedCatalog,
  SafeGenUIRenderer,
  wrapRegistryWithTelemetry,
} from "../index.js";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const catalog = createVerifiedCatalog(schema, {
  components: {
    HookedCard: {
      description: "Stateful hook-using component with strict code format",
      props: z.object({
        serviceCode: z.string().regex(/^SRV-\d+$/),
        crash: z.boolean().optional(),
      }),
    },
  },
  actions: {},
});

const { registry } = defineRegistry(catalog.catalog, {
  components: {
    HookedCard: ({ props }) => {
      const [mounts, setMounts] = useState(1);
      useEffect(() => {
        setMounts((m) => m);
      }, []);

      if (props.crash) {
        throw new Error("Simulated component runtime crash");
      }

      return React.createElement(
        "div",
        { "data-testid": "hooked-card", "data-mounts": mounts },
        `service=${props.serviceCode}`,
      );
    },
  },
  actions: {},
});

const safeRegistry = wrapRegistryWithTelemetry(catalog, registry);

function TestTree({ spec }: { spec: unknown }) {
  return React.createElement(
    JSONUIProvider,
    { registry: safeRegistry, initialState: {}, children: null },
    React.createElement(SafeGenUIRenderer, {
      spec: spec as never,
      registry: safeRegistry,
      catalog,
    }),
  );
}

describe("SafeGenUIRenderer live React DOM hook-order & boundary recovery", () => {
  it("transitions across invalid -> valid -> invalid -> valid props without violating React Rules of Hooks", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const makeSpec = (serviceCode: string, crash = false) => ({
      root: "card-1",
      elements: {
        "card-1": {
          type: "HookedCard",
          props: { serviceCode, crash },
          children: [],
        },
      },
    });

    try {
      // 1. Start invalid (regex mismatch -> ElementFaultCard, inner HookedCard skipped cleanly)
      await act(async () => {
        root.render(React.createElement(TestTree, { spec: makeSpec("invalid-code") }));
      });
      expect(
        container.querySelector('[data-genui-fault-card="true"][data-element-key="card-1"]'),
      ).not.toBeNull();
      expect(container.querySelector('[data-testid="hooked-card"]')).toBeNull();

      // 2. Patch to valid -> SafeElementInvoker mounts inner HookedCard on its own child fiber
      await act(async () => {
        root.render(React.createElement(TestTree, { spec: makeSpec("SRV-42") }));
      });
      expect(container.querySelector('[data-testid="hooked-card"]')?.textContent).toBe(
        "service=SRV-42",
      );

      // 3. Patch back to invalid -> SafeElementInvoker unmounts cleanly, zero hook mismatch
      await act(async () => {
        root.render(React.createElement(TestTree, { spec: makeSpec("bad-again") }));
      });
      expect(
        container.querySelector('[data-genui-fault-card="true"][data-element-key="card-1"]'),
      ).not.toBeNull();

      // 4. Patch to runtime crash -> caught by GenUIElementErrorBoundary
      await act(async () => {
        root.render(React.createElement(TestTree, { spec: makeSpec("SRV-42", true) }));
      });
      expect(
        container.querySelector('[data-genui-fault-card="true"][data-element-key="card-1"]'),
      ).not.toBeNull();

      // 5. Patch back to healthy -> GenUIElementErrorBoundary recovers when propsSignature changes
      await act(async () => {
        root.render(React.createElement(TestTree, { spec: makeSpec("SRV-99", false) }));
      });
      expect(container.querySelector('[data-testid="hooked-card"]')?.textContent).toBe(
        "service=SRV-99",
      );

      const hookWarnings = errorSpy.mock.calls.filter((args) =>
        args.some(
          (a) =>
            typeof a === "string" &&
            (a.includes("Rendered more hooks") ||
              a.includes("Rendered fewer hooks") ||
              a.includes("change in the order of Hooks")),
        ),
      );
      expect(hookWarnings).toHaveLength(0);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      errorSpy.mockRestore();
    }
  });
});
