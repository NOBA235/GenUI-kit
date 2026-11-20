---
inclusion: always
---

# Technical Stack & Grounded API Steering

## 1. Core Dependency Matrix (Grounded in Official v0.22.0 Releases)
All 6 workspace packages (`packages/genui-core`, `packages/templates`, `packages/genui-cli`, `apps/studio-hub`, `apps/ninety9-archive`, `apps/cmos-cloud-bios`) target the verified exports of the `@json-render` v0.22.0 ecosystem, `zod` v4, and `fast-check` v4:

| Package | Version | Primary Exports Used |
| :--- | :--- | :--- |
| `@json-render/core` | `^0.22.0` | `defineSchema`, `defineCatalog`, `createSpecStreamCompiler`, `parseSpecStreamLine`, `applySpecPatch`, `applySpecStreamPatch`, `compileSpecStream`, `createMixedStreamParser`, `validateSpec`, `autoFixSpec`, `formatSpecIssues`, `createStateStore`, `resolvePropValue`, `resolveElementProps`, `resolveBindings`, `evaluateVisibility`, `visibility`, `check`, `buildUserPrompt`, `deepMergeSpec`, `diffToPatches`, `nestedToFlat`, `registerActionObserver` |
| `@json-render/core/store-utils` | `^0.22.0` | `createStoreAdapter`, `immutableSetByPath`, `flattenToPointers` |
| `@json-render/react` | `^0.22.0` | `defineRegistry`, `Renderer`, `JSONUIProvider`, `StateProvider`, `ActionProvider`, `VisibilityProvider`, `ValidationProvider`, `createRenderer`, `useStateStore`, `useStateValue`, `useBoundProp`, `useIsVisible`, `useActions`, `useAction`, `useFieldValidation`, `useUIStream`, `useChatUI` |
| `@json-render/react/schema` | `^0.22.0` | `schema`, `elementTreeSchema`, `ReactSchema`, `ReactSpec` |
| `@excalidraw/excalidraw` | `0.18.1` | Lazy-loaded canvas & element types in `apps/studio-hub` Wireframe Architect |
| `@react-three/fiber` / `@react-three/drei` / `three` | `^9.0.0` / `^10.0.0` / `^0.173.0` | `Canvas`, `useFrame`; `OrbitControls` (`afterdark-horror` and `cmos-cloud-bios` 3D views) |
| `react` / `react-dom` | `^19.0.0` | Peer dependency of `@genui-studio/core` and `@genui-studio/templates` (`^18 \|\| ^19`) |
| `zod` | `^4.3.6` | `z.object`, `z.string`, `z.number`, `z.boolean`, `z.enum`, `z.array`, `z.nullable`, `z.union` |
| `fast-check` | `^4.10.2` | `fc.assert`, `fc.property`, `fc.record`, `fc.dictionary`, `fc.oneof`, `fc.constantFrom`, `fc.letrec`, `fc.array`, `fc.tuple` |
| `jszip` | `^3.10.2` | In-memory runnable Next.js 15 `.zip` starter packaging |
| `vitest` | `^3.0.0` | `describe`, `it`, `expect`, `vi` (in-process test & property-based fuzz runner) |
| Tooling | Node `>=22.18.0`, `pnpm@9.15.0`, TypeScript `^5.7.2`, ESLint `^10.15.0`, Vite `^6.1.0`, Tailwind CSS `^4.0.0` | Root `.ts` scripts (e.g. `scripts/sync-templates.ts`) run with Node's built-in type stripping, so Node 20 cannot build the repo. Every workspace package exposes `build`, `typecheck`, `lint`, `test`. |

---

## 2. Canonical `@json-render` v0.22.0 Usage Patterns

### A. Defining a Catalog & Schema
Always import `schema` from `@json-render/react/schema` and `createVerifiedCatalog` from `@genui-studio/core`:
```typescript
import { createVerifiedCatalog } from "@genui-studio/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const verifiedCatalog = createVerifiedCatalog(schema, {
  components: {
    MetricStrip: {
      props: z.object({
        heading: z.string().min(1).max(80),
        primaryValue: z.string().min(1).max(32),
        uptimePercent: z.number().min(0).max(100),
      }),
      description: "Displays bounded KPI telemetry with automatic prop healing.",
    },
  },
  actions: {},
});
```

### B. Defining a Type-Safe Registry & Two-Way Bindings
Use `defineRegistry` and `useBoundProp` from `@json-render/react`. Never use the deprecated `useStateBinding`:
```tsx
import { defineRegistry, useBoundProp } from "@json-render/react";
import { verifiedCatalog } from "./catalog";

export const { registry } = defineRegistry(verifiedCatalog.catalog, {
  components: {
    MetricStrip: ({ props }) => (
      <section>
        <h2>{props.heading}</h2>
        <strong>{props.primaryValue}</strong>
        <span>{props.uptimePercent}%</span>
      </section>
    ),
  },
  actions: {},
});
```

### C. Spec Format & Built-In Actions
- The React renderer consumes the flat `Spec` structure:
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
2. **Bounded Fuzzing Runs:** Default `fast-check` `numRuns` to `100` in standard CI/Vitest runs (completing in `< 1.5s`) with configurable high-intensity seeds (`500+` runs) on demand. `runCatalogInvariantSuite()` uses `50` runs per property when no `numRuns` is passed.
3. **Memory-Safe Streaming:** Stream buffers and state history ring buffers must enforce strict upper bounds (default max `128` snapshots via `maxHistory`, max `500` elements per spec, max tree depth `16`).
