# `@genui-studio/core`

The reusable Generative UI Skeleton Engine for **GenUI Studio**, built atop `@json-render/core` (`v0.22.0`) and `@json-render/react` (`v0.22.0`).

## Key Capabilities

- **`createVerifiedCatalog` & `auditCatalogRegistryParity`**: Canonicalizes component and action schemas so `catalogHash` and `catalog.prompt()` are 100% deterministic and invariant to key insertion order.
- **`createGuardrailedStreamCompiler`**: Chunk-boundary-invariant RFC 6902 JSONL stream compiler with prototype pollution blocking (`__proto__`, `constructor`, `prototype`), primitive traversal protection, and live observability.
- **`inspectSpecGraph` & `sanitizeSpecGraph`**: $O(V + E)$ 3-color DFS cycle detector and idempotent DAG sanitizer across both `children` and named `slots`.
- **`createTimeTravelStateStore`**: Structural-sharing bidirectional `StateStore` (`immutableSetByPath`) with deterministic batch `update()`, `undo()`/`redo()`/`jumpToSnapshot()`, and a synchronous `watch` cascade circuit breaker.
- **`wrapRegistryWithTelemetry` & `SafeGenUIRenderer`**: Per-element Zod prop auto-healing (`DiagnosticHealedBadge`) and granular React Error Boundary isolation (`ElementFaultCard`).
- **`@genui-studio/core/testing`**: Converts any registered Zod Component Catalog into `fast-check` Arbitraries (`zodTypeToArbitrary`, `catalogToSpecArbitrary`, `runCatalogInvariantSuite`).
