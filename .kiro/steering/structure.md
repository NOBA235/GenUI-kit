---
inclusion: always
---

# Monorepo Structure & Architectural Boundaries

## 1. Repository Layout
```text
GenUi-kit/
├── LICENSE                                  # MIT License (Root-level, Skeleton Crew requirement)
├── package.json                             # Monorepo root scripts & workspace config (engines.node >= 22.18.0, pnpm@9.15.0)
├── pnpm-workspace.yaml                      # Workspace package globs (packages/*, apps/*)
├── tsconfig.base.json                       # Shared strict TypeScript compiler settings
├── eslint.config.mjs                        # Shared ESLint flat config (invariant rules) used by every package's `lint`
├── .github/workflows/ci.yml                 # CI: frozen install, script check, build/typecheck/lint/test, Kiro hook scripts
├── .kiro/                                   # Spec-Driven Development & Agentic Orchestration
│   ├── steering/                            # Architectural & invariant rules
│   │   ├── product.md, tech.md, structure.md, genui-invariants.md, spatial-3d-rules.md   # inclusion: always
│   │   └── afterdark-3d-horror.md, ninety9-monochrome-rules.md, cmos-bios-rules.md,
│   │       chimera-frankenstein-rules.md                                                 # inclusion: fileMatch (one per app)
│   ├── specs/                               # EARS Requirements, System Design & Task Plans
│   │   ├── core-skeleton/                   # requirements.md, design.md, correctness.md, tasks.md
│   │   └── afterdark/, ninety9-archive/, cmos-cloud-bios/, neuro-chimera-synth/          # one spec per Kiro + GenUI app
│   ├── hooks/                               # Agent hooks (`.kiro/hooks/<id>.json`, schema v1)
│   │   ├── catalog-schema-sync.json, spec-invariants-test.json, raw-jsx-guard.json,
│   │   │   standalone-dropin-ingest.json
│   │   └── scripts/                         # catalog-audit.mjs, run-pbt-suite.mjs (also run by CI)
│   └── powers/                              # Kiro Power for @json-render (install via Powers panel > Import power from a folder)
│       └── json-render-power/
│           ├── POWER.md
│           └── steering/
│               ├── react-to-catalog.md
│               └── three-and-mcp-patterns.md
├── packages/                                # Reusable Skeleton Foundation (3 packages)
│   ├── genui-core/                          # @genui-studio/core — Reusable Guardrailed GenUI & Behavioral Engine
│   │   └── src/
│   │       ├── index.ts, types.ts           # Public API exports & shared types
│   │       ├── catalog/                     # Catalog contract & prompt synchronizer
│   │       ├── stream/                      # Guardrailed JSONL patch compiler & DAG sanitizer
│   │       ├── state/                       # Time-travel StateStore & watch cascade guard
│   │       ├── interaction/                 # rule-types.ts, guard-eval.ts, rule-engine.ts, synth-audio.ts, dom-bridge.tsx
│   │       ├── boundary/                    # Per-element React ErrorBoundary & SafeGenUIRenderer
│   │       ├── telemetry/                   # Stream telemetry tracker
│   │       ├── registry/                    # Starter pack definitions, registry API, ZIP generator, TemplateExportModal (`./registry`)
│   │       ├── testing/                     # fast-check Arbitraries, catalog invariants & playtest-fuzzer.ts (`./testing`)
│   │       └── __tests__/                   # Unit + fast-check property-based fuzz tests
│   ├── genui-cli/                           # `genui-studio` CLI: validate, fuzz, export-skill, export, add, list
│   └── templates/                           # @genui-studio/templates: Skill Pack & Next.js .zip exporters, 2 starters + 4 apps
│       ├── base-nextjs-shell/               # Next.js 15 shell merged during .zip starter export
│       └── src/                             # afterdark-horror/, ninety9-archive/, cmos-cloud-bios/, neuro-chimera-synth/,
│                                            # skill-pack-{exporter,contracts,docs,types}.ts, showcase-adapters.ts,
│                                            # exporter.ts, base-shell.ts, registry.ts, *.generated.ts
├── apps/                                    # Consumer Applications Built on the Shared Skeleton (3 apps)
│   ├── studio-hub/                          # Playable /play Workbench, BYO-LLM Architect, Wireframe Compiler & 4-App Showcase (:5175)
│   │   ├── vite.config.ts                   # Includes server-side /api/architect/stream & /api/architect/status dev proxy
│   │   ├── scripts/audit-wireframe-compiler.mjs
│   │   └── src/                             # pages/{MarketplacePage,PreviewPage,PlayableWorkbenchPage}.tsx, playable/{catalog,components}.tsx,
│   │                                        # components/{FlowMapView,VibeReframeBar,PlaytestTimelineBar,RuleInspectorDrawer,PlayableStage,PlayableExportDialog,...}.tsx,
│   │                                        # lib/{excalidraw-compiler,llm-architect,pivot-macros,spec-to-excalidraw,playable-starter,playable-session,flow-graph,sample-wireframe}.ts, __tests__/
│   ├── ninety9-archive/                     # Standalone Skeleton Crew App #1: 1997 Monochrome Archive & Arcade (:5176)
│   │   └── src/                             # App.tsx, main.tsx, styles.css, __tests__/app.test.tsx
│   └── cmos-cloud-bios/                     # Standalone Skeleton Crew App #2: 1994 CMOS BIOS + 3D PCB IaC Compiler (:5177)
│       └── src/                             # App.tsx, main.tsx, styles.css, __tests__/app.test.tsx
├── scripts/                                 # sync-templates.ts, new-template.ts, ingest-standalone.ts, generate-ninety9-assets.ts,
│                                            # fetch-ninety9-photos.mjs, check-workspace-scripts.mjs
├── public/images/ninety9/                   # NINETY9 archival assets (generated SVGs + fetched photos)
└── standalone-dropin/                       # Drop folder watched by the standalone ingestion hook
```

---

## 2. Dependency Direction Rules (Strict DAG)
1. **`packages/genui-core` is the foundational leaf package:**
   - It MAY import from `@json-render/core`, `@json-render/react`, `zod`, `react`, `jszip` (registry ZIP export), and (in `./testing`) `fast-check`.
   - It MUST NEVER import from `packages/templates`, `packages/genui-cli`, or any folder under `apps/`.
   - It MUST NEVER hardcode domain-specific UI components; it operates generically over any `Catalog<TDef, TCatalog>` and `Spec`.
2. **Workspace packages depend strictly downward:** `packages/templates` -> `genui-core`; `packages/genui-cli` -> `genui-core`, `templates`.
3. **Consumer apps under `apps/` are independent consumers:**
   - `apps/studio-hub`, `apps/ninety9-archive`, and `apps/cmos-cloud-bios` MUST import their core pipeline primitives (`createVerifiedCatalog`, `createGuardrailedStreamCompiler`, `inspectSpecGraph`, `createTimeTravelStateStore`, `createInteractionRuleEngine`, `SafeGenUIRenderer`) from `@genui-studio/core`.
   - Consumer apps MUST NEVER import from each other.
4. **`/.kiro` is versioned source-of-truth infrastructure:**
   - Never add `.kiro` to `.gitignore`.
   - Any change to core invariants in `packages/genui-core` must remain aligned with `/.kiro/steering/genui-invariants.md` and `/.kiro/specs/core-skeleton/`.
