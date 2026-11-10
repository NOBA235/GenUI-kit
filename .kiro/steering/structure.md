---
inclusion: always
---

# Monorepo Structure & Architectural Boundaries

## 1. Repository Layout
```text
GenUi-kit/
├── LICENSE                                  # MIT License (Root-level, Skeleton Crew requirement)
├── package.json                             # Monorepo root scripts & workspace config
├── pnpm-workspace.yaml                      # Workspace package globs (packages/*, apps/*)
├── tsconfig.base.json                       # Shared strict TypeScript compiler settings
├── .kiro/                                   # Spec-Driven Development & Agentic Orchestration
│   ├── steering/                            # Permanent architectural & invariant rules
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── structure.md
│   │   └── genui-invariants.md
│   ├── specs/                               # EARS Requirements, System Design & Task Plans
│   │   ├── core-skeleton/
│   │   │   ├── requirements.md
│   │   │   ├── design.md
│   │   │   ├── correctness.md
│   │   │   └── tasks.md
│   │   ├── app-finops-command/
│   │   │   ├── requirements.md
│   │   │   ├── design.md
│   │   │   └── tasks.md
│   │   └── app-spatial-warroom/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       └── tasks.md
│   ├── hooks/                               # Automated IDE & Agent verification triggers
│   │   ├── catalog-schema-sync.json
│   │   ├── spec-invariants-test.json
│   │   └── raw-jsx-guard.json
│   └── powers/                              # Modular Kiro Power for @json-render mastery
│       └── json-render-power/
│           ├── POWER.md
│           ├── mcp.json
│           └── steering/
│               ├── react-to-catalog.md
│               └── three-and-mcp-patterns.md
├── packages/
│   └── genui-core/                          # @genui-studio/core — Reusable Skeleton Engine
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                     # Public API exports
│           ├── catalog/                     # Catalog contract & prompt synchronizer
│           ├── stream/                      # Guardrailed JSONL patch compiler & DAG sanitizer
│           ├── state/                       # Time-travel StateStore & watch cascade guard
│           ├── boundary/                    # Per-element React ErrorBoundary & SafeGenUIRenderer
│           ├── mcp/                         # MCP App descriptor & HTML bundle helpers
│           ├── testing/                     # fast-check Arbitraries & invariant runner
│           └── __tests__/                   # Unit + fast-check property-based fuzz tests
└── apps/
    ├── finops-command/                      # App 1: RevOps / FinOps Generative Command Center
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   ├── index.html
    │   └── src/
    │       ├── catalog/                     # 14-Component FinOps Verified Catalog & React Registry
    │       ├── components/                  # Spec & Telemetry X-Ray Drawer & Chaos Injector
    │       ├── data/                        # 240-Account SaaS Ledger Seed & Mutation Engine
    │       └── streams/                     # Dual-Mode RFC 6902 JSONL Stream Engine & Playbooks
    └── spatial-ops/                         # App 2: Aegis Spatial Ops & 3D Command Center
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── catalog/                     # Unified 3D (R3F) + 2D (shadcn/SRE) catalog
            ├── components/                  # Dual-viewport 3D topology & 2D runbook console
            └── scenarios/                   # Live SRE incident JSONL streams & state mutations
```

---

## 2. Dependency Direction Rules (Strict DAG)
1. **`packages/genui-core` is the foundational leaf package:**
   - It MAY import from `@json-render/core`, `@json-render/react`, `zod`, `react`, and (in `./testing`) `fast-check`.
   - It MUST NEVER import from `apps/finops-command` or `apps/spatial-ops`.
   - It MUST NEVER hardcode domain-specific UI components; it operates generically over any `Catalog<TDef, TCatalog>` and `Spec`.
2. **`apps/finops-command` and `apps/spatial-ops` are independent domain consumers:**
   - Both MUST import their core pipeline primitives (`createVerifiedCatalog`, `createGuardrailedStreamCompiler`, `inspectSpecGraph`, `createTimeTravelStateStore`, `SafeGenUIRenderer`) from `@genui-studio/core`.
   - `apps/finops-command` and `apps/spatial-ops` MUST NEVER import from each other.
3. **`/.kiro` is versioned source-of-truth infrastructure:**
   - Never add `.kiro` to `.gitignore`.
   - Any change to core invariants in `packages/genui-core` must remain aligned with `/.kiro/steering/genui-invariants.md` and `/.kiro/specs/core-skeleton/`.
