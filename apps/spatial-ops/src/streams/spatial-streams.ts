import type { Spec } from "@json-render/core";
import { specToJsonlStream } from "@genui-studio/core";
import { spatialVerifiedCatalog } from "../catalog/spatial-catalog.js";

export interface SpatialScenarioPreset {
  id: string;
  title: string;
  badge: string;
  prompt: string;
  description: string;
  buildSpec: () => Spec;
}

/**
 * Scenario 1: SEV-1 Cascading Gateway & Database Connection Starvation
 * Full 14-Component Hybrid Surface (3D Spatial Nodes + 2D Tactical HUD).
 */
export function buildCascadingOutageSpec(): Spec {
  return {
    root: "warroom-shell-root",
    elements: {
      "warroom-shell-root": {
        type: "AegisWarRoomShell",
        props: {
          incidentTitle: "SEV-1: PostgreSQL Pool Saturation Cascading to API Gateway",
          severity: "SEV-1",
          activeRegion: "US-East",
          hudPosition: "RIGHT_SPLIT",
        },
        slots: {
          spatial: ["canvas-viewport-3d"],
          hud: [
            "banner-incident",
            "grid-metrics",
            "panel-service-diagnostic",
            "card-latency-spark",
            "card-runbook-desk",
            "tailer-error-logs",
            "banner-audit-trail",
          ],
        },
        children: [],
      },

      // ==========================================
      // 3D SPATIAL TOPOLOGY CANVAS ELEMENTS
      // ==========================================
      "canvas-viewport-3d": {
        type: "ClusterTopologyCanvas",
        props: {
          cameraFov: 50,
          enableOrbitControls: true,
          enableGrid: true,
          enableBloom: true,
          ambientIntensity: 0.85,
        },
        children: [
          "node-ingress",
          "node-gateway",
          "node-eu-gw",
          "node-auth",
          "node-billing",
          "node-order",
          "node-redis",
          "node-postgres",
          "edge-in-gw",
          "edge-gw-order",
          "edge-order-pg",
          "blast-sphere-db",
          "zone-boundary-us",
        ],
      },
      "node-ingress": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-ingress",
          name: "Global Edge Ingress",
          tier: "INGRESS",
          position: [0, 2.8, 0],
          status: "NOMINAL",
          scale: 1.1,
        },
        children: [],
      },
      "node-gateway": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-api-gateway",
          name: "API Gateway Core",
          tier: "GATEWAY",
          position: [0, 1.4, 0],
          status: "CRITICAL_OUTAGE",
          scale: 1.25,
        },
        children: [],
      },
      "node-eu-gw": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-eu-failover-gw",
          name: "EU Standby Gateway",
          tier: "GATEWAY",
          position: [3.4, 1.6, -1.8],
          status: "NOMINAL",
          scale: 1.0,
        },
        children: [],
      },
      "node-auth": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-auth",
          name: "OAuth2 & Session Vault",
          tier: "SERVICE",
          position: [-2.6, 0.6, -0.8],
          status: "DEGRADED",
          scale: 1.0,
        },
        children: [],
      },
      "node-billing": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-billing",
          name: "Stripe & Invoicing Worker",
          tier: "SERVICE",
          position: [2.6, 0.6, -0.8],
          status: "NOMINAL",
          scale: 0.95,
        },
        children: [],
      },
      "node-order": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-order-proc",
          name: "Order Processing Pipeline",
          tier: "SERVICE",
          position: [0, 0.1, -1.8],
          status: "CRITICAL_OUTAGE",
          scale: 1.2,
        },
        children: [],
      },
      "node-redis": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-redis-cache",
          name: "Redis Sharded L1 Cache",
          tier: "CACHE",
          position: [-1.8, -1.6, -1.2],
          status: "DEGRADED",
          scale: 1.05,
        },
        children: [],
      },
      "node-postgres": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-postgres-primary",
          name: "Aurora PostgreSQL Primary",
          tier: "DATABASE",
          position: [0, -2.0, -2.8],
          status: "CRITICAL_OUTAGE",
          scale: 1.3,
        },
        children: [],
      },
      "edge-in-gw": {
        type: "TrafficFlowEdge3D",
        props: {
          edgeId: "edge-in-gw",
          fromServiceId: "srv-ingress",
          toServiceId: "srv-api-gateway",
          status: "CONGESTED",
          particleSpeed: 2.4,
        },
        children: [],
      },
      "edge-gw-order": {
        type: "TrafficFlowEdge3D",
        props: {
          edgeId: "edge-gw-order",
          fromServiceId: "srv-api-gateway",
          toServiceId: "srv-order-proc",
          status: "SEVERED",
          particleSpeed: 0.4,
        },
        children: [],
      },
      "edge-order-pg": {
        type: "TrafficFlowEdge3D",
        props: {
          edgeId: "edge-order-pg",
          fromServiceId: "srv-order-proc",
          toServiceId: "srv-postgres-primary",
          status: "SEVERED",
          particleSpeed: 0.2,
        },
        children: [],
      },
      "blast-sphere-db": {
        type: "BlastRadiusSphere3D",
        props: {
          targetServiceId: "srv-postgres-primary",
          radius: 3.8,
          severity: "CRITICAL",
          pulseRate: 1.8,
        },
        children: [],
      },
      "zone-boundary-us": {
        type: "RegionZoneBoundary3D",
        props: {
          regionName: "US-East",
          center: [0, 0, -1.5],
          size: [8, 6, 8],
          wireframeColor: "#EF4444",
        },
        children: [],
      },

      // ==========================================
      // 2D TACTICAL SRE HUD ELEMENTS
      // ==========================================
      "banner-incident": {
        type: "IncidentHeroBanner",
        props: {
          severity: "SEV-1",
          title: "PostgreSQL Connection Pool Starvation Cascading to Gateways",
          summary: "HikariPool lease exhaustion in srv-order-proc triggered 503 timeouts on API Gateway. 29.4% error rate observed.",
          mttdMinutes: 2.1,
        },
        children: [],
      },
      "grid-metrics": {
        type: "ClusterMetricsGrid",
        props: {
          heading: "Global Fleet Health Indicators",
          columns: "3",
        },
        children: [],
      },
      "panel-service-diagnostic": {
        type: "ServiceDiagnosticPanel",
        props: {
          defaultServiceId: "srv-api-gateway",
          showDependencies: true,
        },
        children: [],
      },
      "card-latency-spark": {
        type: "LatencyHistogramCard",
        props: {
          serviceId: "srv-api-gateway",
          timeWindow: "15m",
        },
        children: [],
      },
      "card-runbook-desk": {
        type: "RunbookActionDesk",
        props: {
          heading: "Automated Incident Remediation Desk",
          allowDirectExecution: true,
        },
        children: [],
      },
      "tailer-error-logs": {
        type: "ErrorLogTailer",
        props: {
          title: "Live Structured Incident Log Stream",
          maxEntries: 5,
          filterLevel: "ALL",
        },
        children: [],
      },
      "banner-audit-trail": {
        type: "SreAuditTrailBanner",
        props: {
          title: "Immutable SRE Mitigation Audit Trail",
          maxEntries: 4,
        },
        children: [],
      },
    },
  };
}

