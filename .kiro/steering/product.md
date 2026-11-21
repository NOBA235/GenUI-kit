---
inclusion: always
---

# Product Steering: WizFrame — Interactive UI Workbench

## 1. Product Identity & Core Story

> **Product Promise:** **WizFrame turns a creative brief or wireframe into an interactive UI, lets you inspect and test the behavior behind it, and exports the result as a runnable app or reusable agent skill.**

- **User-Facing Brand:** **WizFrame** (*WizFrame — Interactive UI Workbench*).
- **Technical Foundation (Keep Identifiers Intact):** Built in the `GenUI-kit` repository on `@genui-studio/core`, `@genui-studio/templates`, `genui-studio` CLI, and `@json-render` `v0.22.0`. Do not mass-rename `@genui-studio/*` package names or CLI commands.
- **Primary Experience (`/play`, Signal Relay Vault starter):**
  1. Start from a brief, spec, or wireframe (Signal Relay Vault starter, offline Pivot Macros, Excalidraw Wireframe Architect, or optional BYO-LLM Quick Vibe / Master Prompt `.md`).
  2. Inspect and configure declarative `Trigger -> Guard -> Effect` interaction rules (`RuleInspectorDrawer`).
  3. Play the UI (`PlayableStage` + `InteractionSurface` + `InteractionRuleEngine` + `TimeTravelStateStore`) and inspect live rule pulses in **Live Flow Map** (`FlowMapView.tsx`).
  4. Fuzz-test outcome reachability with `fast-check` (`fuzzPlaytestSpec`), catch dead rules, and replay the shortest discovered winning trace (`PlaytestTimelineBar.tsx`).
  5. Export either a **Runnable Next.js 15 Starter** or a **Reusable Agent Skill & Contract Pack** (`PlayableExportDialog.tsx` / `TemplateExportDialog.tsx`).

### Supporting Capabilities (Framing Rule)
Keep the playable workbench as the hero product story. Present all other capabilities as connected supporting parts:
- Excalidraw Wireframe Architect (`/preview/:slug?wireframe=sample`): deterministic zero-LLM input path.
- Quick Vibe & Master Prompt (`.md`): optional, credential-dependent BYO-LLM authoring modes (never claim live provider verification without real tests; keep offline mode first-class).
- Pivot Macros: deterministic offline structural edits.
- Skill Pack & Next.js Starter: two export formats from the same workbench.
- Standalone apps (`apps/ninety9-archive`, `apps/cmos-cloud-bios`) & templates: foundation examples showing what `@genui-studio/core` supports, not competing products.
- `.kiro/` specs, steering, hooks, and tests: engineering workflow used to build WizFrame, not another user-facing feature.

---

## 2. Non-Negotiable Architectural Guardrails

1. **Zero Fake Offline NLP:** Freeform `Quick Vibe` and `Master Prompt (.md)` streaming MUST use the real streaming BYO-LLM client (`apps/studio-hub/src/lib/llm-architect.ts`) with transactional snapshot rollback on abort/error. Offline mode uses curated starters + deterministic Pivot Macros (`apps/studio-hub/src/lib/pivot-macros.ts`); unconfigured freeform submits throw `LlmConfigurationRequiredError`.
2. **Zero-Network Excalidraw Compiler + Separate One-Way Export:** `apps/studio-hub/src/lib/excalidraw-compiler.ts` stays **100% synchronous, zero-network, and zero-LLM** (`node apps/studio-hub/scripts/audit-wireframe-compiler.mjs` exits `0`). One-way `.excalidraw.json` export lives in `apps/studio-hub/src/lib/spec-to-excalidraw.ts`.
3. **Non-Circular Skill Pack Contracts (`AppDriver`):** Exported Skill Packs ship `contracts/app-driver.ts`, `contracts/reference-driver.ts` (passes under `GENUI_DRIVER_TARGET=reference`), and `contracts/production-driver.ts` (stub throwing `NotImplementedError` under `GENUI_DRIVER_TARGET=production` until wired), with fuzzer-discovered traces baked into `contracts/invariants.pbt.test.ts`.
4. **Single Behavioral Runtime:** Interactive previews dispatch through `InteractionSurface` + `InteractionRuleEngine` + `TimeTravelStateStore` rather than ad-hoc component domain state.
5. **Security & Honest Claims:** Enforce DAG cycle severance, depth/element/rule/transition budgets (`64` rules, `16` guards/effects, depth `6`, `32` transitions/step), prototype-pollution & unsafe URI blocking, zero raw HTML (`eslint.config.mjs`), and `.env*` exclusion from bundles and `.zip` exports. Describe `fast-check` suites accurately as property-based tests (never mathematical proofs).
