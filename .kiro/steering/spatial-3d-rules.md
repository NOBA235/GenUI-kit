---
inclusion: always
---

# 3D & WebGL Performance Steering Rules

## 1. Zero-Memory-Leak WebGL Disposal Invariants
Every 3D component rendered via `@react-three/fiber` or Three.js (such as `afterdark-horror` and `cmos-cloud-bios`) MUST obey deterministic resource cleanup to prevent browser tab crashes and WebGL context loss during continuous UI updates.

1. **Geometry & Material Disposal:**
   - Geometries (`BoxGeometry`, `SphereGeometry`, `CylinderGeometry`) and Materials (`MeshStandardMaterial`, `MeshBasicMaterial`, `LineBasicMaterial`) created imperatively or dynamically MUST be explicitly disposed via `geometry.dispose()` and `material.dispose()` inside `useEffect` cleanup handlers.
   - Re-use shared geometries and shared material instances (`THREE.InstancedMesh`) wherever possible across repeated scene instances.
2. **Texture Memory Protection:**
   - Any generated data texture, canvas texture, or sprite map MUST call `texture.dispose()` upon component unmount.
3. **AnimationFrame & Timer Safety:**
   - Inside WebGL / R3F scenes, never register raw `window.requestAnimationFrame` loops outside R3F's managed `useFrame` render loop. (Plain 2D `<canvas>` views, such as CHIMERA's `BioNetworkCanvas`, run one cancellable rAF loop under `chimera-frankenstein-rules.md` §5.)
   - Any interval or timeout used for scene animation MUST be cleaned up on unmount.

---

## 2. Locked 60 FPS Render Loop Discipline
1. **Zero Garbage Allocation in `useFrame`:**
   - NEVER allocate new objects (`new THREE.Vector3()`, `new THREE.Color()`, object literals, or array spreads) inside `useFrame()` callbacks.
   - Mutate existing objects in place (`group.position.set(...)`, `mesh.position`, material uniforms) or use pre-allocated module-level or ref-based scratch instances (e.g., `tempVec3 = new THREE.Vector3()`, `tempColor = new THREE.Color()`).
2. **Dirty-Checking & Selective Re-render:**
   - Avoid re-rendering the full `<Canvas />` when 2D HUD state changes. 2D controls and telemetry overlays MUST render outside the `<Canvas />` in standard DOM layers, sharing state via `TimeTravelStateStore` or scoped Zustand stores without forcing WebGL re-initialization.
3. **Fallback & Graceful Degradation:**
   - If WebGL context is lost (`webglcontextlost`), the canvas MUST catch the event, prevent default, and display a graceful fallback indicator rather than throwing an unhandled runtime crash.
   - Pause animation work when the document is hidden (`document.hidden`).
