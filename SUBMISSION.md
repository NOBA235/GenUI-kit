# Kiroween 2026 Hackathon Submission: GenUI Studio (`GenUI-kit`)

**Product:** GenUI Studio — Wireframe-to-Application Skeleton  
**Category:** **Skeleton Crew**  
**One-Sentence Promise:** **Turn an Excalidraw wireframe or structured `Spec` into a schema-validated, interactive React preview—and export a runnable Next.js starter—powered by one lean `@genui-studio/core` skeleton proven across separate standalone applications.**  
**License:** Open Source ([MIT](./LICENSE))  
**Repository:** [github.com/NOBA235/GenUI-kit](https://github.com/NOBA235/GenUI-kit)  
**Runtime Prerequisites:** `Node.js >= 22.18.0`, `pnpm@9.15.0` (zero API keys or backend services required)  

---

## 🦴 Skeleton Crew Proof: One Foundation → Separate Standalone Applications

The core skeleton lives in [`packages/genui-core`](./packages/genui-core) (`@genui-studio/core`), paired with [`packages/templates`](./packages/templates) and [`packages/genui-cli`](./packages/genui-cli). Across this repository, the **exact same core runtime** powers:

1. **Visual Wireframe-to-Starter Workbench — [`apps/studio-hub`](./apps/studio-hub)** (`pnpm dev:hub`, `:5175`)
   - Compiles **two distinct wireframe archetypes** (**Product Landing** and **SaaS Dashboard**) through the exact same `VerifiedCatalog` (`SiteShell`, `HeroSection`, `MetricStrip`, `FeatureGrid`) and deterministic `compileExcalidrawToGenUI`, previews both live with `$state` bindings and actionable diagnostics, and exports runnable Next.js 15 `.zip` starters.
   - Also lets judges preview and export **all 4 MIT starter applications** built with Kiro + GenUI (`afterdark-horror`, `ninety9-archive`, `cmos-cloud-bios`, `neuro-chimera-synth`).
2. **Standalone Application Folder #1 — [`apps/ninety9-archive`](./apps/ninety9-archive)** (`pnpm dev:ninety9`, `:5176`)
   - **NINETY9 — The Monochrome Archive of the 1990s:** 1997 paper-white monochrome editorial workstation (`6` routes, `34` dossiers across `12` sectors, strict 5-tone monochrome token law, playable 1-bit arcade) mounted directly on `@genui-studio/core`'s `<SafeGenUIRenderer>` and `TimeTravelStateStore`.
3. **Standalone Application Folder #2 — [`apps/cmos-cloud-bios`](./apps/cmos-cloud-bios)** (`pnpm dev:cmos`, `:5177`)
   - **BIOS // NECROMANCER:** 1994 Award Modular CMOS BIOS utility + 3D WebGL motherboard twin (`@react-three/fiber`) + deterministic cloud IaC compiler (`docker-compose.yml`, `vercel.json`, `main.tf`) + FSK modem audio, mounted directly on the exact same `@genui-studio/core` runtime.

---

## ⚡ 60-Second Judge Walkthrough

```bash
# 1. Install and build all 6 workspace packages
pnpm install --frozen-lockfile
pnpm -r build

# 2. Launch the Excalidraw-to-GenUI Workbench (http://localhost:5175)
pnpm dev:hub
```

1. **Open the Product Landing Sample Wireframe:** Click **"Open Sample Wireframe in Workbench"** (`/preview/product-landing-starter?wireframe=sample`, `data-testid="hero-open-sample-wireframe"`).
2. **Observe Deterministic Compilation & Actionable Diagnostics:** `compileExcalidrawToGenUI` ([`excalidraw-compiler.ts`](./apps/studio-hub/src/lib/excalidraw-compiler.ts)) compiles the scene with zero LLM or network calls. `<WireframeDiagnosticsStrip />` immediately flags:
   - Unknown tag `"PricingTable"` → resolved by label to `FeatureGrid`
   - Out-of-range `MetricStrip.uptimePercent` → `healed 140 → 100` (with `<DiagnosticHealedBadge />`)
   - Live arrow binding `/wireframeBindings/selectedPlan` → `HeroSection.summary`
3. **Export Starter #1:** Click **Export** → **Download Next.js Starter (.zip)** to download a runnable Next.js 15 project containing `src/template/wireframe.spec.json`, `app/page.tsx`, `wireframe/product-landing-starter.excalidraw.json`, and `.kiro/specs/product-landing-starter/design.md`.
4. **Switch to the SaaS Dashboard Wireframe:** Click **"SaaS Dashboard"** (`data-testid="wireframe-load-dashboard-btn"`) in the toolbar to compile a KPI-first SaaS dashboard with `/wireframeBindings/activeRegion` through the exact same engine and export a second distinct Next.js starter.
5. **Run the Two Standalone Skeleton Crew App Folders:**
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

### 2. Always-On & `fileMatch`-Scoped Steering ([`.kiro/steering/`](./.kiro/steering/))
- Global steering ([`genui-invariants.md`](./.kiro/steering/genui-invariants.md), [`product.md`](./.kiro/steering/product.md), [`structure.md`](./.kiro/steering/structure.md), [`tech.md`](./.kiro/steering/tech.md), [`spatial-3d-rules.md`](./.kiro/steering/spatial-3d-rules.md)) locked the 7 runtime invariants and strict package dependency DAG.
- Scoped `fileMatch` steering files enforced domain-specific design rules (5-tone monochrome token law for `ninety9-archive`, 60 FPS WebGL/WCAG flash limits for `afterdark-horror`, VGA 16-color/IaC escaping for `cmos-cloud-bios`, and pure Kirchhoff solver rules for `neuro-chimera-synth`) without polluting unrelated packages.

### 3. Automated Agent Hooks & Static Guardrails ([`.kiro/hooks/`](./.kiro/hooks/) & [`eslint.config.mjs`](./eslint.config.mjs))
- **`catalog-schema-sync.json` → [`catalog-audit.mjs`](./.kiro/hooks/scripts/catalog-audit.mjs):** Runs on save and in CI; scans `157` source files across `packages/genui-core`, `packages/templates`, `apps/studio-hub`, `apps/ninety9-archive`, and `apps/cmos-cloud-bios` (`16` catalogs, `17` safe boundaries, `0` Invariant 1 violations).
- **`spec-invariants-test.json` → [`run-pbt-suite.mjs`](./.kiro/hooks/scripts/run-pbt-suite.mjs):** Automatically triggers the `@genui-studio/core` `fast-check` fuzzing suite whenever catalog, stream, state, boundary, or compiler code changes.
- **`raw-jsx-guard.json` + [`eslint.config.mjs`](./eslint.config.mjs):** Enforces Invariant 1 (no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`) and Invariant 7 (`react-hooks/rules-of-hooks`).

### 4. Kiro Power ([`.kiro/powers/json-render-power/`](./.kiro/powers/json-render-power/POWER.md))
- Bundles `@json-render` v0.22.0 catalog conversion patterns, `useBoundProp` two-way binding rules, and React Three Fiber dual-viewport shared state patterns (`steering/react-to-catalog.md`, `steering/three-and-mcp-patterns.md`).

### 5. Real Engineering Defects Caught During Development & Review
| Defect Found | Root Cause & Impact | Fix & Regression Test |
| :--- | :--- | :--- |
| **SSR Hook-Fiber Crash in `SafeElementInvoker`** | Calling registry components directly as functions in SSR ran child hooks on the wrapper fiber and broke `React.memo`. | Always render `<ComponentToRender {...renderProps} />` on its own React fiber ([`safe-renderer.tsx`](./packages/genui-core/src/boundary/safe-renderer.tsx), verified in [`safe-renderer-dom.test.tsx`](./packages/genui-core/src/__tests__/safe-renderer-dom.test.tsx)). |
| **Raw `innerHTML` Blocked by Kiro Invariant 1 Lint** | A hydration test attempted `container.innerHTML = ssrHtml`. | `pnpm -r lint` blocked it; replaced with `DOMParser` + `replaceChildren`. |
| **Locale-Dependent Spatial Sorting** | `compileExcalidrawToGenUI` used `localeCompare`, causing Danish (`da`) locale to reverse `"aa-note"` and `"zz-note"`. | Switched to UTF-16 code-point tie-breaking (`compareCodePoints`), verified in [`wireframe-proof.test.ts`](./apps/studio-hub/src/__tests__/wireframe-proof.test.ts). |
| **Static vs. Live Wireframe Export & Silent Fallbacks** | `.zip` export previously exported static template specs, and unknown tags fell back silently. | Wired `buildWireframeExport()` → `src/template/wireframe.spec.json` + `<WireframeDiagnosticsStrip />` ([`workbench-journey.e2e.test.tsx`](./apps/studio-hub/src/__tests__/workbench-journey.e2e.test.tsx)). |
| **Scope Bloat & Unverified Subsystems** | Earlier iterations mixed an SRE war room (`spatial-ops`), an MCP server, and an unverified external Kiro Crew app bundle. | Dropped SpatialOps, MCP, and external Kiro Crew bundle; promoted 2 distinct MIT apps into standalone `apps/` folders and focused the entire repo on the lean Wireframe-to-Application Skeleton. |

---

## ✅ Reproducible Verification Commands & 100% Verified Status

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
| **5-Step Workbench Flow + 2 Wireframe Archetypes** | **Verified** | [`workbench-journey.e2e.test.tsx`](./apps/studio-hub/src/__tests__/workbench-journey.e2e.test.tsx) (`7` tests, including unpacking & rendering exported `app/page.tsx` and exporting a second SaaS Dashboard starter) |
| **Standalone Skeleton Crew App #1 (`apps/ninety9-archive`)** | **Verified** | [`apps/ninety9-archive/src/__tests__/app.test.tsx`](./apps/ninety9-archive/src/__tests__/app.test.tsx) (`6` routes SSR + parity + PBT) & `vite build` |
| **Standalone Skeleton Crew App #2 (`apps/cmos-cloud-bios`)** | **Verified** | [`apps/cmos-cloud-bios/src/__tests__/app.test.tsx`](./apps/cmos-cloud-bios/src/__tests__/app.test.tsx) (BIOS SSR + parity + PBT) & `vite build` |
| **Core Runtime, SSR Hydration & `fast-check` Fuzzing** | **Verified** | `22` tests in `packages/genui-core` (`hardening`, `healed-provenance`, `safe-renderer-dom`, `invariants.fuzz`) |
| **Deterministic Zero-LLM Compiler Audit** | **Verified** | `8` tests in [`wireframe-proof.test.ts`](./apps/studio-hub/src/__tests__/wireframe-proof.test.ts) + `AUDIT_OK` static Rollup scan |
| **All 4 MIT Starter Apps (`afterdark`, `ninety9`, `cmos`, `chimera`) & CLI** | **Verified** | `52` tests in `packages/templates` + `14` tests in `packages/genui-cli` (`18` test files · `120` passing tests total) |
