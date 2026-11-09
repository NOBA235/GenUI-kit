# Requirements Specification: `@genui-studio/core` Skeleton Engine

**Spec ID:** `core-skeleton`  
**Status:** Approved for Phase 1 Architecture  
**Syntax Standard:** EARS (Easy Approach to Requirements Syntax — `WHEN` / `WHILE` / `IF` ... `THE SYSTEM SHALL`)  
**Target Package:** `packages/genui-core` (`@genui-studio/core`)

---

## 1. Introduction & Scope
The `@genui-studio/core` package provides the foundational Generative UI skeleton framework built atop Vercel's `@json-render` ecosystem (`@json-render/core@0.22.0` and `@json-render/react@0.22.0`). It solves schema-component-prompt synchronization, streaming RFC 6902 JSONL patch sanitization, Directed Acyclic Graph (DAG) topology verification, bidirectional state store time-travel & watch cascade safety, per-element React Error Boundary isolation, and `fast-check` property-based fuzz testing.

---

## 2. Functional Requirements (EARS Syntax)

### Requirement 1: Catalog Registry & System Prompt Synchronization
**User Story:** As a Principal Systems Engineer, I want React/R3F component implementations, Zod prop schemas, action handlers, and AI system prompts to remain strictly synchronized so that an LLM never generates hallucinated component types or unimplemented actions.

1. **REQ-CAT-01 (Ubiquitous):** THE SYSTEM SHALL define catalogs using `@json-render/core` `defineCatalog(schema, config)` where every component entry contains a `z.ZodType` `props` schema and a non-empty `description`.
2. **REQ-CAT-02 (Event-Driven):** WHEN `createVerifiedCatalog(schema, config)` is invoked, THE SYSTEM SHALL compute a deterministic SHA-256 hex fingerprint (`catalogHash`) derived from the canonicalized component names, Zod JSON Schemas (`catalog.jsonSchema()`), and action definitions.
3. **REQ-CAT-03 (State-Driven):** WHILE binding a catalog to React implementations via `createVerifiedRegistry(catalog, options)`, THE SYSTEM SHALL verify that every component key in `catalog.componentNames` and every custom action key in `catalog.actionNames` has a matching implementation handler.
4. **REQ-CAT-04 (Unwanted Behavior):** IF a `Spec` contains a `UIElement` whose `type` is not registered in `catalog.componentNames`, THEN THE SYSTEM SHALL emit a `SpecIssue` with code `"unknown_component"` and render a non-crashing diagnostic fallback node.
5. **REQ-CAT-05 (Event-Driven):** WHEN `generateSynchronizedPrompt(catalog, options)` is called, THE SYSTEM SHALL generate the `@json-render/core` system prompt (`catalog.prompt(options)`) augmented with explicit DAG topology constraints, RFC 6901 pointer rules, and the catalog version fingerprint.

---

### Requirement 2: Guardrailed RFC 6902 JSONL Stream Patcher & DAG Sanitizer
**User Story:** As an AI Platform Engineer, I want streaming JSONL patches from LLMs to be parsed, validated for prototype pollution and cyclic graph loops, and auto-repaired in real time so that arbitrary streams never freeze or crash the client.

1. **REQ-STR-01 (Event-Driven):** WHEN a raw string chunk is pushed into `GuardrailedStreamCompiler.push(chunk)`, THE SYSTEM SHALL parse complete RFC 6902 JSONL lines via `@json-render/core` `parseSpecStreamLine()` and reject non-patch prose or malformed JSON lines without throwing an unhandled exception.
2. **REQ-STR-02 (Unwanted Behavior):** IF an incoming `JsonPatch` contains a `path` or `from` pointer referencing `__proto__`, `constructor`, or `prototype`, THEN THE SYSTEM SHALL block the patch, record a `"blocked_unsafe_path"` security telemetry event, and leave the current `Spec` unmutated.
3. **REQ-STR-03 (State-Driven):** WHILE streaming is active (`isStreaming === true`), THE SYSTEM SHALL apply `@json-render/core` `autoFixSpec(spec, { lossy: false })` after each batch of patches so that misplaced `visible`, `on`, `repeat`, or `watch` fields inside `element.props` are losslessly hoisted to the `UIElement` level without prematurely pruning in-flight child keys.
4. **REQ-STR-04 (Unwanted Behavior):** IF the flat `Spec` element map (`elements: Record<string, UIElement>`) contains a cycle across `children` or `slots` (e.g., `A -> B -> A` or `A -> A`), THEN THE SYSTEM SHALL detect the cycle in $O(V + E)$ time via 3-color DFS (`inspectSpecGraph`), emit an issue with code `"cyclic_reference"`, and sever the back-edge before passing the `Spec` to the renderer.
5. **REQ-STR-05 (Unwanted Behavior):** IF the `Spec` tree depth exceeds `maxDepth` (default `16`) or total element count exceeds `maxElements` (default `500`), THEN THE SYSTEM SHALL truncate elements beyond the safety budget and emit a `"depth_limit_exceeded"` or `"element_budget_exceeded"` issue.
6. **REQ-STR-06 (Event-Driven):** WHEN `GuardrailedStreamCompiler.finalize()` is called at stream end, THE SYSTEM SHALL run `autoFixSpec(spec, { lossy: true })` followed by `sanitizeSpecGraph(spec)` to prune any remaining dangling child or slot references and guarantee a 100% render-safe DAG.

