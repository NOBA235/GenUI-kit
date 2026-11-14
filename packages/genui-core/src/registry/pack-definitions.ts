import type { AgentReadyPackManifest } from "./types.js";

/**
 * 1. Pro Template Pack: Aegis 3D Spatial Incident War-Room
 */
export const SPATIAL_OPS_3D_PRO_PACK: AgentReadyPackManifest = {
  id: "spatial-ops-3d-pro",
  name: "spatial-ops-3d-pro",
  title: "Aegis 3D Spatial Infrastructure War-Room",
  description:
    "Production 14-component Hybrid 3D (React Three Fiber WebGL) + 2D Tactical SRE Incident HUD combining zero-allocation 3D service mesh topologies with shared TimeTravelStateStore failover runbooks.",
  version: "1.0.0",
  author: "GenUI Studio <creators@genui.studio>",
  license: "Commercial-Single",
  tier: "pro",
  priceUsd: 79,
  category: "spatial-3d",
  tags: ["3d", "threejs", "r3f", "webgl", "sre", "incident-command", "pro"],
  dependencies: {
    "@genui-studio/core": "^1.0.0",
    "@json-render/core": "^0.22.0",
    "@json-render/react": "^0.22.0",
    "@json-render/react-three-fiber": "^0.22.0",
    "@react-three/drei": "^10.0.0",
    "@react-three/fiber": "^9.0.0",
    "three": "^0.173.0",
    "zod": "^4.3.6",
  },
  devDependencies: {
    "@types/three": "^0.173.0",
    "fast-check": "^4.10.2",
    "vitest": "^3.0.0",
  },
  catalogHash: "sha256-a94f31c827b5034e6109dc0489e21703ab",
  components: [
    {
      name: "AegisWarRoomShell",
      description: "Root container organizing 3D spatial viewport and 2D tactical HUD.",
      slots: ["spatial", "hud"],
      hasFallbackProps: true,
    },
    {
      name: "ClusterTopologyCanvas",
      description: "3D WebGL scene viewport rendering the microservice mesh.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "ServiceMeshNode3D",
      description: "Interactive 3D microservice node mesh with emissive glow and label.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "TrafficFlowEdge3D",
      description: "Directional 3D bezier connection line with animated packet pulses.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "BlastRadiusSphere3D",
      description: "Translucent volumetric pulsating sphere indicating fault blast radius.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "RegionZoneBoundary3D",
      description: "Spatial bounding zone wireframe delimiting a regional cluster.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "IncidentHeroBanner",
      description: "High-priority SEV header banner showing incident title and MTTD.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "ServiceDiagnosticPanel",
      description: "Deep-dive telemetry inspection card for selected 3D service node.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "LatencyHistogramCard",
      description: "Interactive p50/p95/p99 latency curve & SLO error-budget burn card.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "ErrorLogTailer",
      description: "Real-time streaming structured log tail showing HTTP 5xx codes.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "BlastRadiusDependencyTree",
      description: "Visual topological tree showing upstream callers and dependencies.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "RunbookActionDesk",
      description: "Interactive remediation desk to trip breakers, scale, or failover.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "ClusterMetricsGrid",
      description: "High-level SRE telemetry grid for Global Error Rate and RPS.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "SreAuditTrailBanner",
      description: "Live immutable audit strip displaying executed SRE remediations.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [
    {
      path: "catalog/spatial-catalog.ts",
      type: "registry:catalog",
      content: `// Aegis 3D Spatial Verified Catalog Exported from GenUI Studio
import { z } from "zod";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

export const spatialCatalog = createVerifiedCatalog(schema, {
  components: {
    AegisWarRoomShell: {
      description: "Root 3D + 2D command shell",
      props: z.object({
        incidentTitle: z.string().min(1).max(140),
        severity: z.enum(["SEV-0", "SEV-1", "SEV-2", "NOMINAL"]),
        activeRegion: z.enum(["GLOBAL", "US-East", "EU-West", "APAC-South"]),
        hudPosition: z.enum(["RIGHT_SPLIT", "BOTTOM_DRAWER", "FULL_OVERLAY"])
      }),
      slots: ["spatial", "hud"]
    },
    ClusterTopologyCanvas: {
      description: "3D WebGL viewport canvas",
      props: z.object({
        cameraFov: z.number().int().min(30).max(90),
        enableOrbitControls: z.boolean(),
        enableGrid: z.boolean(),
        enableBloom: z.boolean(),
        ambientIntensity: z.number().min(0.1).max(2.0)
      }),
      slots: ["default"]
    }
  },
  actions: {}
});
`,
    },
  ],
  agentSkill: {
    skillMd: `---
name: spatial-ops-3d-pro
description: Expert AI Agent Skill for generating, manipulating, and animating 3D WebGL infrastructure topologies and 2D SRE HUDs.
author: GenUI Studio
version: 1.0.0
---

# Spatial Ops 3D Pro Agent Skill

This skill instructs agents on 3D coordinate math, camera FOV bounds, and zero-allocation Three.js patterns.

## 3D Rules for AI Generation:
1. Coordinates \`position: [x, y, z]\` must stay strictly within \`[-12, 12]\` to remain inside frustum.
2. Root element must always be \`AegisWarRoomShell\` with \`spatial\` and \`hud\` slots.
3. Node status values: \`NOMINAL\` (emerald), \`DEGRADED\` (amber), \`CRITICAL_OUTAGE\` (rose).
`,
    kiroPowerMd: `---
name: "spatial-ops-3d-pro"
displayName: "Aegis 3D Spatial War-Room Power"
description: "Authoritative Kiro Power for 3D WebGL microservice topologies, bezier traffic edges, and dual-viewport state sync."
keywords: ["3d", "webgl", "r3f", "threejs", "sre", "incident-command"]
---

# Onboarding: \`spatial-ops-3d-pro\`
Use this power when generating 3D WebGL microservice maps with \`@json-render/react-three-fiber\`.
`,
    steeringRules: `# Spatial 3D Architectural Rules
- Zero allocations in \`useFrame\` render loop.
- Reuse geometries and materials across identical tiers.
- Emissive glow driven by store state without scene remounts.
`,
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02", "INV-PBT-03", "INV-PBT-04"],
    code: `import { describe, it, expect } from "vitest";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { spatialCatalog } from "./catalog/spatial-catalog";

describe("Spatial Ops 3D Invariant Suite", () => {
  it("guarantees 3D topology acyclic invariance under fast-check fuzzing", () => {
    const report = runCatalogInvariantSuite(spatialCatalog, { numRuns: 30 });
    expect(report.allPassed).toBe(true);
  });
});
`,
  },
};

/**
 * 2. Free Starter Pack: 3D Spatial Mesh Starter
 */
export const SPATIAL_MESH_STARTER_PACK: AgentReadyPackManifest = {
  id: "spatial-mesh-starter",
  name: "spatial-mesh-starter",
  title: "3D Spatial Mesh Starter Pack",
  description:
    "Free starter kit for WebGL microservice scenes: ClusterTopologyCanvas, ServiceMeshNode3D, and TrafficFlowEdge3D.",
  version: "1.0.0",
  author: "GenUI Studio <creators@genui.studio>",
  license: "MIT",
  tier: "free",
  priceUsd: 0,
  category: "spatial-3d",
  tags: ["free", "starter", "3d", "threejs", "webgl"],
  dependencies: {
    "@genui-studio/core": "^1.0.0",
    "@json-render/core": "^0.22.0",
    "@json-render/react-three-fiber": "^0.22.0",
    "three": "^0.173.0",
    "zod": "^4.3.6",
  },
  devDependencies: {
    "@types/three": "^0.173.0",
    "vitest": "^3.0.0",
  },
  catalogHash: "sha256-starter-mesh-002",
  components: [
    {
      name: "ClusterTopologyCanvas",
      description: "Basic WebGL canvas with OrbitControls.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "ServiceMeshNode3D",
      description: "3D Node with emissive status glow.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [],
  agentSkill: {
    skillMd: "# 3D Mesh Starter Skill\nBasic 3D mesh skill for Claude and Cursor.",
    kiroPowerMd: "# 3D Mesh Starter Power\nStarter 3D power for Kiro.",
    steeringRules: "# 3D Starter Rules\nClamp node coordinates to [-10, 10].",
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02"],
    code: "// 3D Starter PBT suite\n",
  },
};

export const ALL_TEMPLATE_PACKS: Record<string, AgentReadyPackManifest> = {
  "spatial-ops-3d-pro": SPATIAL_OPS_3D_PRO_PACK,
  "spatial-mesh-starter": SPATIAL_MESH_STARTER_PACK,
};
