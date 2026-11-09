# Playbook: 3D Scene Generation (`@json-render/react-three-fiber`) & MCP Apps (`@json-render/mcp`)

## 1. Combining 3D R3F Topologies with 2D Shared State

`@json-render/react-three-fiber@0.22.0` uses the exact same flat `Spec` format and `@json-render/core` `StateStore` as `@json-render/react`.

### Built-In 3D Catalog Components (`threeComponentDefinitions` & `threeComponents`)
- **Primitives:** `Box`, `Sphere`, `Cylinder`, `Cone`, `Torus`, `Plane`, `Capsule`, `RoundedBox`, `TorusKnot`, `GlassSphere`, `GlassBox`, `DistortSphere`
- **Lights & Environment:** `AmbientLight`, `DirectionalLight`, `PointLight`, `SpotLight`, `Environment`, `Fog`, `GridHelper`, `Sky`, `Stars`, `Sparkles`, `Cloud`, `ContactShadows`, `ReflectorPlane`, `Backdrop`
- **Grouping & Animation Wrappers:** `Group`, `Float`, `Spin`, `Orbit`, `Pulse`, `CameraShake`
- **Labels & Text:** `HtmlLabel`, `Text3D`, `ExtrudedText`
- **Post-Processing:** `EffectComposer`, `Bloom`, `Glitch`, `Vignette`, `WarpTunnel`
- **Camera & Controls:** `PerspectiveCamera`, `OrbitControls`
- **Advanced:** `Model` (GLTF/GLB), `GaussianSplat`, `MeshPortalMaterial`

### Dual-Viewport Shared `StateStore` Pattern
By passing a single `TimeTravelStateStore` instance to both `<JSONUIProvider store={store}>` (2D UI) and `<ThreeCanvas store={store}>` (3D WebGL UI):
1. A 2D slider bound to `{ "$bindState": "/cluster/replicationFactor" }` updates the store immediately.
2. A 3D node using `{ "$state": "/cluster/replicationFactor" }` or `$cond` for its `color` / `scale` / `emissiveIntensity` updates in the 60fps WebGL canvas without re-mounting the scene!

```tsx
import { JSONUIProvider, Renderer } from "@json-render/react";
import { ThreeCanvas } from "@json-render/react-three-fiber";

export function DualSurfaceWorkspace({ store, spec2D, spec3D, registry2D, registry3D }) {
  return (
    <div className="grid grid-cols-12 h-screen">
      <div className="col-span-7 relative">
        <ThreeCanvas
          spec={spec3D}
          registry={registry3D}
          store={store}
          shadows
          camera={{ position: [8, 6, 8], fov: 45 }}
        />
      </div>
      <div className="col-span-5 overflow-y-auto">
        <JSONUIProvider registry={registry2D} store={store}>
          <Renderer spec={spec2D} registry={registry2D} />
        </JSONUIProvider>
      </div>
    </div>
  );
}
```

---

## 2. Serving Catalogs as MCP Apps (`@json-render/mcp`)

Use `createMcpApp` from `@json-render/mcp` and `buildAppHtml` from `@json-render/mcp/build-app-html` to expose any verified catalog as an interactive MCP tool + iframe resource:

```typescript
import { createMcpApp } from "@json-render/mcp";
import { buildAppHtml } from "@json-render/mcp/build-app-html";

const html = buildAppHtml({
  title: "GenUI Studio Telemetry App",
  js: bundledClientJs,
  css: bundledClientCss,
});

export const mcpServer = createMcpApp({
  name: "genui-studio-telemetry",
  version: "1.0.0",
  catalog: verifiedCatalog.catalog,
  html,
  tool: {
    name: "render_telemetry_dashboard",
    title: "Render Guardrailed Telemetry Dashboard",
    description: "Streams a verified json-render UI spec into the MCP client.",
  },
});
```