---

### Requirement 3: Bidirectional State Store, Time-Travel & Watch Cascade Guard
**User Story:** As a Frontend Architect building multi-surface GenUI apps (2D dashboards + 3D R3F scenes), I want a shared, immutable `StateStore` with JSON Pointer addressing, time-travel snapshots, and watch cascade protection so that user inputs and AI state patches synchronize safely across multiple renderers.

1. **REQ-STA-01 (Ubiquitous):** THE SYSTEM SHALL implement the `@json-render/core` `StateStore` interface (`get`, `set`, `update`, `getSnapshot`, `getServerSnapshot`, `subscribe`) using `@json-render/core/store-utils` `immutableSetByPath` for structural sharing.
2. **REQ-STA-02 (Event-Driven):** WHEN `store.set(path, value)` or `store.update(updates)` mutates at least one value by reference (`!==`), THE SYSTEM SHALL append a timestamped state diff entry to a bounded ring buffer (`maxHistory`, default `128`) supporting `undo()`, `redo()`, and `jumpToSnapshot(index)`.
3. **REQ-STA-03 (Unwanted Behavior):** IF a state mutation path targets a forbidden prototype key (`__proto__`, `constructor`, `prototype`) or violates RFC 6901 pointer formatting (missing leading `/` on non-empty path), THEN THE SYSTEM SHALL reject or normalize the pointer safely without polluting `Object.prototype`.
4. **REQ-STA-04 (Unwanted Behavior):** IF cascading `watch` triggers or synchronous state listeners exceed `maxCascadeDepth` (default `10`) within a single execution frame, THEN THE SYSTEM SHALL trip the cascade circuit breaker, halt further synchronous cascade dispatches, and record a `"watch_cascade_overflow"` telemetry event.

---

### Requirement 4: Per-Element Telemetry Error Boundary & Safe Rendering
**User Story:** As a Product Engineer, I want any runtime rendering exception or Zod prop mismatch inside an individual UI component to be isolated to that element's bounding box so that the rest of the application remains interactive.

1. **REQ-BND-01 (State-Driven):** WHILE rendering a `Spec` through `wrapRegistryWithTelemetry(catalog, registry, options)`, THE SYSTEM SHALL validate each element's resolved `props` against its catalog Zod schema and wrap its React render invocation in a granular `<GenUIElementErrorBoundary>`.
2. **REQ-BND-02 (Unwanted Behavior):** IF a component throws a runtime Error during React rendering OR fails strict Zod prop validation in strict mode, THEN THE SYSTEM SHALL catch the error at the element boundary, invoke `onElementFault(faultInfo)`, and render a surgical `<ElementFaultCard>` showing the `elementKey`, `componentType`, and diagnostic message without unmounting parent or sibling elements.
3. **REQ-BND-03 (Event-Driven):** WHEN a subsequent streaming patch or state update repairs the faulty element's props, THE SYSTEM SHALL automatically reset the `<GenUIElementErrorBoundary>` key and resume normal component rendering.

---

### Requirement 5: Property-Based Fuzzing & Formal Verification (`fast-check`)
**User Story:** As a Verification Engineer, I want automated `fast-check` Arbitraries that generate thousands of valid, edge-case, and adversarial `Spec` trees and JSONL patch streams to mathematically prove our rendering invariants.

1. **REQ-FUZ-01 (Ubiquitous):** THE SYSTEM SHALL export `fast-check` Arbitraries (`arbitraryCatalogSpec`, `arbitraryCyclicSpec`, `arbitraryRfc6902PatchStream`, `arbitraryVisibilityCondition`, `arbitraryPropExpression`) from `@genui-studio/core/testing`.
2. **REQ-FUZ-02 (Event-Driven):** WHEN the invariant test suite executes via `vitest run`, THE SYSTEM SHALL verify via `fc.assert(fc.property(...))` that:
   - `sanitizeSpecGraph(spec)` ALWAYS produces a cycle-free DAG (`hasCycles === false`) with depth $\le$ `maxDepth`.
   - `sanitizeSpecGraph(sanitizeSpecGraph(spec).spec).spec` is strictly idempotent.
   - `GuardrailedStreamCompiler` NEVER throws an uncaught exception or pollutes `Object.prototype` for any arbitrary string or JSONL input.
   - `immutableSetByPath` preserves `===` reference identity on all sibling branches not on the modified JSON Pointer path.
