# Hackathon Submission: WizFrame (`GenUI-kit`)

**Product:** **WizFrame — Interactive UI Workbench**  
**Repository:** [github.com/NOBA235/GenUI-kit](https://github.com/NOBA235/GenUI-kit) *(MIT License — [`LICENSE`](./LICENSE))*  
**Summary:** **WizFrame turns a creative brief or wireframe into an interactive UI, lets you inspect and test the behavior behind it, and exports the result as a runnable app or reusable agent skill.**  
**Prerequisites:** `Node.js >= 22.18.0`, `pnpm@9.15.0` (core workbench, Excalidraw compiler, Pivot Macros, playtest fuzzer, and exports all run offline with zero API keys; BYO-LLM streaming is optional).

---

## 1. What WizFrame Does (One Coherent Workbench)

Most wireframe or generative UI tools stop at static boxes. WizFrame adds an inspectable, testable behavioral layer built on [`@genui-studio/core`](./packages/genui-core) and `@json-render` `v0.22.0`:

1. **Create or edit a brief, spec, or wireframe** — Open `/play` (preloaded with **Signal Relay Vault**), reshape it offline with deterministic **Pivot Macros**, compile an Excalidraw sketch in **Wireframe Architect** (`/preview/product-landing-starter?wireframe=sample`, zero LLM calls), or optionally stream a **Quick Vibe** / **Master Prompt (`.md`)** through your own LLM endpoint.
2. **Inspect and configure interaction rules** — Behavior is represented as sanitized declarative `Trigger -> Guard -> Effect` rules (`RuleInspectorDrawer` supports rule toggles, sanitized JSON editing, and Master Prompt traceability).
3. **Play the experience and watch rules fire** — Click, drag-and-drop (or click-to-pick-up/drop), press keys, and run timers through `InteractionSurface` → `InteractionRuleEngine` → `TimeTravelStateStore` with procedural Web Audio cues. Switch to **Live Flow Map** (`FlowMapView.tsx`) to watch fired rules and edges pulse, and scrub backward/forward across history snapshots.
4. **Fuzz-test outcomes and replay a trace** — Click **Verify Winnability** to run `fast-check` playtest fuzzing (`fuzzPlaytestSpec`), verify whether `win` / `lose` outcomes are reachable without crashes or loops, detect dead rules, and click **Auto-Replay Winning Trace** to step through the shortest trace live.
5. **Export in one of two formats from the same workbench:**
   - **Runnable Next.js 15 Starter (`<slug>-nextjs.zip`):** Self-contained App Router project bundling the catalog, React components, `src/template/wireframe.spec.json` + rules, and `app/page.tsx` running `InteractionSurface` + `createInteractionRuleEngine`.
   - **Reusable Agent Skill & Contract Pack (`<slug>-skill-pack.zip`):** `SKILL.md`, `AGENTS.md`, `.kiro/specs/<slug>/{requirements,design,tasks}.md`, `.kiro/steering/visual-intent.md`, `.cursor/rules/genui-spec.mdc`, `wireframe/<slug>.excalidraw.json`, and `contracts/` containing `AppDriver`, a passing `reference-driver.ts`, a failing `production-driver.ts` stub (`NotImplementedError`), and `invariants.pbt.test.ts` with baked fuzzer traces.

---

## 2. 60-Second Judge Walkthrough

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm dev:hub
```

1. **Play & inspect (`/play`):** Open `http://localhost:5175/play` (or click **Play the Signal Relay Vault** on `/`). Click **Charge relay** 3×, drag or click-place **Amber cell** and **Cyan cell** into matching sockets before the 15s timer expires, and click **Open vault** to win.
2. **Time-travel, fuzz & inspect flow:** Scrub the timeline slider back before the win and replay it; switch to **Live Flow Map** to see active rule edges pulse; click **Verify Winnability** and **Auto-Replay Winning Trace**; open **Rules (14)** to toggle or inspect rules.
3. **Try offline editing & export:** Click an offline Pivot Macro (e.g. `+ Add Win Goal`), then click **Export** to download either the **Agent Skill & Contract Pack** or **Runnable Next.js 15 Starter**.
4. **Optional wireframe input & CLI checks:** Open **Open Sample Wireframe in Workbench** (`/preview/product-landing-starter?wireframe=sample`) to test zero-LLM Excalidraw compilation and `<WireframeDiagnosticsStrip />`, or run:
   ```bash
   npx genui-studio export-skill saas-dashboard-starter --out ./skill-pack.zip
   npx genui-studio fuzz ./path/to/behavioral.spec.json --runs=100 --seed=42 --require-outcome=win
   ```

### Supporting Examples Built on the Same Engine
To demonstrate that [`@genui-studio/core`](./packages/genui-core) generalizes across domains, the repo also includes two standalone Vite example apps (`pnpm dev:ninety9` on `:5176` and `pnpm dev:cmos` on `:5177`) plus four MIT templates in [`packages/templates`](./packages/templates) (`afterdark-horror`, `ninety9-archive`, `cmos-cloud-bios`, `neuro-chimera-synth`). These are supporting examples of the underlying foundation, not separate products.

---

## 3. How Kiro Was Used (One Concrete Engineering Loop)

Kiro's specs ([`.kiro/specs/`](./.kiro/specs/)), steering ([`.kiro/steering/`](./.kiro/steering/)), hooks ([`.kiro/hooks/`](./.kiro/hooks/)), and local power ([`.kiro/powers/json-render-power/`](./.kiro/powers/json-render-power/POWER.md)) guided development without acting as a user-facing feature. Neither Kiro nor property-based testing guarantees universal correctness; they catch concrete regressions early.

**One concrete loop from this repository:**
1. **Steering requirement:** [`.kiro/steering/genui-invariants.md`](./.kiro/steering/genui-invariants.md) defines Invariant 1 (no raw HTML injection: `dangerouslySetInnerHTML`, `innerHTML`, `eval`) and Invariant 7 (stable React hook order across valid, healed, and faulted renders).
2. **Automated enforcement & defect caught:** During SSR hydration review, `<SafeElementInvoker>` in [`safe-renderer.tsx`](./packages/genui-core/src/boundary/safe-renderer.tsx) was found calling registry components as plain functions during SSR (running child hooks on the wrapper fiber and breaking `React.memo`). When adding a hydration regression test, [`eslint.config.mjs`](./eslint.config.mjs) (`pnpm -r lint`) also blocked an `innerHTML` assignment in the test harness.
3. **Fix & regression gate:** `<SafeElementInvoker>` was fixed to always render `<ComponentToRender {...renderProps} />` on its own React fiber, the test was rewritten using `DOMParser` + `replaceChildren` in [`safe-renderer-dom.test.tsx`](./packages/genui-core/src/__tests__/safe-renderer-dom.test.tsx), and [`catalog-audit.mjs`](./.kiro/hooks/scripts/catalog-audit.mjs) + [`run-pbt-suite.mjs`](./.kiro/hooks/scripts/run-pbt-suite.mjs) run automatically via `.kiro/hooks/` and CI.

Other concrete bugs caught by review and tests:
- **Circular Skill Pack tests:** Prevented by shipping dual `AppDriver` implementations (`reference-driver.ts` passes; `production-driver.ts` throws `NotImplementedError` until wired), verified by unpacking a real `.zip` and running Vitest twice in [`skill-pack-exporter.test.ts`](./packages/templates/src/__tests__/skill-pack-exporter.test.ts).
- **Locale-dependent wireframe ordering:** `localeCompare` caused Danish (`da`) collation to flip sibling order; fixed with UTF-16 code-point tie-breaking (`compareCodePoints`) and locked by [`wireframe-proof.test.ts`](./apps/studio-hub/src/__tests__/wireframe-proof.test.ts).
- **Pivot macro outcome guard bug:** Countdown macros initially guarded on `/outcome` instead of `/experience/outcome`, allowing a timer to overwrite a win; fixed in [`pivot-macros.ts`](./apps/studio-hub/src/lib/pivot-macros.ts) and verified in [`playable-starter.test.ts`](./apps/studio-hub/src/__tests__/playable-starter.test.ts).

---

## 4. Verification Commands & Honest Status

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

| Capability | Status | Evidence / Notes |
| :--- | :---: | :--- |
| **Playable `/play` Workbench, Flow Map, Time-Travel, Fuzz & Dual Exports** | **Implemented & Tested** | [`playable-workbench.e2e.test.tsx`](./apps/studio-hub/src/__tests__/playable-workbench.e2e.test.tsx) + [`playable-starter.test.ts`](./apps/studio-hub/src/__tests__/playable-starter.test.ts) (`10` tests: real DOM clicks/drag-drop to win, history scrub/replay, fuzzer + auto-replay, pulsed Flow Map, Edit mode, Skill Pack & Next.js exports) |
| **Declarative Interaction Engine, Web Audio Synth & `fast-check` Fuzzer** | **Implemented & Tested** | [`interaction-engine.pbt.test.ts`](./packages/genui-core/src/__tests__/interaction-engine.pbt.test.ts) (`7` tests; `packages/genui-core` total: `5` files, `29` tests) |
| **Agent Skill & Contract Pack Exporter + CLI (`export-skill`, `fuzz`, `validate`)** | **Implemented & Tested** | [`skill-pack-exporter.test.ts`](./packages/templates/src/__tests__/skill-pack-exporter.test.ts) (`11` tests, unpacked `.zip` dual-driver Vitest gate) + [`cli.test.ts`](./packages/genui-cli/src/__tests__/cli.test.ts) (`21` tests) |
| **Zero-LLM Excalidraw Compiler & Wireframe Journey** | **Implemented & Tested** | [`wireframe-proof.test.ts`](./apps/studio-hub/src/__tests__/wireframe-proof.test.ts) (`8` tests) + `AUDIT_OK` static Rollup bundle audit + [`workbench-journey.e2e.test.tsx`](./apps/studio-hub/src/__tests__/workbench-journey.e2e.test.tsx) (`7` tests) |
| **BYO-LLM Streaming Client, Master Prompt Extraction & Offline Pivot Macros** | **Optional / Simulated in CI** | [`llm-architect.test.ts`](./apps/studio-hub/src/__tests__/llm-architect.test.ts) (`8` tests using deterministic chunked `ReadableStream` test doubles for OpenAI/Yantra & Gemini SSE, rollback, constraints, zero-key guard, and all 4 offline macros) |
| **Live Remote LLM Calls (Yantra AI / OpenAI / OpenRouter / Gemini / Ollama)** | **Unverified in CI** | Requires user credentials in `.env.local` (copied from [`.env.example`](./.env.example)) or a local Ollama server |
| **Foundation Example Apps (`ninety9-archive`, `cmos-cloud-bios`, templates)** | **Implemented & Tested** | `packages/templates` (`8` files, `63` tests), `apps/ninety9-archive` (`2` tests), `apps/cmos-cloud-bios` (`2` tests) — workspace total: **23 test files, 163 tests** |
