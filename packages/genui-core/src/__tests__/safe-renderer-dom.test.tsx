// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act, memo, useEffect, useId, useMemo, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
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
        multiplier: z.number().min(1).max(100),
        crash: z.boolean().optional(),
      }),
      slots: ["default"],
    },
    MemoBadge: {
      description: "React.memo wrapped catalog badge that also calls useMemo and useId",
      props: z.object({
        label: z.string().min(1),
        tier: z.enum(["core", "edge"]),
      }),
    },
  },
  actions: {},
});

const MemoBadgeComponent = memo(function MemoBadgeInner({
  label,
  tier,
}: {
  label: string;
  tier: "core" | "edge";
}) {
  const badgeId = useId();
  const formatted = useMemo(
    () => `${tier.toUpperCase()}::${label}`,
    [tier, label],
  );
  return React.createElement(
    "span",
    { "data-testid": "memo-badge", "data-badge-id": badgeId },
    formatted,
  );
});

const { registry } = defineRegistry(catalog.catalog, {
  components: {
    HookedCard: ({ props, children }) => {
      const reactId = useId();
      const [mounts, setMounts] = useState(1);
      const computedScore = useMemo(
        () => `${props.serviceCode}#${props.multiplier * 2}`,
        [props.serviceCode, props.multiplier],
      );
      useEffect(() => {
        setMounts((m) => m);
      }, []);

      if (props.crash) {
        throw new Error("Simulated component runtime crash");
      }

      return React.createElement(
        "div",
        {
          "data-testid": "hooked-card",
          "data-mounts": mounts,
          "data-react-id": reactId,
          "data-score": computedScore,
        },
        `service=${props.serviceCode}`,
        children,
      );
    },
    MemoBadge: ({ props }) =>
      React.createElement(MemoBadgeComponent, {
        label: props.label,
        tier: props.tier,
      }),
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

describe("SafeGenUIRenderer SSR hook-component rendering, hydration & DOM boundary recovery", () => {
  it("renders hook-using (useState, useMemo, useId) and React.memo components in SSR (renderToString & renderToStaticMarkup) and hydrates without hook-order mismatches", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);

    const ssrSpec = {
      root: "card-1",
      elements: {
        "card-1": {
          type: "HookedCard",
          props: {
            serviceCode: "SRV-42",
            multiplier: 250, // Out-of-bounds -> clamped to 100 in SSR & client
          },
          children: ["badge-memo", "badge-invalid"],
        },
        "badge-memo": {
          type: "MemoBadge",
          props: {
            label: "gateway",
            tier: "EDGE", // Case-healed to "edge"
          },
          children: [],
        },
        "badge-invalid": {
          type: "HookedCard",
          props: {
            serviceCode: "not-a-valid-code", // Fails regex -> ElementFaultCard in SSR & client
            multiplier: 10,
          },
          children: [],
        },
      },
    };

    try {
      // 1. Server render via both renderToStaticMarkup and renderToString
      const staticHtml = renderToStaticMarkup(
        React.createElement(TestTree, { spec: ssrSpec }),
      );
      const ssrHtml = renderToString(
        React.createElement(TestTree, { spec: ssrSpec }),
      );

      expect(staticHtml).toContain("service=SRV-42");
      expect(staticHtml).toContain('data-score="SRV-42#200"');
      expect(staticHtml).toContain("EDGE::gateway");
      expect(staticHtml).toContain('data-genui-diagnostic-badge="healed"');
      expect(staticHtml).toContain('data-genui-fault-card="true"');

      // 2. Hydrate the SSR HTML on the client using hydrateRoot (parsed via DOMParser)
      const parsedDoc = new DOMParser().parseFromString(ssrHtml, "text/html");
      container.replaceChildren(...Array.from(parsedDoc.body.childNodes));
      let hydratedRoot: ReturnType<typeof hydrateRoot> | null = null;
      await act(async () => {
        hydratedRoot = hydrateRoot(
          container,
          React.createElement(TestTree, { spec: ssrSpec }),
        );
      });

      expect(container.querySelector('[data-testid="hooked-card"]')?.getAttribute("data-score")).toBe(
        "SRV-42#200",
      );
      expect(container.querySelector('[data-testid="memo-badge"]')?.textContent).toBe(
        "EDGE::gateway",
      );
      expect(
        container.querySelector('[data-genui-fault-card="true"][data-element-key="badge-invalid"]'),
      ).not.toBeNull();

      // Zero hook-order or hydration mismatch errors
      const hookOrHydrationErrors = errorSpy.mock.calls.filter((args) =>
        args.some(
          (a) =>
            typeof a === "string" &&
            (a.includes("Rendered more hooks") ||
              a.includes("Rendered fewer hooks") ||
              a.includes("change in the order of Hooks") ||
              a.includes("Invalid hook call") ||
              a.includes("Hydration failed") ||
              a.includes("did not match")),
        ),
      );
      expect(hookOrHydrationErrors).toHaveLength(0);

      if (hydratedRoot) {
        await act(async () => {
          hydratedRoot!.unmount();
        });
      }
    } finally {
      container.remove();
      errorSpy.mockRestore();
    }
  });

  it("transitions across invalid -> valid -> invalid -> runtime throw -> valid props without violating React Rules of Hooks", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const makeSpec = (serviceCode: string, crash = false) => ({
      root: "card-1",
      elements: {
        "card-1": {
          type: "HookedCard",
          props: { serviceCode, multiplier: 10, crash },
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
