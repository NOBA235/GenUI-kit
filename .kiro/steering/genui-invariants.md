---
inclusion: always
---

# GenUI Invariants & Safety Contracts (`genui-invariants.md`)

Every module in `@genui-studio/core` and `apps/spatial-ops` MUST enforce the following 7 runtime and safety invariants. These invariants are continuously checked via `fast-check` property-based tests and Vitest integration suites.

---

## Invariant 1: Zero Raw Code Evaluation (No-JSX / No-HTML Law)
- **Rule:** No LLM stream, JSONL patch, prop expression, or action handler may emit, parse, or render raw JSX, raw HTML strings (`dangerouslySetInnerHTML`), `eval()`, `new Function()`, or inline `<script>` / `javascript:` URIs.
- **Enforcement:**
  - All UI trees are represented strictly as flat `@json-render/core` `Spec` objects (`{ root: string, elements: Record<string, UIElement>, state?: Record<string, unknown> }`).
  - Every string value in element props, patch values and store state that starts with a `javascript:`, `vbscript:` or `data:text/html` scheme is replaced with `"#blocked-unsafe-uri"` (`deepCloneAndSanitizeValue`) before reaching component renderers.
  - ESLint (`eslint.config.mjs`, run by `pnpm -r lint`) rejects `eval`, implied eval, `new Function`, `dangerouslySetInnerHTML`, `innerHTML`/`outerHTML` assignment, `insertAdjacentHTML` and `document.write` in every package.

---

## Invariant 2: Strict Catalog-Registry-Prompt Tri-Synchronization
- **Rule:** Every component key declared in `defineCatalog(schema, { components, actions })` MUST have:
  1. A non-empty `description` string and a strict `z.ZodObject` schema for `props`.
  2. A corresponding implementation function in `defineRegistry(catalog, { components, actions })`.
  3. Deterministic inclusion in `catalog.prompt()` with a verifiable SHA-256 catalog fingerprint.
- **Enforcement:**
  - Unknown component `type` references in a `Spec` are flagged during validation (`unknown_component`) and intercepted by `SafeGenUIRenderer`'s fallback telemetry renderer—never causing an `undefined is not a function` React crash.

---

## Invariant 3: Directed Acyclic Graph (DAG) & Bounded Tree Topology
- **Rule:** Because `@json-render/react` uses a flat element map (`elements: Record<string, UIElement>`) where edges are defined by `children?: string[]` and `slots?: Record<string, string[]>`, a malicious or hallucinated LLM stream can introduce cycles (`A -> B -> A` or self-loop `A -> A`), which would cause recursive rendering to overflow the call stack.
- **Enforcement:**
  - `inspectSpecGraph(spec)` performs a 3-color depth-first traversal (`WHITE`, `GRAY`, `BLACK`) starting from `spec.root` (and scanning all keys in `spec.elements`) across both `children` and `slots`.
  - Any back-edge (`target` is `GRAY`) is detected in $O(V + E)$ time, reported with issue code `"cyclic_reference"`, and deterministically severed by `sanitizeSpecGraph(spec)` before `<Renderer>` receives the spec.
  - Maximum tree depth is bounded by `maxDepth` (default `16`), maximum total elements by `maxElements` (default `500`), recursive JS values by `DEFAULT_MAX_VALUE_DEPTH` (`32`) / `DEFAULT_MAX_VALUE_NODES` (`10_000`) (overridable through `DeepSanitizeLimits.maxDepth` / `maxNodes`), and stream framing by `maxBufferBytes`/`maxLineLength` (`512 KB`), `maxTotalStreamBytes` (`8 MB`), and `maxPatches` (`5_000`).

---

## Invariant 4: RFC 6901 / RFC 6902 Prototype Pollution & Pointer Safety
- **Rule:** Streaming JSON Patches (applied with `applySpecStreamPatch`) and state mutations (`store.set(path, value)`) operate on JSON Pointer paths (`/elements/card-1/props/title`, `/form/email`).
- **Enforcement:**
  - Any JSON Pointer or patch `path` / `from` containing dangerous segments (`__proto__`, `constructor`, `prototype`) is rejected immediately before mutation.
  - All state paths in `$state`, `$bindState`, and `watch` MUST start with a leading `/` (RFC 6901). A safe path without the leading `/` is normalized to `/path` and reported as a healed prop diagnostic; a path with a dangerous segment is rejected.

---

## Invariant 5: Lossless-First Auto-Repair & Idempotence
- **Rule:** LLMs frequently misplace element-level directives (`visible`, `on`, `repeat`, `watch`) inside `element.props`.
- **Enforcement:**
  - During active streaming, the pipeline applies **lossless** repairs (`autoFixSpec(spec, { lossy: false })`) which relocate `visible`, `on`, `repeat`, and `watch` from `props` to the `UIElement` root without pruning children that may still be arriving in subsequent JSONL lines.
  - Upon stream completion (`finalize()`), **lossy** repairs (`autoFixSpec(spec, { lossy: true })` + DAG cycle severance, both inside `sanitizeSpecGraph(spec, { pruneMissingChildren: true })`) prune unresolved dangling child/slot keys so the final rendered spec is 100% structurally sound.
  - **Idempotence Property:** For any arbitrary `Spec` $S$, `sanitizeSpecGraph(sanitizeSpecGraph(S).spec).spec` MUST deeply equal `sanitizeSpecGraph(S).spec` (`sanitizeSpecGraph` runs `autoFixSpec` internally).

---

## Invariant 6: Structural Sharing & Watch Cascade Termination
- **Rule:** Bidirectional state updates via `StateStore` (`set`, `update`) must preserve referential identity for unmodified subtrees (`immutableSetByPath`) and prevent infinite `watch` action loops (`watch: { "/a": { action: "setB" } }` -> `watch: { "/b": { action: "setA" } }`).
- **Enforcement:**
  - State updates use `@json-render/core/store-utils` `immutableSetByPath(snapshot, path, value)` and recursive `deepFreezeValue()` so snapshots and `getHistory()` entries cannot be mutated externally while untouched branches keep their exact `===` object reference.
  - The state store counts nested synchronous listener notifications. A `set()` or `update()` issued at depth `>= maxCascadeDepth` (default `10`) trips the circuit breaker: the write is dropped, `getCascadeTripCount()` increments, and the optional `onCascadeTrip(depth, path)` callback fires. The store itself does not log.

---

## Invariant 7: Per-Element Fault Isolation (Zero White-Screen Guarantee)
- **Rule:** A runtime exception or invalid prop inside a single rendered `UIElement` must NEVER unmount or crash the parent tree or sibling components.
- **Enforcement:**
  - Every component registered through `@genui-studio/core`'s `wrapRegistryWithTelemetry()` isolates component hook execution in the internal `SafeElementInvoker` inside `<GenUIElementErrorBoundary>` alongside Zod prop pre-validation and healing (`validateAndHealProps`), ensuring React Rules-of-Hooks consistency across invalid/valid/error transitions.
  - If an element throws during render, still fails prop validation after healing, or has an unregistered component type (`DefaultUnknownComponentFallback`), only that element's bounding box renders a compact `<ElementFaultCard />` telemetry card displaying the element key, component type, and Zod/runtime diagnostic, while the rest of the dashboard or 3D scene continues operating normally.
