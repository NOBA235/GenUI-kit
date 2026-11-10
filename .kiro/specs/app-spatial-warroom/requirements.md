# Requirements Document: Application #2 — Aegis 3D Spatial Infrastructure & Incident War-Room (`@genui-studio/spatial-ops`)

## 1. Introduction & Product Vision
**Aegis 3D** (`apps/spatial-ops`) is the second production application powered by the `@genui-studio/core` Skeleton Framework. While Application #1 demonstrated deep 2D B2B transactional RevOps workflows, Application #2 proves the skeleton's extreme architectural versatility by marrying **interactive 3D spatial infrastructure topologies** (`@json-render/react-three-fiber` / Three.js) with **2D tactical SRE war-room telemetry** on the exact same guardrailed JSONL streaming engine.

In high-severity outages (SEV-1/SEV-0), SREs waste critical minutes context-switching across Grafana dashboards, Kubernetes pods, and terminal logs. Aegis 3D streams an interactive 3D topology of distributed microservices, databases, and message brokers with live traffic flows. Clicking any 3D node immediately projects 2D latency histograms, blast-radius dependency trees, error log tailers, and guardrailed remediation runbook cards.

---

## 2. EARS Functional & Non-Functional Requirements

### Requirement 1: Hybrid 3D + 2D Verified Catalog & Registry Parity
**User Story:** As an SRE platform engineer, I want a unified Zod catalog that validates both 3D spatial node definitions (positions, geometries, emission states) and 2D operational telemetry cards, so that arbitrary AI streams never emit malformed 3D coordinates or crash the WebGL scene.

#### Acceptance Criteria
1. **WHEN** `spatialVerifiedCatalog` is initialized via `createVerifiedCatalog`, **THE SYSTEM SHALL** register at least 14 domain components:
   - 3D Spatial Components: `AegisWarRoomShell`, `ClusterTopologyCanvas`, `ServiceMeshNode3D`, `TrafficFlowEdge3D`, `BlastRadiusSphere3D`, `RegionZoneBoundary3D`.
   - 2D Telemetry & Tactical Components: `IncidentHeroBanner`, `ServiceDiagnosticPanel`, `LatencyHistogramCard`, `ErrorLogTailer`, `BlastRadiusDependencyTree`, `RunbookActionDesk`, `ClusterMetricsGrid`, `SreAuditTrailBanner`.
   - 4 Typed Remediation Actions: `tripCircuitBreaker`, `triggerRegionalFailover`, `scaleServiceReplicas`, `rollbackDeployment`.
2. **WHEN** `auditCatalogRegistryParity` runs against `spatialVerifiedCatalog` and `createSpatialRegistry()`, **THE SYSTEM SHALL** verify `synchronized: true` with zero missing components or actions.
3. **IF** an LLM streams out-of-bounds 3D coordinates, extreme scaling factors, or invalid health states (`"apocalyptic"`), **THEN THE SYSTEM SHALL** clamp coordinates to the bounding box, normalize scale factors, heal health states to `"nominal"`, and emit an inspectable `<DiagnosticHealedBadge />`.

---

### Requirement 2: Interactive 3D Spatial Topology Canvas
**User Story:** As an incident commander, I want an interactive 3D cluster topology displaying microservices, caches, databases, and active inter-service network edges that pulse and change color according to real-time incident severity.

#### Acceptance Criteria
1. **WHILE** rendering the 3D topology, **THE SYSTEM SHALL** display services positioned in 3D coordinate space with status-coded emissive shaders:
   - `NOMINAL`: Emerald glow (`#10B981`), steady subtle breath pulse.
   - `DEGRADED`: Amber glow (`#F59E0B`), elevated vibration rate.
   - `CRITICAL_OUTAGE`: Crimson pulse (`#EF4444`), fractured perimeter wireframe.
2. **WHEN** an operator clicks any 3D service mesh node (raycast interaction), **THE SYSTEM SHALL** update `/cluster/selectedServiceId` in `TimeTravelStateStore`, orient a visual selection beacon around the node, and immediately focus the 2D diagnostic panels on the selected service without re-initializing the WebGL canvas.
3. **WHILE** network edges connect upstream and downstream services, **THE SYSTEM SHALL** render directional animated particle pulses along bezier/quadratic paths representing packet velocity and error rate.

---

### Requirement 3: Stateful Cluster Dataset & Tactical Remediation Mutations
**User Story:** As an on-call engineer, I want a realistic distributed cluster dataset (12 microservices, 4 databases/caches, cross-region US-East/EU-West topologies) that mutates in real time when I trigger runbook actions, with full Time-Travel Undo/Redo support.

#### Acceptance Criteria
1. **WHEN** the application starts, **THE SYSTEM SHALL** seed `TimeTravelStateStore` with 16 interconnected cluster nodes, active SEV-1 incident state, live error logs, p50/p95/p99 latency arrays, and an immutable SRE audit trail.
2. **WHEN** an operator executes `tripCircuitBreaker`, `triggerRegionalFailover`, `scaleServiceReplicas`, or `rollbackDeployment`, **THE SYSTEM SHALL** update the affected service's health status, p99 latency, and error rate, recalculate total cluster error budget, append an entry to `/cluster/auditLog`, and immediately reflect the change in both 3D emission shaders and 2D charts.
3. **WHEN** the operator clicks **Undo** or **Redo**, **THE SYSTEM SHALL** restore the exact prior/next cluster topology state in $O(1)$ time.

---

### Requirement 4: WebGL Performance, Memory Safety & 60 FPS Discipline
**User Story:** As an engineer running on a laptop, I want the 3D canvas to maintain 60 FPS without memory leaks or GPU crashes during continuous streaming.

#### Acceptance Criteria
1. **WHILE** the 3D render loop executes, **THE SYSTEM SHALL** allocate zero new objects (`new THREE.Vector3()`, `new THREE.Color()`) inside `useFrame`, reusing pre-allocated scratch vectors and uniforms.
2. **WHEN** 3D components unmount or nodes are removed by JSONL patch streams, **THE SYSTEM SHALL** explicitly dispose of all geometries and materials.
3. **IF** the browser tab loses visibility (`document.hidden`), **THEN THE SYSTEM SHALL** throttle rendering to conserve GPU and battery resources.

---

### Requirement 5: Dual-Mode RFC 6902 JSONL Streaming & Chaos Outage Injection
**User Story:** As a hackathon judge evaluating the demo, I want to experience live chunk-by-chunk JSONL streaming and one-click incident chaos simulation without needing my own API key.

#### Acceptance Criteria
1. **WHILE** in Recorded Judge Mode, **THE SYSTEM SHALL** stream authentic RFC 6902 JSON Patch lines through `GuardrailedStreamCompiler`, animating the assembly of the 3D scene and 2D HUD chunk by chunk.
2. **WHEN** the user clicks **"⚡ Inject Cascading Outage Chaos Packet"**, **THE SYSTEM SHALL** push a hostile packet batch containing an out-of-bounds scale factor (auto-healed), a cyclic dependency edge (severed by DAG sanitizer), and a simulated cascade failure that turns downstream services degraded.
3. **WHEN** an OpenAI-compatible API key is provided, **THE SYSTEM SHALL** compile `spatialVerifiedCatalog.prompt()` and stream real LLM completions directly into the spatial compiler.
