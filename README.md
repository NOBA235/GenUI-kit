# WizFrame — Interactive UI Workbench

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js >= 22.18.0](https://img.shields.io/badge/node-%3E%3D22.18.0-brightgreen.svg)](./package.json)
[![TypeScript 5.7 Strict](https://img.shields.io/badge/TypeScript-5.7%20Strict-3178C6.svg)](./tsconfig.base.json)

**WizFrame turns a creative brief or wireframe into an interactive UI, lets you inspect and test the behavior behind it, and exports the result as a runnable app or reusable agent skill.**

Built in the `GenUI-kit` TypeScript monorepo on [`@genui-studio/core`](./packages/genui-core) and [`@json-render`](https://github.com/vercel-labs/json-render) `v0.22.0`, WizFrame is for frontend engineers, product builders, and AI coding-agent users who want to prototype interactive flows, check that state transitions and win/lose conditions actually work, and hand off runnable code or executable contract tests instead of static boxes.

## Quick Start (Runs Offline — Zero API Keys Required)

Requires Node.js `>= 22.18.0` and `pnpm@9.15.0`.

```bash
git clone https://github.com/NOBA235/GenUI-kit.git
cd GenUI-kit
pnpm install --frozen-lockfile
pnpm -r build
pnpm dev:hub
```

Open **`http://localhost:5175/play`** (or open `http://localhost:5175/` and click **Play the Signal Relay Vault**).

---

## The Core Workflow: From Spec to Playable UI to Verified Export

WizFrame organizes prototyping, testing, and handoff into one connected 5-step loop:

1. **Start from a brief, spec, or wireframe** — Open `/play` with the built-in **Signal Relay Vault** starter, edit structure offline with **Pivot Macros**, compile an Excalidraw sketch in **Wireframe Architect** (`/preview/product-landing-starter?wireframe=sample`, zero LLM calls), or optionally stream a **Quick Vibe** / **Master Prompt (`.md`)** through your own LLM endpoint.
2. **Inspect and configure interaction rules** — Every interaction runs as a declarative `Trigger -> Guard -> Effect` rule validated and sanitized before execution (`RuleInspectorDrawer` lets you toggle rules on/off, edit rule JSON, and inspect traced prompt sections).
3. **Play the UI and watch rules fire** — Click, drag-and-drop (or click-to-pick-up/drop), press keys, and run countdown timers in **Playable Preview** while every transition commits to `TimeTravelStateStore`. Switch to **Live Flow Map** to watch fired rules and edges pulse, or scrub backward through history snapshots.
4. **Fuzz-test outcomes and replay a trace** — Click **Verify Winnability** to run `fast-check` randomized playtest sessions (`fuzzPlaytestSpec`), check whether `win` / `lose` outcomes are reachable without crashes or rule loops, surface dead rules, and click **Auto-Replay Winning Trace** to watch the shortest discovered trace play back step-by-step.
5. **Export the result** — Download either a **Runnable Next.js 15 Starter** or a **Reusable Agent Skill & Contract Pack** from the same workbench dialog.

### Concrete Example: Signal Relay Vault (`/play`)

The default starter in `/play` ([`playable-starter.ts`](./apps/studio-hub/src/lib/playable-starter.ts)) is a 15-second control-room puzzle driven by `14` declarative interaction rules and zero ad-hoc component state:

- Click **Charge relay** three times (or press `C`) to reach charge `3/3` — your first move starts the `15s` countdown timer.
- Drag (or click-to-pick-up and drop) **Amber cell** into **Amber socket** and **Cyan cell** into **Cyan socket** (dropping into the wrong socket subtracts `5s`).
- Click **Open vault** while the signal is still alive to transition from scene `main` to `vault` and reach `outcome: "win"`.
- Scrub the timeline slider backward to undo the win, replay it live, open **Live Flow Map** to see which rules fired, click **Verify Winnability** (`300` randomized runs via `fast-check`), and click **Auto-Replay Winning Trace**.

---

## Two Export Formats from One Workbench

Clicking **Export** in `/play` (or in the preview HUD) lets you choose either output from the exact same blueprint:

| Export Format | Output File | What It Gives You |
| :--- | :--- | :--- |
| **Runnable Next.js 15 Starter** | `<slug>-nextjs.zip` | A self-contained Next.js 15 App Router project bundling the active catalog, React components, `src/template/wireframe.spec.json` (with sanitized rules), and `app/page.tsx` running `InteractionSurface` + `createInteractionRuleEngine` inside `<SafeGenUIRenderer>`. |
| **Reusable Agent Skill & Contract Pack** | `<slug>-skill-pack.zip` | `SKILL.md`, `AGENTS.md`, `.kiro/specs/<slug>/{requirements,design,tasks}.md`, `.kiro/steering/visual-intent.md`, `.cursor/rules/genui-spec.mdc`, `wireframe/<slug>.excalidraw.json`, and `contracts/` for Kiro, Cursor, Claude Code, or Codex. |

Inside an unpacked Skill Pack, `contracts/invariants.pbt.test.ts` bakes the fuzzer's discovered shortest traces and runs against a shared `AppDriver` interface:

```bash
# 1. Verify the bundled reference model passes (exits 0)
GENUI_DRIVER_TARGET=reference npx vitest run contracts/invariants.pbt.test.ts

# 2. Default production target fails with NotImplementedError until your IDE agent wires the real app
npx vitest run contracts/invariants.pbt.test.ts
```

---

## Supporting Input & Authoring Paths

These tools feed into the same workbench rather than acting as separate products:

- **Wireframe Input (Offline, Zero LLM):** Open **Open Sample Wireframe in Workbench** (`/preview/product-landing-starter?wireframe=sample`) to draw catalog-backed blocks and labelled arrows in Excalidraw. [`compileExcalidrawToGenUI`](./apps/studio-hub/src/lib/excalidraw-compiler.ts) compiles deterministically into a DAG-sanitized `Spec`, surfaces healed props (e.g., `uptimePercent: 140 -> 100`) and ignored tags in `<WireframeDiagnosticsStrip />`, and makes zero network or LLM calls (audited by [`audit-wireframe-compiler.mjs`](./apps/studio-hub/scripts/audit-wireframe-compiler.mjs)). Pure one-way `.excalidraw.json` export lives in [`spec-to-excalidraw.ts`](./apps/studio-hub/src/lib/spec-to-excalidraw.ts).
- **Offline Pivot Macros (Zero Keys):** Four deterministic structural edits in `/play` ([`pivot-macros.ts`](./apps/studio-hub/src/lib/pivot-macros.ts)): `+ Add Countdown Timer`, `+ Add Win Goal`, `+ Add Drag & Drop`, and `Simplify Unused Nodes`.
- **Optional BYO-LLM Authoring (`Quick Vibe` & `Master Prompt (.md)`):** Freeform streaming in [`llm-architect.ts`](./apps/studio-hub/src/lib/llm-architect.ts) is strictly optional and credential-dependent—there is no fake offline NLP parser (`LlmConfigurationRequiredError` is shown if no endpoint is configured).
  - Supports OpenAI-compatible endpoints (**Yantra AI** `https://api.aitklabs.in/v1`, **OpenAI**, **OpenRouter**, **local Ollama** `http://localhost:11434/v1`) and **Google Gemini** SSE, with transactional snapshot rollback on stream abort or HTTP error.
  - **Master Prompt (`.md`)** mode accepts pasted Markdown PRDs or `.md` uploads, preserves non-UI backend/DB/auth constraints verbatim in `CONSTRAINTS:` (carried into exported `SKILL.md` and `.kiro/specs/<slug>/*`), and runs `fuzzPlaytestSpec` immediately to flag unreachable `deadRules`.
  - To use the server-side Vite dev proxy (`POST /api/architect/stream`) so keys stay out of browser bundles, copy [`.env.example`](./.env.example) to `.env.local` (gitignored), set `GENUI_LLM_API_KEY`, and restart `pnpm dev:hub`. `VibeReframeBar` auto-detects `GET /api/architect/status`.
  - *Honest note:* Live remote provider API calls are **not** executed in automated tests; streaming, error rollback, and sanitization are tested via deterministic chunked `ReadableStream` test doubles.

---

## CLI & Programmatic Engine

The workspace ships a CLI (`genui-studio`) and reusable `@genui-studio/*` packages (package identifiers are kept intact for stability):

```bash
# List starter packs and foundation examples
npx genui-studio list

# Validate a UI Spec JSON or JSONL stream against DAG & safety bounds
npx genui-studio validate ./path/to/spec.json

# Fuzz-test behavioral rules in CI (exits 1 on crashes or unreachable required outcomes)
npx genui-studio fuzz ./contracts/wireframe.spec.json --runs=100 --seed=42 --require-outcome=win

# Export a Skill Pack (.zip) or a runnable Next.js 15 starter (.zip)
npx genui-studio export-skill saas-dashboard-starter --out ./skill-pack.zip
npx genui-studio export saas-dashboard-starter --out ./starter.zip
```

## Foundation Examples (Built on the Same Engine)

To show what the underlying `@genui-studio/core` engine can support beyond the default puzzle starter, the repository includes MIT-licensed reference applications—previewable inside scoped containers in WizFrame or runnable directly:

```bash
pnpm dev:ninety9   # http://localhost:5176 — NINETY9 1997 Monochrome Archive (6 routes + 1-bit arcade)
pnpm dev:cmos      # http://localhost:5177 — BIOS // NECROMANCER 1994 CMOS Utility + 3D PCB IaC Compiler
```

Additional MIT examples inside [`packages/templates`](./packages/templates): `product-landing-starter`, `saas-dashboard-starter`, `afterdark-horror`, and `neuro-chimera-synth`.

---

## Workspace Packages & Architecture

| Workspace | Package | Role |
| :--- | :--- | :--- |
| [`packages/genui-core`](./packages/genui-core) | `@genui-studio/core` | Core runtime: verified Zod catalogs (`createVerifiedCatalog`), 3-color DFS DAG sanitizer, guardrailed JSONL stream compiler, `TimeTravelStateStore`, declarative `InteractionRuleEngine`, `InteractionSurface` DOM bridge, procedural Web Audio synth, `<SafeGenUIRenderer>`, and `fast-check` catalog & playtest fuzzer (`@genui-studio/core/testing`). |
| [`packages/templates`](./packages/templates) | `@genui-studio/templates` | Skill Pack & Contract exporter (`buildSkillPack`, `generateSkillPackZip`), Next.js 15 starter exporter (`generateTemplateZip`), scoped `@scope` CSS container engine, and MIT starter/example templates. |
| [`packages/genui-cli`](./packages/genui-cli) | `genui-studio` | CLI for `validate`, `fuzz`, `export-skill`, `export`, `add`, and `list`. |
| [`apps/studio-hub`](./apps/studio-hub) | `@genui-studio/studio-hub` | The **WizFrame** web application (`/play` interactive workbench, `/` overview & registry, `/preview/:slug` scoped preview & Excalidraw Wireframe Architect, and Vite `/api/architect/stream` dev proxy). |
| [`apps/ninety9-archive`](./apps/ninety9-archive) | `@genui-studio/app-ninety9-archive` | Standalone example app #1 running on `@genui-studio/core`. |
| [`apps/cmos-cloud-bios`](./apps/cmos-cloud-bios) | `@genui-studio/app-cmos-cloud-bios` | Standalone example app #2 running on `@genui-studio/core`. |

---

## Verification & Honest Boundaries

Run the full workspace verification suite locally (matches [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)):

```bash
node scripts/check-workspace-scripts.mjs
pnpm -r build
pnpm -r typecheck
pnpm -r lint
pnpm -r test
node .kiro/hooks/scripts/catalog-audit.mjs
node .kiro/hooks/scripts/run-pbt-suite.mjs
node apps/studio-hub/scripts/audit-wireframe-compiler.mjs
```

- **Implemented & tested:** `23` test files (`163` tests) covering the interaction engine, 32-step circuit breaker, time-travel rewind, `fast-check` playtest fuzzing, real `jsdom` DOM gameplay to `win`, unpacked Skill Pack Vitest execution (`reference` passes, `production` stub fails with `NotImplementedError`), unpacked Next.js starter rendering, chunked SSE stream parsing & rollback, zero-LLM Excalidraw compiler determinism, and SSR/client hydration parity.
- **Safety boundaries enforced:** DAG cycle severance, depth/element/rule/transition budgets (max `64` rules, `16` guards/effects, depth `6`, `32` transitions/step), prototype-pollution key rejection (`__proto__`, `constructor`, `prototype`), unsafe URI blocking (`javascript:`, `vbscript:`, `data:text/html`), ESLint no-raw-HTML rules ([`eslint.config.mjs`](./eslint.config.mjs)), per-element React error boundaries, and `.env*` exclusion from `.zip` exports.
- **Explicit limits & unverified areas:**
  - `fast-check` property tests check bounded random samples and discovered traces; they do **not** prove the absence of all bugs across infinite state spaces.
  - Live remote LLM API calls depend on user credentials or a running local Ollama instance and are not executed in CI.
  - Custom React components supplied in a catalog registry are trusted application code and are not sandboxed.

## Deployment, Kiro Specs & License

- **Static deployment configs:** [`vercel.json`](./vercel.json), [`netlify.toml`](./netlify.toml), [`apps/ninety9-archive/vercel.json`](./apps/ninety9-archive/vercel.json), and [`apps/cmos-cloud-bios/vercel.json`](./apps/cmos-cloud-bios/vercel.json).
- **Hackathon overview & Kiro workflow:** [`SUBMISSION.md`](./SUBMISSION.md) and [`.kiro/`](./.kiro).
- **License:** [MIT](./LICENSE).