/**
 * Scenario 2: Cross-Region Traffic Failover & Canary Rollback
 */
export function buildRegionalFailoverSpec(): Spec {
  return {
    root: "warroom-shell-failover",
    elements: {
      "warroom-shell-failover": {
        type: "AegisWarRoomShell",
        props: {
          incidentTitle: "Regional Traffic Failover: US-East → EU-West Standby Cluster",
          severity: "SEV-2",
          activeRegion: "EU-West",
          hudPosition: "RIGHT_SPLIT",
        },
        slots: {
          spatial: ["canvas-viewport-eu"],
          hud: [
            "banner-failover",
            "grid-metrics-eu",
            "panel-eu-gw",
            "card-runbook-eu",
            "tailer-logs-eu",
          ],
        },
        children: [],
      },
      "canvas-viewport-eu": {
        type: "ClusterTopologyCanvas",
        props: {
          cameraFov: 45,
          enableOrbitControls: true,
          enableGrid: true,
          enableBloom: false,
          ambientIntensity: 0.9,
        },
        children: [
          "node-eu-gw-active",
          "node-eu-db",
          "node-us-gw-drained",
          "edge-failover-active",
          "zone-boundary-eu",
        ],
      },
      "node-eu-gw-active": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-eu-failover-gw",
          name: "EU Standby Gateway (Promoted)",
          tier: "GATEWAY",
          position: [0, 1.2, 0],
          status: "NOMINAL",
          scale: 1.2,
        },
        children: [],
      },
      "node-eu-db": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-postgres-replica",
          name: "Aurora Read Replica EU",
          tier: "DATABASE",
          position: [0, -1.8, -1.5],
          status: "NOMINAL",
          scale: 1.1,
        },
        children: [],
      },
      "node-us-gw-drained": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-api-gateway",
          name: "US Gateway (Drained)",
          tier: "GATEWAY",
          position: [-3.2, 0.8, -2],
          status: "DEGRADED",
          scale: 0.85,
        },
        children: [],
      },
      "edge-failover-active": {
        type: "TrafficFlowEdge3D",
        props: {
          edgeId: "edge-eu-gw-db",
          fromServiceId: "srv-eu-failover-gw",
          toServiceId: "srv-postgres-replica",
          status: "NOMINAL",
          particleSpeed: 1.8,
        },
        children: [],
      },
      "zone-boundary-eu": {
        type: "RegionZoneBoundary3D",
        props: {
          regionName: "EU-West",
          center: [0, 0, 0],
          size: [7, 5, 7],
          wireframeColor: "#10B981",
        },
        children: [],
      },
      "banner-failover": {
        type: "IncidentHeroBanner",
        props: {
          severity: "SEV-2",
          title: "Cross-Region Traffic Reroute Active",
          summary: "70% of global ingress traffic rerouted to EU-West standby datacenter. Error rates stabilized below 1%.",
          mttdMinutes: 1.4,
        },
        children: [],
      },
      "grid-metrics-eu": {
        type: "ClusterMetricsGrid",
        props: {
          heading: "EU Fleet Operational Metrics",
          columns: "3",
        },
        children: [],
      },
      "panel-eu-gw": {
        type: "ServiceDiagnosticPanel",
        props: {
          defaultServiceId: "srv-eu-failover-gw",
          showDependencies: true,
        },
        children: [],
      },
      "card-runbook-eu": {
        type: "RunbookActionDesk",
        props: {
          heading: "Regional Reroute Execution Controls",
          allowDirectExecution: true,
        },
        children: [],
      },
      "tailer-logs-eu": {
        type: "ErrorLogTailer",
        props: {
          title: "EU Gateway Ingress Event Log",
          maxEntries: 4,
          filterLevel: "INFO",
        },
        children: [],
      },
    },
  };
}

