# Kiroween 2026 Hackathon Submission: GenUI Studio (`GenUI-kit`)

**Product:** GenUI Studio — Verified Behavioral Spec & Universal Agent Skill Compiler  
**Category:** **Skeleton Crew**  
**One-Sentence Promise:** **Turn an Excalidraw wireframe, rough vibe, or Markdown Master Prompt into a schema-validated, fuzz-tested behavioral `Spec`—and export either an executable `AppDriver` Agent Skill Pack for Kiro/Cursor/Claude Code/Codex or a runnable Next.js 15 starter—powered by one lean `@genui-studio/core` skeleton proven across separate standalone applications.**  
**License:** Open Source ([MIT](./LICENSE))  
**Repository:** [github.com/NOBA235/GenUI-kit](https://github.com/NOBA235/GenUI-kit)  
**Runtime Prerequisites:** `Node.js >= 22.18.0`, `pnpm@9.15.0` (zero API keys or backend services required for core compilation, rule execution, fuzzing, Skill Pack export, Pivot Macros, and standalone apps; optional BYO-LLM via Yantra AI / OpenAI / OpenRouter / Gemini / Ollama for freeform vibe or Master Prompt streaming)

---

## 🦴 Skeleton Crew Proof: One Verified Foundation → Separate Standalone Applications & Agent Contracts

The core skeleton lives in [`packages/genui-core`](./packages/genui-core) (`@genui-studio/core`), paired with [`packages/templates`](./packages/templates) and [`packages/genui-cli`](./packages/genui-cli). Static wireframe-to-code tools already generate layout boxes; GenUI Studio adds the missing behavioral verification layer—executing declarative `Trigger -> Guard -> Effect` rules over `TimeTravelStateStore`, playtest-fuzzing reachability via `fast-check`, and exporting non-circular `AppDriver` contract packs alongside runnable Next.js 15 starters.

Across this repository, the **exact same core runtime** powers:

1. **Playable Workbench, Streaming BYO-LLM Architect & Wireframe Compiler — [`apps/studio-hub`](./apps/studio-hub)** (`pnpm dev:hub`, `:5175`)
   - Opens directly into the 5-second playable **Signal Relay Vault** workbench at `/play` ([`PlayableWorkbenchPage.tsx`](./apps/studio-hub/src/pages/PlayableWorkbenchPage.tsx), [`playable-starter.ts`](./apps/studio-hub/src/lib/playable-starter.ts)), where every click, drag-and-drop gesture, hover, keypress, and countdown tick runs through `InteractionSurface` ([`dom-bridge.tsx`](./packages/genui-core/src/interaction/dom-bridge.tsx)) → `InteractionRuleEngine` → `TimeTravelStateStore` (zero ad-hoc component domain state), with clean center-stage tabs for **Playable Preview**, **Live Flow Map** ([`FlowMapView.tsx`](./apps/studio-hub/src/components/FlowMapView.tsx)), and read-only **Excalidraw Source** ([`ExcalidrawSourceView.tsx`](./apps/studio-hub/src/components/ExcalidrawSourceView.tsx)), plus **Play | Edit | Fuzz** history scrubbing & winning-trace replay ([`PlaytestTimelineBar.tsx`](./apps/studio-hub/src/components/PlaytestTimelineBar.tsx)), rule & Master Prompt audit inspection ([`RuleInspectorDrawer.tsx`](./apps/studio-hub/src/components/RuleInspectorDrawer.tsx)), and dual-mode export ([`PlayableExportDialog.tsx`](./apps/studio-hub/src/components/PlayableExportDialog.tsx)).
   - Compiles **two distinct wireframe archetypes** (**Product Landing** and **SaaS Dashboard**) through the exact same `VerifiedCatalog` (`SiteShell`, `HeroSection`, `MetricStrip`, `FeatureGrid`) and deterministic zero-LLM `compileExcalidrawToGenUI`, previews both live with `$state` bindings and actionable diagnostics, and exports runnable Next.js 15 `.zip` starters or Skill Packs ([`TemplateExportDialog.tsx`](./apps/studio-hub/src/components/TemplateExportDialog.tsx)).
   - Pairs [`VibeReframeBar.tsx`](./apps/studio-hub/src/components/VibeReframeBar.tsx) with [`llm-architect.ts`](./apps/studio-hub/src/lib/llm-architect.ts) (chunked `ReadableStream` BYO-LLM SSE client for Yantra AI `https://api.aitklabs.in/v1`, OpenAI, OpenRouter, Gemini, and local Ollama with dual `vibe` + `master-prompt` `.md` upload modes, verbatim `CONSTRAINTS:` capture, `MasterPromptAudit`, and full snapshot rollback on abort/error), server-side dev proxy in [`vite.config.ts`](./apps/studio-hub/vite.config.ts) (`/api/architect/stream`), deterministic offline [`pivot-macros.ts`](./apps/studio-hub/src/lib/pivot-macros.ts), and pure one-way [`spec-to-excalidraw.ts`](./apps/studio-hub/src/lib/spec-to-excalidraw.ts).
   - Also lets judges preview and export **all 4 MIT starter applications** built with Kiro + GenUI (`afterdark-horror`, `ninety9-archive`, `cmos-cloud-bios`, `neuro-chimera-synth`).
2. **Universal Agent Skill & Contract Pack Exporter + CLI — [`packages/templates`](./packages/templates) & [`packages/genui-cli`](./packages/genui-cli)**
   - [`skill-pack-exporter.ts`](./packages/templates/src/skill-pack-exporter.ts) compiles any behavioral `Spec` + `InteractionRule[]` + `CreativeBrief` into a portable pack (`SKILL.md`, `AGENTS.md`, `.kiro/specs/<slug>/{requirements,design,tasks}.md`, `.kiro/steering/visual-intent.md`, `.cursor/rules/genui-spec.mdc`, `contracts/{app-driver.ts,reference-driver.ts,production-driver.ts,wireframe.spec.json,catalog.ts,invariants.pbt.test.ts}`, and `wireframe/<slug>.excalidraw.json`).
   - Eliminates circular contract tests: `contracts/invariants.pbt.test.ts` passes against `contracts/reference-driver.ts` (`GENUI_DRIVER_TARGET=reference`) and **fails with `NotImplementedError`** against `contracts/production-driver.ts` (`GENUI_DRIVER_TARGET=production`) until the AI coding agent builds and wires the real app.
   - Exposed directly via `npx genui-studio export-skill <slug|spec.json>` and `npx genui-studio fuzz <spec.json> --require-outcome=win`.
3. **Standalone Application Folder #1 — [`apps/ninety9-archive`](./apps/ninety9-archive)** (`pnpm dev:ninety9`, `:5176`)
   - **NINETY9 — The Monochrome Archive of the 1990s:** 1997 paper-white monochrome editorial workstation (`6` routes, `34` dossiers across `12` sectors, strict 5-tone monochrome token law, playable 1-bit arcade) mounted directly on `@genui-studio/core`'s `<SafeGenUIRenderer>` and `TimeTravelStateStore`.
4. **Standalone Application Folder #2 — [`apps/cmos-cloud-bios`](./apps/cmos-cloud-bios)** (`pnpm dev:cmos`, `:5177`)
   - **BIOS // NECROMANCER:** 1994 Award Modular CMOS BIOS utility + 3D WebGL motherboard twin (`@react-three/fiber`) + deterministic cloud IaC compiler (`docker-compose.yml`, `vercel.json`, `main.tf`) + FSK modem audio, mounted directly on the exact same `@genui-studio/core` runtime.

---

## ⚡ 60-Second Judge Walkthrough

```bash
# 1. Install and build all 6 workspace packages
pnpm install --frozen-lockfile
pnpm -r build

# 2. Launch the Studio Hub Workbench (http://localhost:5175)
pnpm dev:hub
```

1. **Play the Signal Relay Vault in 5 Seconds:** Click **"Play the Signal Relay Vault"** (`/play`) on the storefront hero, click and drag tokens onto drop slots until `outcome === "win"`, scrub backward through `TimeTravelStateStore` history in `PlaytestTimelineBar`, click **Verify Winnability (Fuzz)** and **Auto-Replay Winning Trace**, switch to **Live Flow Map** to watch active rule edges pulse, and export either **Mode A: Universal Agent Skill Pack (.zip)** or **Mode B: Runnable Next.js 15 Starter (.zip)**.
2. **Open the Product Landing & SaaS Dashboard Wireframes:** Click **"Open Sample Wireframe in Workbench"** (`/preview/product-landing-starter?wireframe=sample`, `data-testid="hero-open-sample-wireframe"`). `compileExcalidrawToGenUI` ([`excalidraw-compiler.ts`](./apps/studio-hub/src/lib/excalidraw-compiler.ts)) compiles the scene with zero LLM or network calls, `<WireframeDiagnosticsStrip />` surfaces unknown tags, clamped props (`140 → 100`), and live `$state` arrow bindings, and one click switches to **"SaaS Dashboard"** (`data-testid="wireframe-load-dashboard-btn"`).
3. **Export & Verify a Universal Agent Skill Pack via CLI:**
   ```bash
   npx genui-studio export-skill saas-dashboard-starter --out ./saas-skill-pack.zip
   npx genui-studio fuzz ./path/to/behavioral.spec.json --runs=100 --seed=42 --require-outcome=win
   ```
   Unpack the Skill Pack and confirm `GENUI_DRIVER_TARGET=reference npx vitest run contracts/invariants.pbt.test.ts` passes while the default `production` target fails with `NotImplementedError` until wired to a real production app.
4. **Run the Two Standalone Skeleton Crew App Folders:**
   ```bash
   pnpm dev:ninety9   # http://localhost:5176 — 1997 Monochrome Archive & Arcade
   pnpm dev:cmos      # http://localhost:5177 — 1994 CMOS BIOS & 3D PCB IaC Compiler
   ```

---

## 🤖 How Kiro Was Used (Specs, Steering, Hooks, Powers & PBT)

Every Kiro artifact in [`/.kiro`](./.kiro) directly drove implementation and regression prevention:

### 1. Spec-Driven Development ([`.kiro/specs/`](./.kiro/specs/))
- [`core-skeleton/`](./.kiro/specs/core-skeleton/) defined EARS requirements (`requirements.md`), DAG/boundary architecture (`design.md`), `fast-check` properties (`correctness.md`), and phased implementation tasks (`tasks.md`) before coding `packages/genui-core`.
- Four per-app specs ([`afterdark/`](./.kiro/specs/afterdark/), [`ninety9-archive/`](./.kiro/specs/ninety9-archive/), [`cmos-cloud-bios/`](./.kiro/specs/cmos-cloud-bios/), [`neuro-chimera-synth/`](./.kiro/specs/neuro-chimera-synth/)) structured each application built on the skeleton.
- Exported Skill Packs also generate complete `.kiro/specs/<slug>/{requirements,design,tasks}.md` + `.kiro/steering/visual-intent.md` packages for downstream Kiro workspaces.

### 2. Always-On & `fileMatch`-Scoped Steering ([`.kiro/steering/`](./.kiro/steering/))
- Global steering ([`genui-invariants.md`](./.kiro/steering/genui-invariants.md), [`product.md`](./.kiro/steering/product.md), [`structure.md`](./.kiro/steering/structure.md), [`tech.md`](./.kiro/steering/tech.md), [`spatial-3d-rules.md`](./.kiro/steering/spatial-3d-rules.md)) locked the 7 runtime invariants and strict package dependency DAG.
- Scoped `fileMatch` steering files enforced domain-specific design rules (5-tone monochrome token law for `ninety9-archive`, 60 FPS WebGL/WCAG flash limits for `afterdark-horror`, VGA 16-color/IaC escaping for `cmos-cloud-bios`, and pure Kirchhoff solver rules for `neuro-chimera-synth`) without polluting unrelated packages.

### 3. Automated Agent Hooks & Static Guardrails ([`.kiro/hooks/`](./.kiro/hooks/) & [`eslint.config.mjs`](./eslint.config.mjs))
- **`catalog-schema-sync.json` → [`catalog-audit.mjs`](./.kiro/hooks/scripts/catalog-audit.mjs):** Runs on save and in CI; scans all non-test `.ts`/`.tsx` sources across all packages and apps for Invariant 1 compliance (`0` violations) and verifies all core skeleton modules are intact.
- **`spec-invariants-test.json` → [`run-pbt-suite.mjs`](./.kiro/hooks/scripts/run-pbt-suite.mjs):** Automatically triggers the `@genui-studio/core` `fast-check` fuzzing suite whenever catalog, stream, state, boundary, or compiler code changes.
- **`raw-jsx-guard.json` + [`eslint.config.mjs`](./eslint.config.mjs):** Enforces Invariant 1 (no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`) and Invariant 7 (`react-hooks/rules-of-hooks`).

### 4. Kiro Power ([`.kiro/powers/json-render-power/`](./.kiro/powers/json-render-power/POWER.md))
- Bundles `@json-render` v0.22.0 catalog conversion patterns, `useBoundProp` two-way binding rules, and React Three Fiber dual-viewport shared state patterns (`steering/react-to-catalog.md`, `steering/three-and-mcp-patterns.md`).

### 5. Real Engineering Defects Caught During Development & Review
| Defect Found | Root Cause & Impact | Fix & Regression Test |
| :--- | :--- | :--- |
| **Circular Contract Risk in Skill Packs** | Testing only `wireframe.spec.json` inside exported `invariants.pbt.test.ts` would pass trivially before an AI IDE writes production code. | Introduced dual `AppDriver` pattern (`reference-driver.ts` PASS vs. `production-driver.ts` FAIL with `NotImplementedError`) + baked `shortestTraces` ([`skill-pack-exporter.test.ts`](./packages/templates/src/__tests__/skill-pack-exporter.test.ts)). |
| **Fake Offline NLP & Bidirectional Excalidraw Fragility** | Keyword NLP breaks on real prompts, and mutating Excalidraw canvas state for live rule pulses risks breaking `audit-wireframe-compiler.mjs`. | Replaced with real streaming BYO-LLM client ([`llm-architect.ts`](./apps/studio-hub/src/lib/llm-architect.ts)) with `LlmConfigurationRequiredError` + deterministic offline [`pivot-macros.ts`](./apps/studio-hub/src/lib/pivot-macros.ts) + pure one-way [`spec-to-excalidraw.ts`](./apps/studio-hub/src/lib/spec-to-excalidraw.ts). |
| **SSR Hook-Fiber Crash in `SafeElementInvoker`** | Calling registry components directly as functions in SSR ran child hooks on the wrapper fiber and broke `React.memo`. | Always render `<ComponentToRender {...renderProps} />` on its own React fiber ([`safe-renderer.tsx`](./packages/genui-core/src/boundary/safe-renderer.tsx), verified in [`safe-renderer-dom.test.tsx`](./packages/genui-core/src/__tests__/safe-renderer-dom.test.tsx)). |
| **Locale-Dependent Spatial Sorting** | `compileExcalidrawToGenUI` used `localeCompare`, causing Danish (`da`) locale to reverse `"aa-note"` and `"zz-note"`. | Switched to UTF-16 code-point tie-breaking (`compareCodePoints`), verified in [`wireframe-proof.test.ts`](./apps/studio-hub/src/__tests__/wireframe-proof.test.ts). |
| **Static vs. Live Wireframe Export & Silent Fallbacks** | `.zip` export previously exported static template specs, and unknown tags fell back silently. | Wired `buildWireframeExport()` → `src/template/wireframe.spec.json` + `<WireframeDiagnosticsStrip />` ([`workbench-journey.e2e.test.tsx`](./apps/studio-hub/src/__tests__/workbench-journey.e2e.test.tsx)). |

---

## ✅ Reproducible Verification Commands & Honest Status

```bash
pnpm install --frozen-lockfile
node scripts/check-workspace-scripts.mjs
pnpm -r build
pnpm -r typecheck
pnpm -r lint
pnpm -r test
node .kiro/hooks/scripts/catalog-audit.mjs
node .kiro/hooks/scripts/run-pbt-suite.mjs
node apps/studio-hub/scripts/audit-wireframe-compiler.mjs
```

| Verification Item | Status | Evidence |
| :--- | :---: | :--- |
| **Phase 1: Declarative Interaction Engine, Web Audio Synth & Playtest Fuzzer** | **Verified** | [`interaction-engine.pbt.test.ts`](./packages/genui-core/src/__tests__/interaction-engine.pbt.test.ts) (`7` tests: triggers/guards/effects, 32-step circuit breaker, sanitization, rewind & `once` re-arming, `shortestTraces` + `deadRules`, Web Audio synth, 100-run `fast-check` fuzz) |
| **Phase 2: Universal Agent Skill & Contract Pack Exporter + CLI (`export-skill`, `fuzz`)** | **Verified** | [`skill-pack-exporter.test.ts`](./packages/templates/src/__tests__/skill-pack-exporter.test.ts) (`11` tests, unpacking `.zip` and running Vitest twice: `reference` PASS vs. `production` FAIL with `NotImplementedError`) + [`cli.test.ts`](./packages/genui-cli/src/__tests__/cli.test.ts) (`21` tests) |
| **Phase 3: Streaming BYO-LLM Architect, Dual Vibe/Master Prompt Modes, Pivot Macros & One-Way Excalidraw** | **Verified** | [`llm-architect.test.ts`](./apps/studio-hub/src/__tests__/llm-architect.test.ts) (`8` tests: split-chunk Yantra/OpenAI & Gemini SSE, hostile payload healing, abort/500/stream rollback, Master Prompt → Phase 2 Skill Pack verbatim constraints + `deadRules`, `LlmConfigurationRequiredError`, 4 Pivot Macros, Excalidraw round-trip) |
| **Phase 4: Playable `/play` Workbench UI, `InteractionSurface`, `FlowMapView`, `PlaytestTimelineBar`, `VibeReframeBar`, `RuleInspectorDrawer` & Dual Exports** | **Verified** | [`playable-workbench.e2e.test.tsx`](./apps/studio-hub/src/__tests__/playable-workbench.e2e.test.tsx) + [`playable-starter.test.ts`](./apps/studio-hub/src/__tests__/playable-starter.test.ts) (`10` tests: real DOM click/drag-drop win loop, history rewind/replay, fuzzer & auto-replay, pulsed Flow Map edges, Edit mode, Mode A Skill Pack & Mode B Next.js Starter exports) |
| **Zero-LLM Wireframe Compiler & 5-Step Workbench E2E Flow** | **Verified** | [`wireframe-proof.test.ts`](./apps/studio-hub/src/__tests__/wireframe-proof.test.ts) (`8` tests) + `AUDIT_OK` Rollup scan + [`workbench-journey.e2e.test.tsx`](./apps/studio-hub/src/__tests__/workbench-journey.e2e.test.tsx) (`7` tests) |
| **Core Runtime, SSR Hydration & `fast-check` Fuzzing** | **Verified** | `packages/genui-core` (`5` test files, `29` tests total) |
| **Standalone Skeleton Crew Apps (`apps/ninety9-archive`, `apps/cmos-cloud-bios`) & 4 MIT Starters** | **Verified** | [`apps/ninety9-archive/src/__tests__/app.test.tsx`](./apps/ninety9-archive/src/__tests__/app.test.tsx), [`apps/cmos-cloud-bios/src/__tests__/app.test.tsx`](./apps/cmos-cloud-bios/src/__tests__/app.test.tsx), and `packages/templates` (`8` test files, `63` tests) — **23 test files · 163 passing tests total** |
| **External `pnpm pack` Consumer Tarball Verification** | **Verified** | Clean `%TEMP%` install of `@genui-studio/core`, `@genui-studio/templates`, and `genui-studio` verifying ESM imports, `tsc` NodeNext declarations, `createInteractionRuleEngine`, `InteractionSurface`, `fuzzPlaytestSpec`, `buildSkillPackFiles`, and CLI binary |
| **Live Remote LLM Network Calls (Yantra AI / OpenAI / OpenRouter / Gemini / Ollama)** | **Unverified in CI** | Verified in CI via deterministic chunked `ReadableStream` test doubles; real network calls require user-configured credentials or a local Ollama server |
