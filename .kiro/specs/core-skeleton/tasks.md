# Implementation Task Plan: `core-skeleton` & Dual-Domain Applications

**Spec ID:** `core-skeleton`  
**Orchestration:** Kiro Spec-Driven Development

---

## Phase 1: Research, Architecture, Licensing & `.kiro` Spec Foundation
- [x] **Task 1.1: Grounded `@json-render` v0.22.0 & `fast-check` v4 API Inspection**
  - Inspect exact type definitions and runtime signatures for `@json-render/core`, `@json-render/react`, `@react-three/fiber`, and `fast-check`.
- [x] **Task 1.2: Repository Root & Monorepo Skeleton Initialization**
  - Create root MIT `LICENSE`, `.gitignore` (explicitly preserving `/.kiro`), `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, and workspace manifests for `packages/genui-core`, `packages/templates`, `packages/genui-cli`, and consumer apps under `apps/`.
- [x] **Task 1.3: Authoritative `.kiro/steering/` Documentation**
  - Author `product.md`, `tech.md`, `structure.md`, and `genui-invariants.md`.
- [x] **Task 1.4: `.kiro/specs/core-skeleton/` EARS Requirements & System Design**
  - Author `requirements.md` (EARS syntax), `design.md` (architecture & algorithms), `correctness.md` (PBT properties), and `tasks.md`.
- [x] **Task 1.5: `.kiro/powers/json-render-power/` & `.kiro/hooks/`**
  - Author `POWER.md`, power steering guides, and automated Kiro workspace hooks (`catalog-schema-sync`, `spec-invariants-test`, `raw-jsx-guard`).

---

## Phase 2: Skeleton Core Engine Implementation (`packages/genui-core`)
- [x] **Task 2.1: Catalog Registry & Prompt Synchronizer (`src/catalog/`)**
  - Implement `createVerifiedCatalog()`, deterministic SHA-256 catalog fingerprinting, `VerifiedCatalog.prompt()`, `VerifiedCatalog.validateFull()`, and `auditCatalogRegistryParity()`.
  - _Maps to:_ `REQ-CAT-01`, `REQ-CAT-02`, `REQ-CAT-03`, `REQ-CAT-04`, `REQ-CAT-05`.
- [x] **Task 2.2: DAG Cycle Detector & Structural Graph Sanitizer (`src/stream/dag-sanitizer.ts`)**
  - Implement 3-color DFS (`inspectSpecGraph`, `sanitizeSpecGraph`) handling `children`, `slots`, cyclic back-edges, self-loops, depth bounds (`maxDepth`), and element count budgets (`maxElements`).
  - _Maps to:_ `REQ-STR-04`, `REQ-STR-05`, `REQ-STR-06`.
- [x] **Task 2.3: Guardrailed RFC 6902 JSONL Stream Compiler (`src/stream/stream-compiler.ts`)**
  - Build an own line buffer on `@json-render/core` `parseSpecStreamLine` (fallback after `JSON.parse`), `applySpecStreamPatch`, and `autoFixSpec` (via `sanitizeSpecGraph`), with RFC 6901 prototype pollution guards (`__proto__`, `constructor`, `prototype`), unsafe URI blocking, lossless streaming auto-fix, and finalization DAG pruning.
  - _Maps to:_ `REQ-STR-01`, `REQ-STR-02`, `REQ-STR-03`, `REQ-STR-06`.
- [x] **Task 2.4: Time-Travel Bidirectional State Store & Watch Cascade Guard (`src/state/time-travel-store.ts`)**
  - Implement `createTimeTravelStateStore()` using `@json-render/core/store-utils` `immutableSetByPath` and `flattenToPointers`, with bounded snapshot history (`undo`, `redo`, `jumpToSnapshot`), pointer normalization, and synchronous cascade depth circuit breaker (`maxCascadeDepth`).
  - _Maps to:_ `REQ-STA-01`, `REQ-STA-02`, `REQ-STA-03`, `REQ-STA-04`.
- [x] **Task 2.5: Per-Element Telemetry Error Boundary & Safe Renderer (`src/boundary/`)**
  - Implement `<GenUIElementErrorBoundary>`, `<ElementFaultCard>`, `wrapRegistryWithTelemetry()`, and `<SafeGenUIRenderer>` with automatic error recovery when element props change.
  - _Maps to:_ `REQ-BND-01`, `REQ-BND-02`, `REQ-BND-03`.
- [x] **Task 2.6: `fast-check` Arbitraries & Formal Invariant Test Suite (`src/testing/` & `src/__tests__/`)**
  - Implement `catalogToSpecArbitrary`, `arbitraryAdversarialSpec`, `arbitraryCorruptedJsonlStream`, and `runCatalogInvariantSuite()`. Execute comprehensive Vitest + `fast-check` verification suite proving DAG acyclicity, idempotence, prototype safety, and structural sharing.
  - _Maps to:_ `REQ-FUZ-01`, `REQ-FUZ-02`.

---

## Phase 3: Consumer Applications on the Shared Skeleton (`apps/`)
- [x] **Task 3.1: Excalidraw-to-GenUI Workbench (`apps/studio-hub`)**
  - Shipped as the visual Wireframe-to-Application Workbench: Excalidraw Wireframe Architect (`compileExcalidrawToGenUI`), Landing & SaaS Dashboard wireframe presets, `<WireframeDiagnosticsStrip />`, scoped `/preview/:slug` preview stage, live JSONL remix, X-Ray PBT inspector, runnable Next.js `.zip` export, and 4 MIT starter applications built with Kiro + GenUI.
- [x] **Task 3.2: Standalone Skeleton Crew Application #1 — NINETY9 Monochrome Archive (`apps/ninety9-archive`)**
  - Independent runnable Vite application mounting all 6 monochrome archive & 1-bit arcade routes directly on `@genui-studio/core` (`SafeGenUIRenderer`, `TimeTravelStateStore`, `GuardrailedStreamCompiler`).
- [x] **Task 3.3: Standalone Skeleton Crew Application #2 — BIOS // NECROMANCER (`apps/cmos-cloud-bios`)**
  - Independent runnable Vite application mounting the 1994 Award CMOS BIOS + 3D WebGL Motherboard Twin + deterministic Cloud IaC Compiler directly on the exact same `@genui-studio/core` runtime.
- [x] **Task 3.4: End-to-End Verification, Build & Test Validation**
  - Verified across all 6 workspace packages (`pnpm -r build`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test` — 18 test files / 120 passing tests, plus `catalog-audit.mjs`, `run-pbt-suite.mjs`, and `audit-wireframe-compiler.mjs`).