/**
 * Scenario 3: Redis Cache Saturation & Memory Eviction Triage
 */
export function buildRedisMemoryTriageSpec(): Spec {
  return {
    root: "warroom-shell-redis",
    elements: {
      "warroom-shell-redis": {
        type: "AegisWarRoomShell",
        props: {
          incidentTitle: "SEV-2: Redis Cluster L1 Cache Memory Saturation (96.4% OOM Risk)",
          severity: "SEV-2",
          activeRegion: "US-East",
          hudPosition: "RIGHT_SPLIT",
        },
        slots: {
          spatial: ["canvas-viewport-redis"],
          hud: [
            "banner-redis",
            "panel-redis",
            "tree-redis-blast",
            "runbook-redis",
            "tailer-redis",
          ],
        },
        children: [],
      },
      "canvas-viewport-redis": {
        type: "ClusterTopologyCanvas",
        props: {
          cameraFov: 48,
          enableOrbitControls: true,
          enableGrid: true,
          enableBloom: true,
          ambientIntensity: 0.8,
        },
        children: [
          "node-redis-hot",
          "node-auth-caller",
          "node-recom-caller",
          "edge-auth-redis",
          "edge-recom-redis",
        ],
      },
      "node-redis-hot": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-redis-cache",
          name: "Redis Sharded L1 Cache",
          tier: "CACHE",
          position: [0, 0, 0],
          status: "DEGRADED",
          scale: 1.3,
        },
        children: [],
      },
      "node-auth-caller": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-auth",
          name: "OAuth2 & Session Vault",
          tier: "SERVICE",
          position: [-2.4, 1.2, -1],
          status: "DEGRADED",
          scale: 1.0,
        },
        children: [],
      },
      "node-recom-caller": {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-recommendation",
          name: "Vector & Inference Engine",
          tier: "SERVICE",
          position: [2.4, 1.2, -1],
          status: "NOMINAL",
          scale: 0.95,
        },
        children: [],
      },
      "edge-auth-redis": {
        type: "TrafficFlowEdge3D",
        props: {
          edgeId: "edge-auth-redis",
          fromServiceId: "srv-auth",
          toServiceId: "srv-redis-cache",
          status: "CONGESTED",
          particleSpeed: 2.1,
        },
        children: [],
      },
      "edge-recom-redis": {
        type: "TrafficFlowEdge3D",
        props: {
          edgeId: "edge-recom-redis",
          fromServiceId: "srv-recommendation",
          toServiceId: "srv-redis-cache",
          status: "NOMINAL",
          particleSpeed: 1.2,
        },
        children: [],
      },
      "banner-redis": {
        type: "IncidentHeroBanner",
        props: {
          severity: "SEV-2",
          title: "Redis L1 Eviction Pressure Saturating Session Lookups",
          summary: "Redis maxmemory policy triggered OOM alerts; session token lookups falling back to primary database.",
          mttdMinutes: 1.8,
        },
        children: [],
      },
      "panel-redis": {
        type: "ServiceDiagnosticPanel",
        props: {
          defaultServiceId: "srv-redis-cache",
          showDependencies: true,
        },
        children: [],
      },
      "tree-redis-blast": {
        type: "BlastRadiusDependencyTree",
        props: {
          rootServiceId: "srv-redis-cache",
          depthLimit: 2,
        },
        children: [],
      },
      "runbook-redis": {
        type: "RunbookActionDesk",
        props: {
          heading: "Cache Shard Scale & Flush Controls",
          allowDirectExecution: true,
        },
        children: [],
      },
      "tailer-redis": {
        type: "ErrorLogTailer",
        props: {
          title: "Redis OOM & Eviction Trace Logs",
          maxEntries: 4,
          filterLevel: "WARN",
        },
        children: [],
      },
    },
  };
}

