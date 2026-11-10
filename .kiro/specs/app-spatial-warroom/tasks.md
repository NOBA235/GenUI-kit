# Implementation Tasks: Application #2 — Aegis 3D Spatial Incident War-Room

- [x] 1. Workspace Configuration & Steering Rules
  - [x] 1.1 Create `/.kiro/steering/spatial-3d-rules.md` (WebGL disposal & 60 FPS invariants)
  - [x] 1.2 Create `/.kiro/specs/app-spatial-warroom/` (`requirements.md`, `design.md`, `tasks.md`)
  - [x] 1.3 Update `apps/spatial-ops/package.json` with `fast-check` dependency & configure `vite.config.ts`, `index.html`, and `styles.css`

- [x] 2. Stateful Cluster Dataset & Mutation Engine (`src/data/cluster-seed.ts`)
  - [x] 2.1 Seed 16 distributed cluster microservices, cross-region edges, latency arrays, and error logs
  - [x] 2.2 Implement `executeSreMutation` for `tripCircuitBreaker`, `triggerRegionalFailover`, `scaleServiceReplicas`, `rollbackDeployment` with atomic `TimeTravelStateStore` updates

- [x] 3. 14-Component Hybrid 3D + 2D Verified Catalog (`src/catalog/spatial-catalog.ts`)
  - [x] 3.1 Define 6 3D spatial components (`AegisWarRoomShell`, `ClusterTopologyCanvas`, `ServiceMeshNode3D`, `TrafficFlowEdge3D`, `BlastRadiusSphere3D`, `RegionZoneBoundary3D`) with bounded 3D vectors & fallback props
  - [x] 3.2 Define 8 2D tactical HUD components (`IncidentHeroBanner`, `ServiceDiagnosticPanel`, `LatencyHistogramCard`, `ErrorLogTailer`, `BlastRadiusDependencyTree`, `RunbookActionDesk`, `ClusterMetricsGrid`, `SreAuditTrailBanner`)
  - [x] 3.3 Register 4 remediation actions with Zod validation schemas

- [x] 4. React Component Registry with Three.js / R3F (`src/catalog/spatial-registry.tsx`)
  - [x] 4.1 Implement 3D spatial components using `@react-three/fiber`, `@react-three/drei`, and shared geometry caches
  - [x] 4.2 Implement 2D tactical HUD components with reactive `TimeTravelStateStore` bindings and accessible form controls
  - [x] 4.3 Wrap registry with `wrapRegistryWithTelemetry` and catalog parity audit

- [x] 5. Dual-Mode RFC 6902 JSONL Stream Engine & Chaos Presets (`src/streams/spatial-streams.ts`)
  - [x] 5.1 Implement 3 incident scenario specs (SEV-1 Cascading Gateway Outage, EU-West Cross-Region Failover, Redis Memory Pressure Triage)
  - [x] 5.2 Implement natural-language incident intent-to-JSONL synthesizer
  - [x] 5.3 Implement `buildSpatialChaosPackets` injecting out-of-bounds scale, cyclic dependency edge, and simulated cascading fault

- [x] 6. Application Shell & X-Ray Drawer (`src/App.tsx`, `src/components/SpatialXRayDrawer.tsx`, `src/main.tsx`)
  - [x] 6.1 Top war-room HUD with severity pill, global error rate, Time-Travel Undo/Redo, and quick chaos button
  - [x] 6.2 Dual-viewport layout (3D spatial canvas left + 2D tactical runbook right)
  - [x] 6.3 Spec & Telemetry X-Ray Drawer with live JSONL stream inspector and in-browser `fast-check` PBT runner

- [x] 7. Verification & Automated Test Suite (`src/__tests__/spatial-app.test.tsx`)
  - [x] 7.1 Verify 100% catalog-registry parity across all 14 components and 4 actions
  - [x] 7.2 Run `runCatalogInvariantSuite` verifying all 4 formal invariants (INV-1..INV-4) on `spatialVerifiedCatalog`
  - [x] 7.3 Test all 4 SRE mutations, state mutations, and Time-Travel Undo/Redo
  - [x] 7.4 Test stream compilation and chaos packet resilience (healed scale factors, severed cycles, quarantined node faults)
  - [x] 7.5 Run full monorepo typecheck & test pass (`pnpm -r typecheck`, `pnpm -r test`)
