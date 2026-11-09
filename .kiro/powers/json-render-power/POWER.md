---
name: "json-render-power"
displayName: "Vercel json-render & GenUI Studio Architect Power"
description: "Equips coding agents with deep expertise in converting React and React Three Fiber components into guardrailed @json-render v0.22.0 Zod catalogs, type-safe registries, RFC 6902 JSONL stream compilers, bidirectional $bindState stores, and MCP Apps."
keywords:
  - "json-render"
  - "@json-render/core"
  - "@json-render/react"
  - "@json-render/shadcn"
  - "@json-render/react-three-fiber"
  - "@json-render/mcp"
  - "defineCatalog"
  - "defineRegistry"
  - "useBoundProp"
  - "SpecStream"
  - "generative-ui"
  - "genui"
---

# Onboarding & Agent Instructions: `json-render-power`

This Kiro Power provides authoritative patterns and guardrails for building Generative UI applications with `@json-render/*` (`v0.22.0`) and `@genui-studio/core`.

---

## 1. When This Power Activates
Activate this power whenever the user or task involves:
- Converting existing React (`*.tsx`) or Three.js / React Three Fiber components into AI-generatable UI catalog entries.
- Authoring or modifying `defineCatalog()` schemas, `defineRegistry()` mappings, or `ActionProvider` handlers.
- Streaming RFC 6902 JSONL UI patches (`createSpecStreamCompiler`, `parseSpecStreamLine`, `applySpecPatch`) or validating specs (`validateSpec`, `autoFixSpec`, `sanitizeSpecGraph`).
- Wiring two-way state bindings (`$state`, `$bindState`, `$bindItem`, `useBoundProp`, `watch`) or visibility conditions (`VisibilityCondition`).
- Serving generative UIs over Model Context Protocol (`@json-render/mcp`).

---

## 2. The 5 Golden Rules of Component-to-Catalog Conversion

### Rule 1: Strict Zod Prop Contracts (Nullable over Optional for LLM Structured Outputs)
LLMs and strict JSON Schema exporters (`catalog.jsonSchema({ strict: true })`) require every object property to be listed in `required`, using `.nullable()` for optional fields:
```typescript
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const catalog = defineCatalog(schema, {
  components: {
    StatusBanner: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
        severity: z.enum(["info", "warning", "critical"]),
      }),
      description: "Displays an operational alert banner with severity indicator.",
    },
  },
  actions: {},
});
```

### Rule 2: Never Put `children`, `visible`, `on`, `repeat`, or `watch` Inside `props`
In `@json-render/react`, `children`, `slots`, `visible`, `on`, `repeat`, and `watch` are **top-level fields** on `UIElement`. Component `props` schemas must only describe domain data and presentation attributes.

### Rule 3: Two-Way Data Binding Uses `useBoundProp` + `bindings`
When converting controlled form inputs (`<input>`, `<select>`, `<slider>`, `<switch>`), accept the resolved value from `props` and the bound path from `bindings`:
```tsx
import { defineRegistry, useBoundProp } from "@json-render/react";

const { registry } = defineRegistry(catalog, {
  components: {
    ThresholdInput: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<number>(props.value, bindings?.value);
      return (
        <input
          type="number"
          value={value ?? 0}
          onChange={(e) => setValue(Number(e.target.value))}
        />
      );
    },
  },
});
```
In the JSON spec, the LLM binds the prop via:
```json
{
  "type": "ThresholdInput",
  "props": {
    "label": "CPU Limit (%)",
    "value": { "$bindState": "/cluster/cpuLimit" }
  }
}
```

### Rule 4: Event Dispatch Uses `emit("eventName")` or `on("eventName")`
Never pass raw JS callback strings from JSON specs. Instead, components fire semantic events via `emit("press")` or `on("click")`, and the `UIElement.on` map binds those events to catalog or built-in actions (`setState`, `pushState`, `removeState`, `validateForm`):
```tsx
ActionButton: ({ props, emit }) => (
  <button type="button" onClick={() => emit("press")}>
    {props.label}
  </button>
)
```

### Rule 5: Wrap Registries in `@genui-studio/core` Telemetry & DAG Sanitization
Always pass streaming or untrusted specs through `GuardrailedStreamCompiler` / `sanitizeSpecGraph` and wrap registries with `wrapRegistryWithTelemetry()` so cyclic element references or bad props degrade gracefully to an `<ElementFaultCard>` instead of crashing React.

---

## 3. Steering Files Included in This Power
- [`steering/react-to-catalog.md`](./steering/react-to-catalog.md): Step-by-step transformation recipes for converting containers, slots, repeat lists, and form controls into `@json-render/react` catalog entries.
- [`steering/three-and-mcp-patterns.md`](./steering/three-and-mcp-patterns.md): Patterns for 3D scene generation (`@json-render/react-three-fiber`) and MCP App packaging (`@json-render/mcp`).
