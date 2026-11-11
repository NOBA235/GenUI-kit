import { z } from "zod";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

/**
 * 14-Component Hybrid 3D + 2D Verified Catalog for Aegis Spatial Ops & Incident Command.
 * Built on @genui-studio/core + @json-render/react/schema.
 */
export const spatialCatalogDefinitions = {
  components: {
    // ==========================================
    // 3D SPATIAL COMPONENTS
    // ==========================================
    AegisWarRoomShell: {
      description:
        "Root hybrid command-center container organizing the 3D spatial viewport and 2D tactical SRE incident HUD.",
      props: z.object({
        incidentTitle: z.string().min(1).max(140),
        severity: z.enum(["SEV-0", "SEV-1", "SEV-2", "NOMINAL"]),
        activeRegion: z.enum(["GLOBAL", "US-East", "EU-West", "APAC-South"]),
        hudPosition: z.enum(["RIGHT_SPLIT", "BOTTOM_DRAWER", "FULL_OVERLAY"]),
      }),
      slots: ["spatial", "hud"],
      fallbackProps: {
        incidentTitle: "Aegis 3D Spatial Incident Command Center",
        severity: "SEV-1" as const,
        activeRegion: "GLOBAL" as const,
        hudPosition: "RIGHT_SPLIT" as const,
      },
    },

    ClusterTopologyCanvas: {
      description:
        "3D WebGL scene viewport rendering the distributed microservice mesh with camera controls and memory safety guards.",
      props: z.object({
        cameraFov: z.number().int().min(30).max(90),
        enableOrbitControls: z.boolean(),
        enableGrid: z.boolean(),
        enableBloom: z.boolean(),
        ambientIntensity: z.number().min(0.1).max(2.0),
      }),
      slots: ["default"],
      fallbackProps: {
        cameraFov: 50,
        enableOrbitControls: true,
        enableGrid: true,
        enableBloom: true,
        ambientIntensity: 0.8,
      },
    },

    ServiceMeshNode3D: {
      description:
        "Interactive 3D microservice node mesh with status-driven emissive glow, floating HTML label, and raycast pointer selection.",
      props: z.object({
        serviceId: z.string().min(1).max(48),
        name: z.string().min(1).max(64),
        tier: z.enum(["INGRESS", "GATEWAY", "SERVICE", "CACHE", "DATABASE", "BROKER", "WORKER"]),
        position: z.tuple([
          z.number().min(-12).max(12),
          z.number().min(-12).max(12),
          z.number().min(-12).max(12),
        ]),
        status: z.enum(["NOMINAL", "DEGRADED", "CRITICAL_OUTAGE", "CIRCUIT_OPEN", "MAINTENANCE"]),
        scale: z.number().min(0.2).max(4.0),
      }),
      slots: [],
      fallbackProps: {
        serviceId: "srv-api-gateway",
        name: "API Gateway Core",
        tier: "GATEWAY" as const,
        position: [0, 1.4, 0] as [number, number, number],
        status: "NOMINAL" as const,
        scale: 1.0,
      },
    },

    TrafficFlowEdge3D: {
      description:
        "Directional 3D bezier connection line between upstream and downstream services with animated packet pulses.",
      props: z.object({
        edgeId: z.string().min(1).max(48),
        fromServiceId: z.string().min(1).max(48),
        toServiceId: z.string().min(1).max(48),
        status: z.enum(["NOMINAL", "DEGRADED", "CONGESTED", "SEVERED"]),
        particleSpeed: z.number().min(0.1).max(5.0),
      }),
      slots: [],
      fallbackProps: {
        edgeId: "edge-gw-auth",
        fromServiceId: "srv-api-gateway",
        toServiceId: "srv-auth",
        status: "NOMINAL" as const,
        particleSpeed: 1.0,
      },
    },

    BlastRadiusSphere3D: {
      description:
        "Translucent volumetric pulsating sphere indicating fault blast radius and downstream impact zone.",
      props: z.object({
        targetServiceId: z.string().min(1).max(48),
        radius: z.number().min(0.5).max(10.0),
        severity: z.enum(["CRITICAL", "HIGH", "MEDIUM"]),
        pulseRate: z.number().min(0.2).max(4.0),
      }),
      slots: [],
      fallbackProps: {
        targetServiceId: "srv-postgres-primary",
        radius: 3.2,
        severity: "CRITICAL" as const,
        pulseRate: 1.5,
      },
    },

    RegionZoneBoundary3D: {
      description:
        "Spatial bounding zone wireframe delimiting a regional datacenter or availability zone cluster.",
      props: z.object({
        regionName: z.enum(["US-East", "EU-West", "APAC-South"]),
        center: z.tuple([
          z.number().min(-12).max(12),
          z.number().min(-12).max(12),
          z.number().min(-12).max(12),
        ]),
        size: z.tuple([
          z.number().min(0.5).max(24),
          z.number().min(0.5).max(24),
          z.number().min(0.5).max(24),
        ]),
        wireframeColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
      }),
      slots: [],
      fallbackProps: {
        regionName: "US-East" as const,
        center: [0, 0, 0] as [number, number, number],
        size: [8, 6, 8] as [number, number, number],
        wireframeColor: "#38BDF8",
      },
    },

    // ==========================================
    // 2D TACTICAL HUD COMPONENTS
    // ==========================================
    IncidentHeroBanner: {
      description:
        "High-priority SEV header banner showing incident title, root-cause hypothesis, elapsed time, and quick mitigation trigger.",
      props: z.object({
        severity: z.enum(["SEV-0", "SEV-1", "SEV-2", "NOMINAL"]),
        title: z.string().min(1).max(140),
        summary: z.string().min(1).max(280),
        mttdMinutes: z.number().min(0).max(60),
      }),
      slots: [],
      fallbackProps: {
        severity: "SEV-1" as const,
        title: "Active SEV-1 Incident: PostgreSQL Pool Starvation",
        summary: "Aurora PostgreSQL primary connection lease saturation cascading to API Gateway and Order Processing.",
        mttdMinutes: 2.1,
      },
    },

    ServiceDiagnosticPanel: {
      description:
        "Deep-dive telemetry inspection card for the currently selected 3D service node showing CPU, Memory, RPS, and pod replicas.",
      props: z.object({
        defaultServiceId: z.string().min(1).max(48),
        showDependencies: z.boolean(),
      }),
      slots: [],
      fallbackProps: {
        defaultServiceId: "srv-api-gateway",
        showDependencies: true,
      },
    },

    LatencyHistogramCard: {
      description:
        "Interactive p50 / p95 / p99 latency curve & SLO error-budget burn distribution card bound to the selected service.",
      props: z.object({
        serviceId: z.string().min(1).max(48),
        timeWindow: z.enum(["5m", "15m", "1h", "6h"]),
      }),
      slots: [],
      fallbackProps: {
        serviceId: "srv-api-gateway",
        timeWindow: "15m" as const,
      },
    },

    ErrorLogTailer: {
      description:
        "Real-time streaming structured log tail showing HTTP 5xx codes, stack traces, and trace IDs.",
      props: z.object({
        title: z.string().min(1).max(64),
        maxEntries: z.number().int().min(3).max(25),
        filterLevel: z.enum(["ALL", "ERROR", "WARN", "FATAL"]),
      }),
      slots: [],
      fallbackProps: {
        title: "Cluster Structured Error Stream",
        maxEntries: 6,
        filterLevel: "ALL" as const,
      },
    },

    BlastRadiusDependencyTree: {
      description:
        "Visual topological tree showing upstream callers and downstream dependencies of the degraded node.",
      props: z.object({
        rootServiceId: z.string().min(1).max(48),
        depthLimit: z.number().int().min(1).max(4),
      }),
      slots: [],
      fallbackProps: {
        rootServiceId: "srv-api-gateway",
        depthLimit: 2,
      },
    },

    RunbookActionDesk: {
      description:
        "Interactive remediation desk allowing the incident commander to trip circuit breakers, trigger regional failovers, scale pods, or rollback.",
      props: z.object({
        heading: z.string().min(1).max(80),
        allowDirectExecution: z.boolean(),
      }),
      slots: [],
      fallbackProps: {
        heading: "Automated SRE Remediation Desk",
        allowDirectExecution: true,
      },
    },

    ClusterMetricsGrid: {
      description:
        "High-level SRE telemetry grid displaying Global Error Rate, Total Throughput RPS, and Error Budget Remaining.",
      props: z.object({
        heading: z.string().min(1).max(64),
        columns: z.enum(["2", "3", "4"]),
      }),
      slots: [],
      fallbackProps: {
        heading: "Global Fleet Telemetry",
        columns: "3" as const,
      },
    },

    SreAuditTrailBanner: {
      description:
        "Live immutable audit strip displaying every executed SRE remediation action with Time-Travel Undo hint.",
      props: z.object({
        title: z.string().min(1).max(80),
        maxEntries: z.number().int().min(2).max(10),
      }),
      slots: [],
      fallbackProps: {
        title: "Immutable SRE War-Room Audit Log",
        maxEntries: 5,
      },
    },

    TraceWaterfallViewer: {
      description:
        "High-density distributed trace waterfall Gantt visualizer rendering hierarchical spans, critical-path bottlenecks, database query statements, and error statuses.",
      props: z.object({
        title: z.string().min(1).max(100),
        traceId: z.string().min(1).max(64),
        rootSpanName: z.string().min(1).max(100),
        totalDurationMs: z.number().nonnegative(),
        spans: z.array(
          z.object({
            spanId: z.string().min(1).max(48),
            parentSpanId: z.string().nullable().optional(),
            serviceName: z.string().min(1).max(64),
            serviceId: z.string().min(1).max(48),
            operation: z.string().min(1).max(100),
            startOffsetMs: z.number().nonnegative(),
            durationMs: z.number().nonnegative(),
            status: z.enum(["OK", "ERROR"]),
            statusMessage: z.string().optional(),
            attributes: z
              .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
              .optional(),
          })
        ),
        highlightServiceId: z.string().optional(),
      }),
      slots: [],
      fallbackProps: {
        title: "Live Distributed Trace Waterfall",
        traceId: "tr-seed-sample",
        rootSpanName: "HTTP POST /api/v2/checkout",
        totalDurationMs: 42,
        spans: [
          {
            spanId: "sp-1",
            parentSpanId: null,
            serviceName: "Edge Ingress Router",
            serviceId: "srv-ingress",
            operation: "HTTP POST /api/v2/checkout",
            startOffsetMs: 0,
            durationMs: 42,
            status: "OK" as const,
          },
          {
            spanId: "sp-2",
            parentSpanId: "sp-1",
            serviceName: "API Gateway Core",
            serviceId: "srv-api-gateway",
            operation: "dispatch.route_checkout",
            startOffsetMs: 2,
            durationMs: 38,
            status: "OK" as const,
          },
        ],
      },
    },
  },

  actions: {
    tripCircuitBreaker: {
      description:
        "Trips an automated rate-limiting circuit breaker on the targeted service, shedding upstream queues and halting cascade failure.",
      params: z.object({
        serviceId: z.string().min(1),
        durationSeconds: z.number().int().min(30).max(3600).optional(),
      }),
    },
    triggerRegionalFailover: {
      description:
        "Shifts cross-region ingress traffic from a saturated datacenter to the hot-standby regional cluster.",
      params: z.object({
        fromRegion: z.string().min(1),
        toRegion: z.string().min(1),
        trafficPercentage: z.number().min(10).max(100).optional(),
      }),
    },
    scaleServiceReplicas: {
      description:
        "Scales out container pod replicas for a saturated microservice to relieve CPU and memory saturation.",
      params: z.object({
        serviceId: z.string().min(1),
        deltaReplicas: z.number().int().min(1).max(20),
      }),
    },
    rollbackDeployment: {
      description:
        "Executes a zero-downtime canary rollback to the previous known-stable container image version.",
      params: z.object({
        serviceId: z.string().min(1),
        targetVersion: z.string().min(1),
      }),
    },
  },
};

export const spatialVerifiedCatalog = createVerifiedCatalog(
  schema,
  spatialCatalogDefinitions,
);