export const SPATIAL_SCENARIO_PRESETS: SpatialScenarioPreset[] = [
  {
    id: "cascading-gateway-outage",
    title: "SEV-1 Cascading Gateway & DB Outage",
    badge: "14-Component Full 3D/2D Surface",
    prompt:
      "Stream the full SEV-1 incident war-room showing the 3D topology of PostgreSQL pool starvation, API gateway failures, blast-radius sphere, and automated circuit breaker desk.",
    description:
      "Full hybrid 3D topology + 2D tactical HUD surface displaying 8 microservice nodes, traffic edges, blast radius, latency curves, and live log tailer.",
    buildSpec: buildCascadingOutageSpec,
  },
  {
    id: "regional-failover-standby",
    title: "Cross-Region Traffic Failover (EU-West)",
    badge: "Traffic Failover",
    prompt:
      "Isolate the US-East outage, highlight the promoted EU standby gateway in the 3D scene, and prepare the cross-region failover runbook.",
    description:
      "Demonstrates multi-datacenter 3D topology visualization with promoted hot-standby nodes and traffic re-routing.",
    buildSpec: buildRegionalFailoverSpec,
  },
  {
    id: "redis-memory-triage",
    title: "Redis L1 Cache Saturation & Eviction",
    badge: "Cache Triage",
    prompt:
      "Stream the Redis cache memory saturation incident showing caller dependencies and cache scale-out runbooks.",
    description:
      "Focused cache saturation war-room visualizing caller dependency blast radius and sharding controls.",
    buildSpec: buildRedisMemoryTriageSpec,
  },
];

/**
 * Synthesizes a valid RFC 6902 JSONL patch stream from any natural-language SRE prompt.
 */
export function synthesizeSpatialJsonlFromPrompt(promptText: string): string {
  const lower = promptText.toLowerCase();

  if (
    lower.includes("failover") ||
    lower.includes("region") ||
    lower.includes("eu") ||
    lower.includes("standby")
  ) {
    const spec = buildRegionalFailoverSpec();
    spec.elements["warroom-shell-failover"] = {
      ...spec.elements["warroom-shell-failover"]!,
      props: {
        ...spec.elements["warroom-shell-failover"]!.props,
        incidentTitle: `Synthesized for SRE intent: "${promptText.slice(0, 100)}"`,
      },
    };
    return specToJsonlStream(spec);
  }

  if (
    lower.includes("redis") ||
    lower.includes("cache") ||
    lower.includes("memory") ||
    lower.includes("oom")
  ) {
    const spec = buildRedisMemoryTriageSpec();
    spec.elements["warroom-shell-redis"] = {
      ...spec.elements["warroom-shell-redis"]!,
      props: {
        ...spec.elements["warroom-shell-redis"]!.props,
        incidentTitle: `Synthesized for SRE intent: "${promptText.slice(0, 100)}"`,
      },
    };
    return specToJsonlStream(spec);
  }

  const spec = buildCascadingOutageSpec();
  spec.elements["warroom-shell-root"] = {
    ...spec.elements["warroom-shell-root"]!,
    props: {
      ...spec.elements["warroom-shell-root"]!.props,
      incidentTitle: `Synthesized for SRE intent: "${promptText.slice(0, 100)}"`,
    },
  };
  return specToJsonlStream(spec);
}

export function chunkJsonlForStreaming(
  jsonl: string,
  targetChunks = 14
): string[] {
  const lines = jsonl
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= targetChunks) {
    return lines.map((l) => l + "\n");
  }
  const chunks: string[] = [];
  const batchSize = Math.max(1, Math.ceil(lines.length / targetChunks));
  for (let i = 0; i < lines.length; i += batchSize) {
    chunks.push(lines.slice(i, i + batchSize).join("\n") + "\n");
  }
  return chunks;
}

