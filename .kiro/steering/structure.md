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
│   │       chimera-frankenstein-rules.md                                                 # inclusion: fileMatch (one per template)
│   ├── specs/                               # EARS Requirements, System Design & Task Plans
│   │   ├── core-skeleton/                   # requirements.md, design.md, correctness.md, tasks.md
│   │   ├── app-spatial-warroom/             # requirements.md, design.md, tasks.md
│   │   └── afterdark/, ninety9-archive/, cmos-cloud-bios/, neuro-chimera-synth/          # one spec per template
│   ├── hooks/                               # Agent hooks (`.kiro/hooks/<id>.json`, schema v1)
│   │   ├── catalog-schema-sync.json, spec-invariants-test.json, raw-jsx-guard.json,
│   │   │   standalone-dropin-ingest.json
│   │   └── scripts/                         # catalog-audit.mjs, run-pbt-suite.mjs (also run by CI)
│   ├── settings/mcp.json                    # Workspace MCP config: genui-studio server (packages/genui-mcp/dist/cli.js)
│   └── powers/                              # Kiro Power for @json-render (install via Powers panel > Import power from a folder)
│       └── json-render-power/
│           ├── POWER.md
│           ├── mcp.json
│           └── steering/
│               ├── react-to-catalog.md
│               └── three-and-mcp-patterns.md
├── packages/
│   ├── genui-core/                          # @genui-studio/core — Reusable Skeleton Engine
│   │   └── src/
│   │       ├── index.ts, types.ts           # Public API exports & shared types
│   │       ├── catalog/                     # Catalog contract & prompt synchronizer
│   │       ├── stream/                      # Guardrailed JSONL patch compiler & DAG sanitizer
│   │       ├── state/                       # Time-travel StateStore & watch cascade guard
│   │       ├── boundary/                    # Per-element React ErrorBoundary & SafeGenUIRenderer
│   │       ├── telemetry/                   # Stream telemetry tracker
│   │       ├── registry/                    # Pack definitions, registry API & license verifier, ZIP generator, TemplateExportModal (also `./registry` export)
│   │       ├── testing/                     # fast-check Arbitraries & invariant runner (`./testing` export)
│   │       └── __tests__/                   # Unit + fast-check property-based fuzz tests
│   ├── genui-cli/                           # `genui-studio` CLI: spec validator, pack installer/exporter
│   ├── genui-mcp/                           # @genui-studio/mcp: MCP server (catalog, validation, fuzzing, OTLP telemetry tools)
│   └── templates/                           # @genui-studio/templates: dual-mode template registry, scoped themes, .zip exporter
│       ├── base-nextjs-shell/               # Next.js shell used by the .zip exporter
│       ├── standalone-sources/              # Ingested Mode B standalone projects
│       └── src/                             # afterdark-horror/, ninety9-archive/, cmos-cloud-bios/, neuro-chimera-synth/,
│                                            # node/, standalone/, registry & exporter modules, *.generated.ts (from scripts/sync-templates.ts)
├── apps/
│   ├── spatial-ops/                         # SpatialOps: 3D/2D OpenTelemetry & SRE Command Center (:5174, OTLP :4318)
│   │   ├── server/                          # OTLP/HTTP collector (cli.ts, otlp-collector.ts) -> dist-server/
│   │   ├── scripts/dev.mjs, examples/emit-otlp-sample.mjs
│   │   └── src/
│   │       ├── catalog/                     # Unified 3D + 2D catalog & registry
│   │       ├── three/                       # R3F scene: SpatialSceneCanvas, spatial components, scene manifest
│   │       ├── telemetry/                   # OTLP client, topology builder, live service mesh bridge
│   │       ├── data/                        # Seeded demo cluster & SRE mutations
│   │       ├── streams/                     # SRE incident JSONL streams & chaos packets
│   │       ├── components/                  # SpatialXRayDrawer (stream inspector & in-browser PBT)
│   │       └── __tests__/
│   └── studio-hub/                          # Studio Hub: template marketplace, /preview/:slug, Wireframe Architect (:5175)
│       └── src/                             # pages/, components/, lib/excalidraw-compiler.ts, __tests__/
├── scripts/                                 # sync-templates.ts, new-template.ts, ingest-standalone.ts, generate-ninety9-assets.ts,
│                                            # fetch-ninety9-photos.mjs, check-workspace-scripts.mjs, verify-mcp.mjs
├── public/images/ninety9/                   # NINETY9 assets (generated SVGs + fetched photos)
└── standalone-dropin/                       # Drop folder watched by the standalone ingestion hook
```

---

## 2. Dependency Direction Rules (Strict DAG)
1. **`packages/genui-core` is the foundational leaf package:**
   - It MAY import from `@json-render/core`, `@json-render/react`, `zod`, `react`, `jszip` (registry ZIP export), and (in `./testing`) `fast-check`.
   - It MUST NEVER import from `packages/templates`, `packages/genui-cli`, `packages/genui-mcp`, `apps/spatial-ops` or `apps/studio-hub`.
   - It MUST NEVER hardcode domain-specific UI components; it operates generically over any `Catalog<TDef, TCatalog>` and `Spec`. Known exception: `src/registry/pack-definitions.ts` embeds the SpatialOps pack catalogs (Zod props and source text, no React implementations) for the CLI installer.
2. **Other packages depend only on `genui-core` (and each other in this order):** `packages/templates` -> `genui-core`; `packages/genui-cli` -> `genui-core`, `templates`; `packages/genui-mcp` -> `genui-core`. `packages/genui-mcp/src/catalogs/spatial-catalog.ts` is a copy of the SpatialOps catalog and must be kept in sync with `apps/spatial-ops/src/catalog/spatial-catalog.ts` by hand.
3. **`apps/spatial-ops` and `apps/studio-hub` are independent consumers:**
   - Consumer apps MUST import their core pipeline primitives (`createVerifiedCatalog`, `createGuardrailedStreamCompiler`, `inspectSpecGraph`, `createTimeTravelStateStore`, `SafeGenUIRenderer`) from `@genui-studio/core`.
   - Consumer apps MUST NEVER import from each other.
4. **`/.kiro` is versioned source-of-truth infrastructure:**
   - Never add `.kiro` to `.gitignore`.
   - Any change to core invariants in `packages/genui-core` must remain aligned with `/.kiro/steering/genui-invariants.md` and `/.kiro/specs/core-skeleton/`.
