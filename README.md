# WizFrame — Interactive UI Workbench

[![CI](https://github.com/NOBA235/GenUI-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/NOBA235/GenUI-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js >= 22.18.0](https://img.shields.io/badge/node-%3E%3D22.18.0-brightgreen.svg)](./package.json)
[![TypeScript 5.7 Strict](https://img.shields.io/badge/TypeScript-5.7%20Strict-3178C6.svg)](./tsconfig.base.json)

**Static wireframes and AI mockups break the moment someone clicks, drags, or hits an edge case.**
**WizFrame turns a creative brief or wireframe into a playable, rule-driven UI, fuzz-tests whether its outcomes are actually reachable, and exports the verified result as a runnable Next.js app or reusable Agent Skill Pack.**

Runs **100% offline with zero API keys** (BYO-LLM streaming is optional). Built in the `GenUI-kit` TypeScript monorepo on [`@genui-studio/core`](./packages/genui-core) and [`@json-render`](https://github.com/vercel-labs/json-render) `v0.22.0`.

---

## 1. Quick Start (60 Seconds, Offline)

Requires Node.js `>= 22.18.0` and `pnpm@9.15.0`:

```bash
git clone https://github.com/NOBA235/GenUI-kit.git
cd GenUI-kit
pnpm install --frozen-lockfile
pnpm -r build
pnpm dev:hub
```

Open **`http://localhost:5175/play`** to launch the interactive workbench immediately.

---

## 2. Core Workflow: Play, Inspect, Fuzz-Test, Export

WizFrame replaces static handoffs with one 5-step loop demonstrated out of the box by **Signal Relay Vault** ([`playable-starter.ts`](./apps/studio-hub/src/lib/playable-starter.ts), `14` declarative `Trigger -> Guard -> Effect` rules, zero ad-hoc component state):

1. **Author or start from a spec/wireframe** — Start on `/play` with Signal Relay Vault, edit structure offline with **Pivot Macros** ([`pivot-macros.ts`](./apps/studio-hub/src/lib/pivot-macros.ts)), draw in Excalidraw **Wireframe Architect** (`/preview/product-landing-starter?wireframe=sample`, deterministic zero-LLM compiler), or optionally stream a **Quick Vibe** / **Master Prompt (`.md`)** via your own LLM key.
2. **Play the live experience** — Click **Charge relay** 3× (or press `C`), drag (or click-to-pick-up/drop) **Amber cell -> Amber socket** and **Cyan cell -> Cyan socket** (wrong socket subtracts `5s`), and click **Open vault** before the `15s` timer hits `0` to reach `outcome: "win"`.
3. **Inspect rules & time-travel state** — Open **Rule Inspector** to toggle or edit rules, watch fired rules pulse on the **Live Flow Map**, and scrub the timeline slider backward through `TimeTravelStateStore` snapshots.
4. **Fuzz-test reachability & auto-replay a winning trace** — Click **Verify Winnability** to run `300` randomized `fast-check` sessions (`fuzzPlaytestSpec`), verify `win` / `lose` reachability without crashes or rule loops, surface dead rules, and click **Auto-Replay Winning Trace** to watch the shortest discovered trace replay step-by-step.
5. **Export from one dialog** — Choose either output format for the exact same blueprint:

| Export Format | Artifact | What You Get |
| :--- | :--- | :--- |
| **Runnable Next.js 15 Starter** | `<slug>-nextjs.zip` | Self-contained Next.js 15 App Router project bundling the Zod catalog, components, `src/template/wireframe.spec.json`, and `app/page.tsx` running `InteractionSurface` + `createInteractionRuleEngine` inside `<SafeGenUIRenderer>`. |
| **Reusable Agent Skill & Contract Pack** | `<slug>-skill-pack.zip` | `SKILL.md`, `AGENTS.md`, `.kiro/specs/<slug>/{requirements,design,tasks}.md`, `.cursor/rules/genui-spec.mdc`, `wireframe/<slug>.excalidraw.json`, and executable `contracts/invariants.pbt.test.ts` carrying the fuzzer's discovered traces. |

Inside an unpacked Skill Pack, coding agents verify their real implementation against the exact spec behavior:

```bash
# 1. Bundled reference model passes (exits 0)
GENUI_DRIVER_TARGET=reference npx vitest run contracts/invariants.pbt.test.ts

# 2. Default production target fails with NotImplementedError until your real app is wired
npx vitest run contracts/invariants.pbt.test.ts
```

---

## 3. Shared-Core Proof: Two Standalone Apps, One Runtime

To show that the foundation examples share one engine rather than copy-pasted app code, both standalone apps under `apps/` import the exact same `@genui-studio/core` + `@genui-studio/templates` pipeline with zero dependency on `apps/studio-hub`:

| Standalone App | Entry File | Shared `@genui-studio/core` Primitives Imported | Run Locally |
| :--- | :--- | :--- | :--- |
| **NINETY9** (1997 Monochrome Archive & 1-Bit Arcade) | [`apps/ninety9-archive/src/App.tsx`](./apps/ninety9-archive/src/App.tsx) | `createGuardrailedStreamCompiler`, `createTimeTravelStateStore`, `createTelemetryTracker`, `SafeGenUIRenderer`, `specToJsonlStream`, `wrapRegistryWithTelemetry` + `getTemplateBySlug`, `scopeTemplateCss` | `pnpm dev:ninety9` (`:5176`) |
| **BIOS // NECROMANCER** (1994 CMOS Utility + 3D PCB IaC Compiler) | [`apps/cmos-cloud-bios/src/App.tsx`](./apps/cmos-cloud-bios/src/App.tsx) | Identical 6 `@genui-studio/core` imports + identical `getTemplateBySlug`, `scopeTemplateCss` isolation pipeline | `pnpm dev:cmos` (`:5177`) |

Additional MIT examples bundled in [`packages/templates`](./packages/templates): `product-landing-starter`, `saas-dashboard-starter`, `afterdark-horror`, and `neuro-chimera-synth`.

---

## 4. Kiro Spec-to-Guardrail Loop (Concrete Example)

Every engineering guardrail in this repository is checked into [`.kiro/`](./.kiro) and executed on every push in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml):

1. **Steering requirement:** [`.kiro/steering/genui-invariants.md`](./.kiro/steering/genui-invariants.md) Invariants 1 & 7 prohibit raw HTML/JSX evaluation (`dangerouslySetInnerHTML`, `eval`, `new Function`) and require per-element React fault isolation without crashing the host tree.
2. **Automated enforcement & real catch:** [`eslint.config.mjs`](./eslint.config.mjs) and [`.kiro/hooks/scripts/catalog-audit.mjs`](./.kiro/hooks/scripts/catalog-audit.mjs) scan `192` files across catalogs and safe boundaries on every CI run. During SSR verification, `renderToString` caught a real hook/fiber crash caused by `SafeElementInvoker` calling component renderers as plain functions instead of React components.
3. **Fix & regression gate:** Fixed in [`safe-renderer.tsx`](./packages/genui-core/src/boundary/safe-renderer.tsx) (`React.createElement(SafeElementInvoker, ...)`), locked by [`safe-renderer-dom.test.tsx`](./packages/genui-core/src/__tests__/safe-renderer-dom.test.tsx), and continuously re-verified by `pnpm -r test` + Kiro hook scripts in CI.

*(Calibration: Kiro hooks and `fast-check` property suites test bounded samples and structural invariants; they do not prove the absence of all bugs across infinite inputs.)* See [`SUBMISSION.md`](./SUBMISSION.md) for the full hackathon summary.

---

## 5. Verification & Honest Boundaries

Every push runs [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) on Node 24 (`pnpm install --frozen-lockfile`, workspace script check, `build`, `typecheck`, `lint`, `test`, `catalog-audit.mjs`, and `run-pbt-suite.mjs`). Reproduce locally:

```bash
node scripts/check-workspace-scripts.mjs && pnpm -r build && pnpm -r typecheck && pnpm -r lint && pnpm -r test
node .kiro/hooks/scripts/catalog-audit.mjs
node .kiro/hooks/scripts/run-pbt-suite.mjs
node apps/studio-hub/scripts/audit-wireframe-compiler.mjs
```

- **Verified offline in tests (`23` test files, `163` tests):** interaction engine, 32-step circuit breaker, time-travel rewind, `fast-check` playtest fuzzing, `jsdom` DOM gameplay to `win`, unpacked Skill Pack Vitest execution, unpacked Next.js starter render, chunked SSE stream parsing + rollback, zero-LLM Excalidraw compilation determinism, and SSR/client hydration parity.
- **Optional & unverified in CI:** Live remote BYO-LLM provider calls (OpenAI-compatible / Gemini / Ollama) require user credentials and are **not** executed in automated CI (streaming & rollback are tested against chunked `ReadableStream` test doubles). Custom React components supplied in a catalog registry are trusted app code and are not sandboxed.

---

<details>
<summary><strong>Developer Reference: CLI, Optional BYO-LLM Setup, Workspace Packages & Safety Bounds</strong></summary>

### CLI (`genui-studio`)

Internal package identifiers (`@genui-studio/*`, `genui-studio`) are preserved for import stability:

```bash
npx genui-studio list
npx genui-studio validate ./path/to/spec.json
npx genui-studio fuzz ./contracts/wireframe.spec.json --runs=100 --seed=42 --require-outcome=win
npx genui-studio export-skill saas-dashboard-starter --out ./skill-pack.zip
npx genui-studio export saas-dashboard-starter --out ./starter.zip
```

### Optional BYO-LLM Authoring (`Quick Vibe` & `Master Prompt (.md)`)

Freeform streaming in [`llm-architect.ts`](./apps/studio-hub/src/lib/llm-architect.ts) is strictly optional—there is no fake offline NLP parser (`LlmConfigurationRequiredError` appears when unconfigured). Supports OpenAI-compatible endpoints (OpenAI, OpenRouter, Yantra AI `https://api.aitklabs.in/v1`, local Ollama `http://localhost:11434/v1`) and Google Gemini SSE with transactional snapshot rollback on stream error. **Master Prompt (`.md`)** mode preserves non-UI backend/DB/auth constraints verbatim in `CONSTRAINTS:` and immediately runs `fuzzPlaytestSpec` to flag unreachable `deadRules`.

To route keys through the Vite dev proxy (`POST /api/architect/stream`, auto-detected via `GET /api/architect/status`), copy [`.env.example`](./.env.example) to `.env.local` (gitignored), set `GENUI_LLM_API_KEY`, and restart `pnpm dev:hub`.

### Offline Excalidraw Wireframe Compiler

Open `/preview/product-landing-starter?wireframe=sample` to draw catalog-backed blocks and arrows in Excalidraw. [`compileExcalidrawToGenUI`](./apps/studio-hub/src/lib/excalidraw-compiler.ts) compiles deterministically with zero network/LLM calls (enforced by [`audit-wireframe-compiler.mjs`](./apps/studio-hub/scripts/audit-wireframe-compiler.mjs)) and reports healed props and ignored tags in `<WireframeDiagnosticsStrip />`.

### Workspace Packages

| Workspace | Package | Role |
| :--- | :--- | :--- |
| [`packages/genui-core`](./packages/genui-core) | `@genui-studio/core` | Verified Zod catalogs, 3-color DFS DAG sanitizer, guardrailed JSONL stream compiler, `TimeTravelStateStore`, `InteractionRuleEngine`, `InteractionSurface`, Web Audio synth, `<SafeGenUIRenderer>`, and `fast-check` playtest fuzzer (`@genui-studio/core/testing`). |
| [`packages/templates`](./packages/templates) | `@genui-studio/templates` | Skill Pack & Next.js 15 `.zip` exporters, scoped `@scope` CSS isolation, and MIT starter/example templates. |
| [`packages/genui-cli`](./packages/genui-cli) | `genui-studio` | CLI for `validate`, `fuzz`, `export-skill`, `export`, `add`, and `list`. |
| [`apps/studio-hub`](./apps/studio-hub) | `@genui-studio/studio-hub` | The **WizFrame** web app (`/play` workbench, `/` overview, `/preview/:slug` scoped preview + Wireframe Architect, Vite `/api/architect/*` proxy). |
| [`apps/ninety9-archive`](./apps/ninety9-archive) | `@genui-studio/app-ninety9-archive` | Standalone example app #1 on `@genui-studio/core`. |
| [`apps/cmos-cloud-bios`](./apps/cmos-cloud-bios) | `@genui-studio/app-cmos-cloud-bios` | Standalone example app #2 on `@genui-studio/core`. |

### Runtime Safety Bounds & Deployment

- **Bounds:** DAG cycle severance, max `64` rules, `16` guards/effects per rule, tree depth `6`, `32` transitions per step, prototype-pollution key rejection (`__proto__`, `constructor`, `prototype`), unsafe URI blocking (`javascript:`, `vbscript:`, `data:text/html`), per-element error boundaries, and `.env*` exclusion from `.zip` exports.
- **Static deploy configs:** [`vercel.json`](./vercel.json), [`netlify.toml`](./netlify.toml), and MIT [`LICENSE`](./LICENSE).

</details>
