---
inclusion: always
---

# Spatial 3D & WebGL Performance Steering Rules

## 1. Zero-Memory-Leak WebGL Disposal Invariants
Every 3D component rendered via `@react-three/fiber`, Three.js, or `@json-render/react-three-fiber` MUST obey deterministic resource cleanup to prevent browser tab crashes and WebGL context loss during continuous AI streaming.

1. **Geometry & Material Disposal:**
   - Geometries (`BoxGeometry`, `SphereGeometry`, `CylinderGeometry`) and Materials (`MeshStandardMaterial`, `MeshBasicMaterial`, `LineBasicMaterial`) created imperatively or dynamically MUST be explicitly disposed via `geometry.dispose()` and `material.dispose()` inside `useEffect` cleanup handlers.
   - Re-use shared geometries and shared material instances wherever possible across repeated node instances (e.g., standard microservice nodes share geometry instances and only update transform matrices and uniforms).
2. **Texture Memory Protection:**
   - Any generated data texture, canvas texture, or sprite map MUST call `texture.dispose()` upon component unmount.
3. **AnimationFrame & Timer Safety:**
   - Never register raw `window.requestAnimationFrame` loops outside R3F's managed `useFrame` render loop.
   - Any interval or timeout used for incident packet pulse animation MUST be cleaned up on unmount.

---

## 2. Locked 60 FPS Render Loop Discipline
1. **Zero Garbage Allocation in `useFrame`:**
   - NEVER allocate new objects (`new THREE.Vector3()`, `new THREE.Color()`, object literals, or array spreads) inside `useFrame()` callbacks.
   - Use pre-allocated module-level or ref-based temporary scratch instances (e.g., `tempVec3 = new THREE.Vector3()`, `tempColor = new THREE.Color()`).
2. **Dirty-Checking & Selective Re-render:**
   - Avoid re-rendering the full Canvas when 2D state changes. 2D incident diagnostic panels and runbook cards MUST render outside the `<Canvas />` in standard DOM layers, sharing state via `TimeTravelStateStore` without forcing WebGL re-initialization.
3. **Fallback & Graceful Degradation:**
   - If WebGL context is lost (`WEBGL_context_lost`), the canvas MUST catch the event, prevent default, and display a surgical SRE fallback wireframe badge rather than throwing an unhandled runtime crash.
   - Support `frameloop="always"` with auto-pause when the document is hidden (`document.hidden`).

---

## 3. Hybrid 3D + 2D Spec Composition
1. **Root Layout Discipline:**
   - A hybrid spatial workspace spec uses `AegisWarRoomShell` as the root element.
   - The 3D scene elements (`ClusterTopologyCanvas`, `ServiceMeshNode`, `TrafficFlowEdge`, `BlastRadiusSphere`) reside in the spatial viewport slot.
   - The 2D operational telemetry elements (`IncidentHeroBanner`, `ServiceDiagnosticPanel`, `LatencyHistogramCard`, `ErrorLogTailer`, `RunbookActionDesk`, `SreAuditTrail`) reside in the tactical HUD drawer/grid.
2. **State Store Unification:**
   - Selecting a 3D node (via raycast / pointer event) MUST dispatch a state update to `/cluster/selectedServiceId` in `TimeTravelStateStore`.
   - The 2D telemetry panels reactively bind to `/cluster/services/{id}/*` via standard `@genui-studio/core` JSON Pointers.
   - Executing a 2D remediation action (e.g., `triggerFailover`, `tripCircuitBreaker`) immediately mutates cluster topology node health status, altering the node's 3D emission color and pulse frequency in real time.
