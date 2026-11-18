---
inclusion: always
---

# Technical Stack & Grounded API Steering

## 1. Core Dependency Matrix (Grounded in Official v0.22.0 Releases)
All packages in this monorepo target the verified exports of the `@json-render` v0.22.0 ecosystem, `zod` v4, and `fast-check` v4:

| Package | Version | Primary Exports Used |
| :--- | :--- | :--- |
| `@json-render/core` | `^0.22.0` | `defineSchema`, `defineCatalog`, `createSpecStreamCompiler`, `parseSpecStreamLine`, `applySpecPatch`, `applySpecStreamPatch`, `compileSpecStream`, `createMixedStreamParser`, `validateSpec`, `autoFixSpec`, `formatSpecIssues`, `createStateStore`, `resolvePropValue`, `resolveElementProps`, `resolveBindings`, `evaluateVisibility`, `visibility`, `check`, `buildUserPrompt`, `deepMergeSpec`, `diffToPatches`, `nestedToFlat`, `registerActionObserver` |
| `@json-render/core/store-utils` | `^0.22.0` | `createStoreAdapter`, `immutableSetByPath`, `flattenToPointers` |
| `@json-render/react` | `^0.22.0` | `defineRegistry`, `Renderer`, `JSONUIProvider`, `StateProvider`, `ActionProvider`, `VisibilityProvider`, `ValidationProvider`, `createRenderer`, `useStateStore`, `useStateValue`, `useBoundProp`, `useIsVisible`, `useActions`, `useAction`, `useFieldValidation`, `useUIStream`, `useChatUI` |
| `@json-render/react/schema` | `^0.22.0` | `schema`, `elementTreeSchema`, `ReactSchema`, `ReactSpec` |
| `@json-render/shadcn` | `^0.22.0` | Declared by `apps/spatial-ops`, not imported by any source file. Available exports: `shadcnComponents` (from root), `shadcnComponentDefinitions` (from `@json-render/shadcn/catalog`) |
| `@json-render/react-three-fiber` | `^0.22.0` | Declared by `apps/spatial-ops`, not imported by any source file (SpatialOps renders with `@react-three/fiber` directly). Available exports: `ThreeCanvas`, `ThreeRenderer`, `threeComponents`, `threeComponentDefinitions`, `vector3Schema`, `materialSchema`, `transformProps`, `shadowProps` |
| `@json-render/mcp` | not installed | Not a dependency of any package. Its `0.22.0` exports are `createMcpApp`, `registerJsonRenderTool`, `registerJsonRenderResource` (root), `useJsonRenderApp` + `buildAppHtml` (`@json-render/mcp/app`) and `buildAppHtml` (`@json-render/mcp/build-app-html`) |
| `@modelcontextprotocol/sdk` | `^1.32.2` | `McpServer`, `StdioServerTransport` (`packages/genui-mcp`); `Client`, `StdioClientTransport` (`scripts/verify-mcp.mjs`) |
| `@react-three/fiber` / `@react-three/drei` / `three` | `^9.0.0` / `^10.0.0` / `^0.173.0` | `Canvas`, `useFrame`; `Html`, `OrbitControls` (SpatialOps scene and template 3D views) |
| `react` / `react-dom` | `^19.0.0` | Peer dependency of `@genui-studio/core` and `@genui-studio/templates` (`^18 \|\| ^19`) |
| `zod` | `^4.3.6` | `z.object`, `z.string`, `z.number`, `z.boolean`, `z.enum`, `z.array`, `z.nullable`, `z.union` |
| `fast-check` | `^4.10.2` | `fc.assert`, `fc.property`, `fc.record`, `fc.dictionary`, `fc.oneof`, `fc.constantFrom`, `fc.letrec`, `fc.array`, `fc.tuple` |
| `vitest` | `^3.0.0` | `describe`, `it`, `expect`, `vi` (in-process test & fuzz runner) |
| Tooling | Node `>=22.18.0`, `pnpm@9.15.0`, TypeScript `^5.7.2`, ESLint `^10.15.0` | Root `.ts` scripts (e.g. the templates `prebuild`, `scripts/sync-templates.ts`) run with Node's built-in type stripping, so Node 20 cannot build the repo. Every package exposes `build`, `typecheck`, `lint`, `test`. |

---

## 2. Canonical `@json-render` v0.22.0 Usage Patterns

### A. Defining a Catalog & Schema
Always import `schema` from `@json-render/react/schema` and `defineCatalog` from `@json-render/core`:
```typescript
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

export const catalog = defineCatalog(schema, {
  components: {
    Card: shadcnComponentDefinitions.Card,
    MetricCard: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        delta: z.string().nullable(),
        status: z.enum(["healthy", "warning", "critical"]).nullable(),
      }),
      description: "Displays a real-time telemetry KPI metric with status badge.",
    },
  },
  actions: {
    triggerRemediation: {
      params: z.object({
        nodeId: z.string(),
        strategy: z.enum(["restart", "drain", "reroute"]),
      }),
      description: "Executes an automated remediation playbook on the target node.",
    },
  },
});
```

### B. Defining a Type-Safe Registry & Two-Way Bindings
Use `defineRegistry` and `useBoundProp` from `@json-render/react`. Never use the deprecated `useStateBinding`:
```tsx
import { defineRegistry, useBoundProp } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { catalog } from "./catalog";

export const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components: {
    Card: shadcnComponents.Card,
    MetricCard: ({ props }) => (
      <div data-status={props.status ?? "healthy"}>
        <span>{props.label}</span>
        <strong>{props.value}</strong>
      </div>
    ),
  },
  actions: {
    triggerRemediation: async (params, setState, state) => {
      if (!params) return;
      setState((prev) => ({
        ...prev,
        lastRemediation: { nodeId: params.nodeId, strategy: params.strategy },
      }));
    },
  },
});
```

### C. Spec Format & Built-In Actions
- The React and R3F renderers consume the flat `Spec` structure:
  ```typescript
  interface Spec {
    root: string;
    elements: Record<string, UIElement>;
    state?: Record<string, unknown>;
  }
  ```
- Built-in actions (`setState`, `pushState`, `removeState`, `validateForm`) are provided automatically by `@json-render/react/schema` and `ActionProvider`. Do NOT redeclare them in `catalog.actions`.
- Element-level directives (`visible`, `on`, `repeat`, `watch`, `slots`, `children`) MUST sit on the `UIElement` object itself—never nested inside `element.props`.

---

## 3. Hardware & Resource Discipline
1. **In-Process Execution:** Run all unit tests, `fast-check` property-based fuzzing suites, and stream benchmarks in-process via `vitest run` without spawning Docker containers or external databases.
2. **Bounded Fuzzing Runs:** Default `fast-check` `numRuns` to `100` in standard CI/Vitest runs (completing in `< 1.5s`) with configurable high-intensity seeds (`1,000+` runs) on demand. `runCatalogInvariantSuite()` uses `50` runs per property when no `numRuns` is passed; callers pass their own (`invariants.fuzz.test.ts` uses `100`).
3. **Memory-Safe Streaming:** Stream buffers and state history ring buffers must enforce strict upper bounds (default max `128` snapshots via `maxHistory`, max `500` elements per spec, max tree depth `16`).
