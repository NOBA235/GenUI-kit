---
inclusion: always
---

# Product Steering: GenUI Studio

## 1. Executive Summary & Mission
**GenUI Studio** is a commercial-grade, open-source **Generative UI Skeleton Framework & Verification Workbench** built on Vercel's `@json-render` ecosystem (`@json-render/core`, `@json-render/react`, `@json-render/shadcn`, `@json-render/react-three-fiber`, `@json-render/mcp`) and orchestrated by **Kiro** (Specs, Steering, Hooks, and Powers).

Our mission is to eliminate the two biggest failure modes of production Generative UI:
1. **Schema-Component-Prompt Drift:** Keeping React/R3F component implementations, Zod catalog schemas, action handlers, and LLM system prompts (`catalog.prompt()`) strictly synchronized at compile time and runtime.
2. **Streaming Spec Vulnerability:** Guaranteeing that arbitrary, deeply-nested, or adversarial RFC 6902 JSONL patch streams emitted by an LLM cannot trigger React hydration crashes, cyclic tree infinite loops, prototype pollution, undefined state pointer panics, or full-page white screens of death.

---

## 2. Core Architecture & Skeleton Versatility (Skeleton Crew Compliance)
GenUI Studio is architected as a lean, zero-bloat monorepo skeleton (`@genui-studio/core`) powering **two (2) completely distinct domain applications**:

### A. Skeleton Core (`packages/genui-core` — `@genui-studio/core`)
The framework-level verification, streaming, and resilience engine that wraps `@json-render/core` and `@json-render/react`:
- **Catalog Contract & Prompt Synchronizer:** Enforces 1:1 parity between `defineCatalog()` Zod schemas, `defineRegistry()` React component mappings, and deterministic `catalog.prompt()` generation with SHA-256 schema fingerprinting.
- **Guardrailed JSONL Stream Patcher & DAG Sanitizer:** Wraps `createSpecStreamCompiler()`, `parseSpecStreamLine()`, `applySpecPatch()`, `validateSpec()`, and `autoFixSpec()` with real-time **Directed Acyclic Graph (DAG) cycle detection**, depth/fan-out budget enforcement, and RFC 6901/6902 prototype-pollution path blocking.
- **Bidirectional State Store & Watch Dispatcher:** Extends `createStateStore()` and `@json-render/core/store-utils` (`immutableSetByPath`, `flattenToPointers`) with transaction history, time-travel snapshot ring buffers, and deterministic watcher cascade cycle limits.
- **Per-Element Telemetry Error Boundary (`SafeGenUIRenderer`):** Wraps individual catalog components so a runtime render exception or schema violation isolates the fault to a surgical diagnostic fallback card without collapsing sibling or parent nodes.
- **Property-Based Fuzzing Suite (`@genui-studio/core/testing`):** Built on `fast-check`, providing reusable Arbitraries for `Spec`, `UIElement`, `JsonPatch`, `VisibilityCondition`, and `PropExpression` to mathematically verify rendering invariants.

### B. Application 1: GenUI Studio Verification & Chaos Workbench (`apps/workbench`)
**Domain:** Developer Tools / Formal Verification & AI Protocol Engineering IDE.
- **Purpose:** An interactive engineering workbench for authoring `@json-render` catalogs, compiling live RFC 6902 JSONL streams, inspecting `$state` / `$bindState` / `watch` dataflow, running live `fast-check` property-based chaos fuzzing against catalogs, comparing lossless vs. lossy `autoFixSpec` repairs, and exporting standalone MCP Apps (`@json-render/mcp`).

### C. Application 2: Aegis Spatial Ops & Incident Command Center (`apps/spatial-ops`)
**Domain:** Autonomous Cloud SRE & 3D Infrastructure Topology Command Center.
- **Purpose:** Proves the skeleton core's cross-renderer versatility by uniting **3D WebGL scene graphs** (`@json-render/react-three-fiber` `ThreeCanvas` + `threeComponents`) with **2D incident response runbooks & telemetry controls** (`@json-render/shadcn` + custom SRE widgets) over a **single shared `StateStore`**.
- **Interactive Loop:** AI-streamed JSONL specs simultaneously construct a 3D cluster topology (meshes, lights, labels, pulsing anomaly nodes, camera controls) and a 2D remediation control plane. Mutating a slider, switch, or action button in the 2D runbook (`$bindState`) immediately updates the 3D scene graph in real time, and clicking 3D topology nodes dispatches actions back into the shared state model.

---

## 3. Non-Negotiable Anti-Slop & Craft Standards
1. **Zero Fake Demos:** Every stream, RFC 6902 JSONL patch, `$state`/`$bindState` binding, `VisibilityCondition` evaluation, `autoFixSpec` pass, and `fast-check` property run MUST execute through the real `@genui-studio/core` and `@json-render/*` pipeline. Never use fake `setTimeout` progress bars that bypass the compiler.
2. **Surgical Developer Telemetry Aesthetic:**
   - Visual inspiration: **Linear, Vercel Geist, Raycast, Grafana**.
   - High-contrast obsidian/slate surfaces (`#090A0F`, `#11131A`), crisp `1px` hairline borders (`rgba(255,255,255,0.08)`), monospace tabular telemetry metrics (`JetBrains Mono` / `Geist Mono`), semantic status indicators (emerald `#10B981` for verified invariants, amber `#F59E0B` for lossless auto-fix warnings, crimson `#EF4444` for quarantined DAG/schema faults).
   - **Strictly forbidden:** Halloween clip-art, pumpkin icons, cobwebs, "Creepster" fonts, or novelty theme gimmicks.
3. **Zero Raw JSX/HTML Generation:** AI models and stream compilers must NEVER emit or evaluate raw JSX, HTML strings, `dangerouslySetInnerHTML`, or `eval()`. All UI structure is strictly mediated by flat `Spec` maps validated against Zod catalogs.
