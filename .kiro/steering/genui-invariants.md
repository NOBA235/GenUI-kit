---
inclusion: always
---

# GenUI Invariants & Safety Contracts (`genui-invariants.md`)

Every module in `@genui-studio/core`, `apps/workbench`, and `apps/spatial-ops` MUST enforce the following 7 formal invariants. These invariants are verified continuously via `fast-check` property-based tests.

---

## Invariant 1: Zero Raw Code Evaluation (No-JSX / No-HTML Law)
- **Rule:** No LLM stream, JSONL patch, prop expression, or action handler may emit, parse, or render raw JSX, raw HTML strings (`dangerouslySetInnerHTML`), `eval()`, `new Function()`, or inline `<script>` / `javascript:` URIs.
- **Enforcement:**
  - All UI trees are represented strictly as flat `@json-render/core` `Spec` objects (`{ root: string, elements: Record<string, UIElement>, state?: Record<string, unknown> }`).
  - String props containing URL/href values (e.g., `Link`, `Image`, `Model`) are sanitized to reject `javascript:`, `data:text/html`, and `vbscript:` schemes before reaching component renderers.

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
  - Maximum tree depth is bounded by `maxDepth` (default `16`) and maximum total elements by `maxElements` (default `500`).

---

## Invariant 4: RFC 6901 / RFC 6902 Prototype Pollution & Pointer Safety
- **Rule:** Streaming JSON Patches (`applySpecPatch` / `applySpecStreamPatch`) and state mutations (`store.set(path, value)`) operate on JSON Pointer paths (`/elements/card-1/props/title`, `/form/email`).
- **Enforcement:**
  - Any JSON Pointer or patch `path` / `from` containing dangerous segments (`__proto__`, `constructor`, `prototype`) is rejected immediately before mutation.
  - All state paths in `$state`, `$bindState`, and `watch` MUST start with a leading `/` (RFC 6901). Malformed relative paths outside a `repeat` scope are caught and reported.

---

## Invariant 5: Lossless-First Auto-Repair & Idempotence
- **Rule:** LLMs frequently misplace element-level directives (`visible`, `on`, `repeat`, `watch`) inside `element.props`.
- **Enforcement:**
  - During active streaming, the pipeline applies **lossless** repairs (`autoFixSpec(spec, { lossy: false })`) which relocate `visible`, `on`, `repeat`, and `watch` from `props` to the `UIElement` root without pruning children that may still be arriving in subsequent JSONL lines.
  - Upon stream completion (or finalization), **lossy** repairs (`autoFixSpec(spec, { lossy: true })` + DAG cycle severance) prune unresolved dangling child/slot keys so the final rendered spec is 100% structurally sound.
  - **Idempotence Property:** For any arbitrary `Spec` $S$, `sanitizeAndFixSpec(sanitizeAndFixSpec(S).spec).spec` MUST deeply equal `sanitizeAndFixSpec(S).spec`.

---

## Invariant 6: Structural Sharing & Watch Cascade Termination
- **Rule:** Bidirectional state updates via `StateStore` (`set`, `update`) must preserve referential identity for unmodified subtrees (`immutableSetByPath`) and prevent infinite `watch` action loops (`watch: { "/a": { action: "setB" } }` -> `watch: { "/b": { action: "setA" } }`).
- **Enforcement:**
  - State updates use `@json-render/core/store-utils` `immutableSetByPath(snapshot, path, value)` so untouched branches keep their exact `===` object reference.
  - The state store tracks causal mutation depth per tick; if cascading `watch` reactions exceed `maxCascadeDepth` (default `10`) within a single synchronous flush window, the cascade circuit breaker trips and logs a structured telemetry warning.

---

## Invariant 7: Per-Element Fault Isolation (Zero White-Screen Guarantee)
- **Rule:** A runtime exception or invalid prop inside a single rendered `UIElement` must NEVER unmount or crash the parent tree or sibling components.
- **Enforcement:**
  - Every component registered through `@genui-studio/core`'s `wrapRegistryWithTelemetry()` is wrapped in a granular React Error Boundary and Zod prop pre-validator.
  - If an element throws during render or fails strict prop coercion, only that element's bounding box renders a compact `<ElementFaultFallback />` telemetry card displaying the element key, component type, and Zod/runtime diagnostic, while the rest of the dashboard or 3D scene continues operating normally.
