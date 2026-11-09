# Implementation Task Plan: `core-skeleton` & Dual-Domain Applications

**Spec ID:** `core-skeleton`  
**Orchestration:** Kiro Spec-Driven Development

---

## Phase 1: Research, Architecture, Licensing & `.kiro` Spec Foundation (CURRENT PHASE)
- [x] **Task 1.1: Grounded `@json-render` v0.22.0 & `fast-check` v4 API Inspection**
  - Inspect exact type definitions and runtime signatures for `@json-render/core`, `@json-render/react`, `@json-render/shadcn`, `@json-render/react-three-fiber`, `@json-render/mcp`, and `fast-check`.
- [x] **Task 1.2: Repository Root & Monorepo Skeleton Initialization**
  - Create root MIT `LICENSE`, `.gitignore` (explicitly preserving `/.kiro`), `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, and workspace manifests for `packages/genui-core`, `apps/workbench`, and `apps/spatial-ops`.
- [x] **Task 1.3: Authoritative `.kiro/steering/` Documentation**
  - Author `product.md`, `tech.md`, `structure.md`, and `genui-invariants.md`.
- [x] **Task 1.4: `.kiro/specs/core-skeleton/` EARS Requirements & System Design**
  - Author `requirements.md` (EARS syntax), `design.md` (architecture & algorithms), and `tasks.md`.
- [x] **Task 1.5: `.kiro/powers/json-render-power/` & `.kiro/hooks/`**
  - Author `POWER.md`, `mcp.json`, power steering guides, and automated Kiro workspace hooks.

---

## Phase 2: Skeleton Core Engine Implementation (`packages/genui-core`)
- [ ] **Task 2.1: Catalog Registry & Prompt Synchronizer (`src/catalog/`)**
  - Implement `createVerifiedCatalog()`, deterministic SHA-256/FNV-1a catalog fingerprinting, `generateSynchronizedPrompt()`, and `validateSpecAgainstCatalog()`.
  - _Maps to:_ `REQ-CAT-01`, `REQ-CAT-02`, `REQ-CAT-03`, `REQ-CAT-04`, `REQ-CAT-05`.
- [ ] **Task 2.2: DAG Cycle Detector & Structural Graph Sanitizer (`src/stream/dag-sanitizer.ts`)**
  - Implement 3-color DFS (`inspectSpecGraph`, `sanitizeSpecGraph`) handling `children`, `slots`, cyclic back-edges, self-loops, depth bounds (`maxDepth`), and element count budgets (`maxElements`).
  - _Maps to:_ `REQ-STR-04`, `REQ-STR-05`, `REQ-STR-06`.
- [ ] **Task 2.3: Guardrailed RFC 6902 JSONL Stream Compiler (`src/stream/stream-compiler.ts`)**
  - Wrap `@json-render/core` `createSpecStreamCompiler`, `parseSpecStreamLine`, `applySpecPatch`, and `autoFixSpec` with RFC 6901 prototype pollution guards (`__proto__`, `constructor`, `prototype`), unsafe URI blocking, lossless streaming auto-fix, and finalization DAG pruning.
  - _Maps to:_ `REQ-STR-01`, `REQ-STR-02`, `REQ-STR-03`, `REQ-STR-06`.
- [ ] **Task 2.4: Time-Travel Bidirectional State Store & Watch Cascade Guard (`src/state/time-travel-store.ts`)**
  - Implement `createTimeTravelStateStore()` using `@json-render/core/store-utils` `immutableSetByPath` and `flattenToPointers`, with bounded snapshot history (`undo`, `redo`, `jumpTo`), pointer normalization, and synchronous cascade depth circuit breaker (`maxCascadeDepth`).
  - _Maps to:_ `REQ-STA-01`, `REQ-STA-02`, `REQ-STA-03`, `REQ-STA-04`.
- [ ] **Task 2.5: Per-Element Telemetry Error Boundary & Safe Renderer (`src/boundary/`)**
  - Implement `<GenUIElementErrorBoundary>`, `<ElementFaultCard>`, `wrapRegistryWithTelemetry()`, and `<SafeGenUIRenderer>` with automatic error recovery when element props change.
  - _Maps to:_ `REQ-BND-01`, `REQ-BND-02`, `REQ-BND-03`.
- [ ] **Task 2.6: `fast-check` Arbitraries & Formal Invariant Test Suite (`src/testing/` & `src/__tests__/`)**
  - Implement `arbitraryValidSpec`, `arbitraryAdversarialSpec`, `arbitraryPatchStream`, and `runCatalogFuzzSuite()`. Execute comprehensive Vitest + `fast-check` verification suite proving DAG acyclicity, idempotence, prototype safety, and structural sharing.
  - _Maps to:_ `REQ-FUZ-01`, `REQ-FUZ-02`.

---

## Phase 3: Domain Applications Implementation (`apps/workbench` & `apps/spatial-ops`)
- [ ] **Task 3.1: App 1 — GenUI Studio Verification & Chaos Workbench (`apps/workbench`)**
  - Build the surgical developer telemetry IDE featuring:
    1. **Catalog & Prompt Inspector:** Live Zod schema viewer, SHA-256 fingerprint badge, and generated `catalog.prompt()` inspector.
    2. **Live RFC 6902 JSONL Stream Compiler & Editor:** Real-time chunk streaming, patch-by-patch timeline, lossless vs. lossy `autoFixSpec` diff view, and DAG topology inspector.
    3. **In-Browser `fast-check` Chaos Fuzzing Lab:** Interactive property-based test runner that bombards the active catalog with cyclic graphs, prototype pollution payloads, and malformed expressions, displaying pass/quarantine telemetry.
    4. **Time-Travel State & MCP App Exporter:** Live `$bindState` / `watch` state inspector with undo/redo scrubber and one-click `@json-render/mcp` standalone app export.
- [ ] **Task 3.2: App 2 — Aegis Spatial Ops & 3D Incident Command Center (`apps/spatial-ops`)**
  - Build the autonomous SRE & 3D cluster command center featuring:
    1. **Unified 3D + 2D Catalog:** Combines `@json-render/react-three-fiber` (`ThreeCanvas`, `threeComponents`) with `@json-render/shadcn` and custom SRE telemetry components.
    2. **Shared Bidirectional `TimeTravelStateStore`:** 2D incident remediation playbooks (`$bindState` sliders, switches, action buttons, `watch` triggers) directly mutate cluster node states, traffic weights, and replication factors that simultaneously drive the 3D WebGL topology scene (`Box`, `Sphere`, `Cylinder`, `Orbit`, `Pulse`, `HtmlLabel`, `OrbitControls`).
    3. **Live Incident Stream & Fault Quarantine:** Stream multi-step SRE incident response specs via `GuardrailedStreamCompiler` and demonstrate live per-node error boundary quarantine without disrupting the 3D viewport.
- [ ] **Task 3.3: End-to-End Verification, Build & Test Validation**
  - Run full monorepo `pnpm typecheck`, `pnpm test`, `pnpm test:fuzz`, and production Vite builds for both applications.