/**
 * Hostile / Corrupted AI Packet Batch used by the X-Ray Drawer's
 * "Inject Cascading Outage Chaos Packet" verification button.
 *
 * Proves all 4 runtime resilience layers simultaneously:
 * 1. Prototype pollution patch (`/elements/__proto__/polluted`) -> Blocked by DAG Sanitizer
 * 2. Out-of-bounds 3D scale prop (`scale: 99.9` -> auto-clamped to `4.0` with `<DiagnosticHealedBadge />`)
 * 3. Cyclic graph edge (`warroom-shell-root` added as child of leaf container -> severed by `sanitizeSpecGraph`)
 * 4. Unregistered hallucinated component type (`HallucinatedQuantumQubitMesh`) -> Quarantined in `<ElementFaultCard />`
 */
export function buildSpatialChaosPackets(currentRootKey = "warroom-shell-root"): string[] {
  const canvasKey =
    currentRootKey === "warroom-shell-failover"
      ? "canvas-viewport-eu"
      : currentRootKey === "warroom-shell-redis"
      ? "canvas-viewport-redis"
      : "canvas-viewport-3d";

  return [
    // 1. Prototype pollution attack (blocked at compiler gate)
    JSON.stringify({
      op: "add",
      path: "/elements/__proto__/polluted",
      value: "HACKED_SPATIAL_PROTO",
    }),
    // 2. Out-of-bounds scale factor (scale: 99.9 -> clamped to 4.0 by VerifiedCatalog)
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-healed-service-node",
      value: {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-chaos-fuzzed",
          name: "Chaos Fuzzed Node",
          tier: "SERVICE",
          position: [0, 0, 0],
          status: "CRITICAL_OUTAGE",
          scale: 99.9, // Out of bounds -> Clamped to 4.0
        },
        children: [],
      },
    }),
    // 3. Throwing ServiceMeshNode3D -> quarantined into <ElementFaultCard phase="react_render" />
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-throwing-node",
      value: {
        type: "ServiceMeshNode3D",
        props: {
          serviceId: "srv-chaos-throw",
          name: "CHAOS_TRIGGER_RENDER_CRASH",
          tier: "SERVICE",
          position: [0, 0, 0],
          status: "CRITICAL_OUTAGE",
          scale: 1.0,
        },
        children: [],
      },
    }),
    // 4. Unregistered hallucinated component type -> quarantined into <ElementFaultCard />
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-hallucinated-mesh",
      value: {
        type: "HallucinatedQuantumQubitMesh",
        props: {
          qubitEntanglementLevel: 9000,
        },
        children: [],
      },
    }),
    // 5. Attach healed node into canvas children so it renders with <DiagnosticHealedBadge />
    JSON.stringify({
      op: "add",
      path: `/elements/${canvasKey}/children/0`,
      value: "chaos-healed-service-node",
    }),
    // 6. Attach throwing node into canvas children so it renders with <ElementFaultCard />
    JSON.stringify({
      op: "add",
      path: `/elements/${canvasKey}/children/1`,
      value: "chaos-throwing-node",
    }),
    // 7. Attach hallucinated mesh into canvas children
    JSON.stringify({
      op: "add",
      path: `/elements/${canvasKey}/children/2`,
      value: "chaos-hallucinated-mesh",
    }),
    // 8. Deliberate cyclic edge back to root container -> severed by DAG Sanitizer
    JSON.stringify({
      op: "add",
      path: `/elements/${canvasKey}/children/3`,
      value: currentRootKey,
    }),
  ];
}

export interface LiveLlmEndpointConfig {
  endpointUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Streams RFC 6902 JSONL patches from a live OpenAI-compatible endpoint.
 */
export async function streamFromLiveLlmEndpoint(
  operatorIntent: string,
  config: LiveLlmEndpointConfig,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const systemPrompt = spatialVerifiedCatalog.prompt({
    customRules: [
      "Emit ONLY valid RFC 6902 JSON Patch lines (JSONL) that construct a Spec with `root` and `elements`.",
      "Never wrap output in markdown fences or prose.",
      "Always use `AegisWarRoomShell` as the root component.",
    ],
  });

  const response = await fetch(config.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      stream: true,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: operatorIntent },
      ],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Live LLM endpoint returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload);
        const deltaContent = parsed?.choices?.[0]?.delta?.content;
        if (typeof deltaContent === "string" && deltaContent.length > 0) {
          onChunk(deltaContent);
        }
      } catch {
        // Ignore partial SSE comments
      }
    }
  }
}
