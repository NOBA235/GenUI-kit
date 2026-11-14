export type ServiceTier =
  | "INGRESS"
  | "GATEWAY"
  | "SERVICE"
  | "CACHE"
  | "DATABASE"
  | "BROKER"
  | "WORKER";

export type ServiceHealthStatus =
  | "NOMINAL"
  | "DEGRADED"
  | "CRITICAL_OUTAGE"
  | "CIRCUIT_OPEN"
  | "MAINTENANCE";

export type RegionDatacenter = "US-East" | "EU-West" | "APAC-South";

export interface ServiceNodeData {
  id: string;
  name: string;
  tier: ServiceTier;
  region: RegionDatacenter;
  position: [number, number, number];
  status: ServiceHealthStatus;
  rps: number;
  errorRatePercent: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  cpuSaturationPercent: number;
  memorySaturationPercent: number;
  replicas: number;
  maxReplicas: number;
  version: string;
  circuitBreakerTripped: boolean;
  dependencies: string[];
  callers: string[];
}

export interface TrafficEdgeData {
  id: string;
  from: string;
  to: string;
  status: "NOMINAL" | "DEGRADED" | "CONGESTED" | "SEVERED";
  rps: number;
  latencyMs: number;
  errorRatePercent: number;
}

export interface StructuredErrorLog {
  id: string;
  timestamp: string;
  serviceId: string;
  level: "ERROR" | "WARN" | "INFO" | "FATAL";
  statusCode: number;
  message: string;
  traceId: string;
}

export interface SreAuditEntry {
  id: string;
  timestamp: string;
  actionType:
    | "TRIP_CIRCUIT_BREAKER"
    | "TRIGGER_REGIONAL_FAILOVER"
    | "SCALE_SERVICE_REPLICAS"
    | "ROLLBACK_DEPLOYMENT"
    | "SIMULATE_TRAFFIC_SURGE";
  targetServiceId: string;
  summary: string;
  errorBudgetSavedPercent: number;
  operator: string;
}

export interface ClusterSummary {
  activeIncidents: number;
  severity: "SEV-0" | "SEV-1" | "SEV-2" | "NOMINAL";
  incidentTitle: string;
  elapsedMinutes: number;
  globalErrorRatePercent: number;
  globalRps: number;
  totalNodes: number;
  unhealthyNodes: number;
  clusterMttdMinutes: number;
  errorBudgetRemainingPercent: number;
}

export interface SpatialClusterState {
  cluster: {
    summary: ClusterSummary;
    selectedServiceId: string;
    services: Record<string, ServiceNodeData>;
    edges: TrafficEdgeData[];
    logs: StructuredErrorLog[];
    auditLog: SreAuditEntry[];
    filters: {
      tierFilter: string;
      regionFilter: string;
      searchQuery: string;
    };
  };
}

export interface MutableClusterStoreAdapter {
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
  update?: (updates: Record<string, unknown>) => void;
}

export function createInitialClusterState(): SpatialClusterState {
  const services: Record<string, ServiceNodeData> = {
    "srv-ingress": {
      id: "srv-ingress",
      name: "Global Edge Ingress",
      tier: "INGRESS",
      region: "US-East",
      position: [0, 2.8, 0],
      status: "NOMINAL",
      rps: 34500,
      errorRatePercent: 1.2,
      p50LatencyMs: 12,
      p95LatencyMs: 28,
      p99LatencyMs: 44,
      cpuSaturationPercent: 42,
      memorySaturationPercent: 55,
      replicas: 16,
      maxReplicas: 32,
      version: "v4.12.0",
      circuitBreakerTripped: false,
      dependencies: ["srv-api-gateway", "srv-eu-failover-gw"],
      callers: ["ext-clients"],
    },
    "srv-api-gateway": {
      id: "srv-api-gateway",
      name: "API Gateway Core",
      tier: "GATEWAY",
      region: "US-East",
      position: [0, 1.4, 0],
      status: "CRITICAL_OUTAGE",
      rps: 24800,
      errorRatePercent: 29.4,
      p50LatencyMs: 140,
      p95LatencyMs: 480,
      p99LatencyMs: 980,
      cpuSaturationPercent: 94,
      memorySaturationPercent: 88,
      replicas: 18,
      maxReplicas: 24,
      version: "v3.8.4",
      circuitBreakerTripped: false,
      dependencies: ["srv-auth", "srv-billing", "srv-order-proc", "srv-redis-cache"],
      callers: ["srv-ingress"],
    },
    "srv-eu-failover-gw": {
      id: "srv-eu-failover-gw",
      name: "EU Standby Gateway",
      tier: "GATEWAY",
      region: "EU-West",
      position: [3.4, 1.6, -1.8],
      status: "NOMINAL",
      rps: 9700,
      errorRatePercent: 0.4,
      p50LatencyMs: 24,
      p95LatencyMs: 42,
      p99LatencyMs: 65,
      cpuSaturationPercent: 28,
      memorySaturationPercent: 34,
      replicas: 8,
      maxReplicas: 24,
      version: "v3.8.4",
      circuitBreakerTripped: false,
      dependencies: ["srv-auth", "srv-postgres-replica"],
      callers: ["srv-ingress"],
    },
    "srv-auth": {
      id: "srv-auth",
      name: "OAuth2 & Session Vault",
      tier: "SERVICE",
      region: "US-East",
      position: [-2.6, 0.6, -0.8],
      status: "DEGRADED",
      rps: 14200,
      errorRatePercent: 12.8,
      p50LatencyMs: 65,
      p95LatencyMs: 180,
      p99LatencyMs: 420,
      cpuSaturationPercent: 82,
      memorySaturationPercent: 79,
      replicas: 10,
      maxReplicas: 16,
      version: "v2.19.1",
      circuitBreakerTripped: false,
      dependencies: ["srv-redis-cache", "srv-postgres-primary"],
      callers: ["srv-api-gateway", "srv-eu-failover-gw"],
    },
    "srv-billing": {
      id: "srv-billing",
      name: "Stripe & Invoicing Worker",
      tier: "SERVICE",
      region: "US-East",
      position: [2.6, 0.6, -0.8],
      status: "NOMINAL",
      rps: 4200,
      errorRatePercent: 0.8,
      p50LatencyMs: 38,
      p95LatencyMs: 95,
      p99LatencyMs: 180,
      cpuSaturationPercent: 48,
      memorySaturationPercent: 62,
      replicas: 6,
      maxReplicas: 12,
      version: "v5.2.0",
      circuitBreakerTripped: false,
      dependencies: ["srv-postgres-primary", "srv-kafka-broker"],
      callers: ["srv-api-gateway"],
    },
    "srv-order-proc": {
      id: "srv-order-proc",
      name: "Order Processing Pipeline",
      tier: "SERVICE",
      region: "US-East",
      position: [0, 0.1, -1.8],
      status: "CRITICAL_OUTAGE",
      rps: 12800,
      errorRatePercent: 36.2,
      p50LatencyMs: 220,
      p95LatencyMs: 650,
      p99LatencyMs: 1250,
      cpuSaturationPercent: 98,
      memorySaturationPercent: 91,
      replicas: 14,
      maxReplicas: 20,
      version: "v4.0.1",
      circuitBreakerTripped: false,
      dependencies: ["srv-inventory", "srv-postgres-primary", "srv-kafka-broker"],
      callers: ["srv-api-gateway"],
    },
    "srv-inventory": {
      id: "srv-inventory",
      name: "Warehouse Inventory Mesh",
      tier: "SERVICE",
      region: "US-East",
      position: [-3.2, -0.6, -2.2],
      status: "NOMINAL",
      rps: 6100,
      errorRatePercent: 1.1,
      p50LatencyMs: 32,
      p95LatencyMs: 78,
      p99LatencyMs: 145,
      cpuSaturationPercent: 52,
      memorySaturationPercent: 58,
      replicas: 8,
      maxReplicas: 14,
      version: "v3.1.2",
      circuitBreakerTripped: false,
      dependencies: ["srv-postgres-primary", "srv-redis-cache"],
      callers: ["srv-order-proc"],
    },
    "srv-notification": {
      id: "srv-notification",
      name: "Courier Push & Email",
      tier: "SERVICE",
      region: "US-East",
      position: [3.2, -0.6, -2.2],
      status: "NOMINAL",
      rps: 3100,
      errorRatePercent: 0.3,
      p50LatencyMs: 44,
      p95LatencyMs: 110,
      p99LatencyMs: 210,
      cpuSaturationPercent: 34,
      memorySaturationPercent: 42,
      replicas: 4,
      maxReplicas: 8,
      version: "v2.8.0",
      circuitBreakerTripped: false,
      dependencies: ["srv-kafka-broker"],
      callers: ["srv-billing", "srv-order-proc"],
    },
    "srv-recommendation": {
      id: "srv-recommendation",
      name: "Vector & Inference Engine",
      tier: "SERVICE",
      region: "US-East",
      position: [1.4, -0.6, -3.2],
      status: "NOMINAL",
      rps: 4800,
      errorRatePercent: 0.6,
      p50LatencyMs: 48,
      p95LatencyMs: 120,
      p99LatencyMs: 240,
      cpuSaturationPercent: 64,
      memorySaturationPercent: 78,
      replicas: 6,
      maxReplicas: 12,
      version: "v1.14.0",
      circuitBreakerTripped: false,
      dependencies: ["srv-search-elastic", "srv-redis-cache"],
      callers: ["srv-api-gateway"],
    },
    "srv-redis-cache": {
      id: "srv-redis-cache",
      name: "Redis Sharded L1 Cache",
      tier: "CACHE",
      region: "US-East",
      position: [-1.8, -1.6, -1.2],
      status: "DEGRADED",
      rps: 48000,
      errorRatePercent: 8.4,
      p50LatencyMs: 8,
      p95LatencyMs: 34,
      p99LatencyMs: 185,
      cpuSaturationPercent: 91,
      memorySaturationPercent: 96,
      replicas: 6,
      maxReplicas: 10,
      version: "redis-7.2.4",
      circuitBreakerTripped: false,
      dependencies: [],
      callers: ["srv-api-gateway", "srv-auth", "srv-inventory", "srv-recommendation"],
    },
    "srv-postgres-primary": {
      id: "srv-postgres-primary",
      name: "Aurora PostgreSQL Primary",
      tier: "DATABASE",
      region: "US-East",
      position: [0, -2.0, -2.8],
      status: "CRITICAL_OUTAGE",
      rps: 18900,
      errorRatePercent: 24.6,
      p50LatencyMs: 85,
      p95LatencyMs: 380,
      p99LatencyMs: 890,
      cpuSaturationPercent: 96,
      memorySaturationPercent: 89,
      replicas: 1,
      maxReplicas: 1,
      version: "pg-16.2",
      circuitBreakerTripped: false,
      dependencies: [],
      callers: ["srv-auth", "srv-billing", "srv-order-proc", "srv-inventory"],
    },
    "srv-postgres-replica": {
      id: "srv-postgres-replica",
      name: "Aurora Read Replica EU",
      tier: "DATABASE",
      region: "EU-West",
      position: [2.8, -2.0, -2.8],
      status: "NOMINAL",
      rps: 6400,
      errorRatePercent: 0.1,
      p50LatencyMs: 22,
      p95LatencyMs: 48,
      p99LatencyMs: 82,
      cpuSaturationPercent: 38,
      memorySaturationPercent: 44,
      replicas: 2,
      maxReplicas: 4,
      version: "pg-16.2",
      circuitBreakerTripped: false,
      dependencies: [],
      callers: ["srv-eu-failover-gw"],
    },
    "srv-kafka-broker": {
      id: "srv-kafka-broker",
      name: "Kafka Event Bus Cluster",
      tier: "BROKER",
      region: "US-East",
      position: [-2.4, -1.6, -3.4],
      status: "NOMINAL",
      rps: 28000,
      errorRatePercent: 0.2,
      p50LatencyMs: 14,
      p95LatencyMs: 32,
      p99LatencyMs: 64,
      cpuSaturationPercent: 54,
      memorySaturationPercent: 62,
      replicas: 5,
      maxReplicas: 9,
      version: "kafka-3.7.0",
      circuitBreakerTripped: false,
      dependencies: [],
      callers: ["srv-billing", "srv-order-proc", "srv-notification"],
    },
    "srv-search-elastic": {
      id: "srv-search-elastic",
      name: "OpenSearch Vector Index",
      tier: "DATABASE",
      region: "US-East",
      position: [-3.8, -1.8, -0.8],
      status: "NOMINAL",
      rps: 5200,
      errorRatePercent: 0.5,
      p50LatencyMs: 28,
      p95LatencyMs: 72,
      p99LatencyMs: 135,
      cpuSaturationPercent: 62,
      memorySaturationPercent: 71,
      replicas: 4,
      maxReplicas: 8,
      version: "os-2.12.0",
      circuitBreakerTripped: false,
      dependencies: [],
      callers: ["srv-recommendation"],
    },
    "srv-worker-pool": {
      id: "srv-worker-pool",
      name: "Async ETL & Reindex Pool",
      tier: "WORKER",
      region: "US-East",
      position: [3.8, -1.4, -1.2],
      status: "NOMINAL",
      rps: 1800,
      errorRatePercent: 0.2,
      p50LatencyMs: 120,
      p95LatencyMs: 320,
      p99LatencyMs: 640,
      cpuSaturationPercent: 44,
      memorySaturationPercent: 52,
      replicas: 8,
      maxReplicas: 16,
      version: "v2.4.1",
      circuitBreakerTripped: false,
      dependencies: ["srv-postgres-primary", "srv-kafka-broker"],
      callers: [],
    },
    "srv-audit-log": {
      id: "srv-audit-log",
      name: "WORM Compliance Log Store",
      tier: "DATABASE",
      region: "US-East",
      position: [1.8, -2.2, -4.0],
      status: "NOMINAL",
      rps: 3200,
      errorRatePercent: 0.1,
      p50LatencyMs: 18,
      p95LatencyMs: 44,
      p99LatencyMs: 76,
      cpuSaturationPercent: 32,
      memorySaturationPercent: 40,
      replicas: 3,
      maxReplicas: 5,
      version: "v1.2.0",
      circuitBreakerTripped: false,
      dependencies: [],
      callers: ["srv-billing", "srv-auth"],
    },
  };

  const edges: TrafficEdgeData[] = [
    {
      id: "edge-ingress-gw",
      from: "srv-ingress",
      to: "srv-api-gateway",
      status: "CONGESTED",
      rps: 24800,
      latencyMs: 140,
      errorRatePercent: 29.4,
    },
    {
      id: "edge-ingress-eu",
      from: "srv-ingress",
      to: "srv-eu-failover-gw",
      status: "NOMINAL",
      rps: 9700,
      latencyMs: 24,
      errorRatePercent: 0.4,
    },
    {
      id: "edge-gw-auth",
      from: "srv-api-gateway",
      to: "srv-auth",
      status: "DEGRADED",
      rps: 14200,
      latencyMs: 65,
      errorRatePercent: 12.8,
    },
    {
      id: "edge-gw-order",
      from: "srv-api-gateway",
      to: "srv-order-proc",
      status: "SEVERED",
      rps: 12800,
      latencyMs: 220,
      errorRatePercent: 36.2,
    },
    {
      id: "edge-gw-billing",
      from: "srv-api-gateway",
      to: "srv-billing",
      status: "NOMINAL",
      rps: 4200,
      latencyMs: 38,
      errorRatePercent: 0.8,
    },
    {
      id: "edge-gw-redis",
      from: "srv-api-gateway",
      to: "srv-redis-cache",
      status: "DEGRADED",
      rps: 22000,
      latencyMs: 34,
      errorRatePercent: 8.4,
    },
    {
      id: "edge-order-inventory",
      from: "srv-order-proc",
      to: "srv-inventory",
      status: "NOMINAL",
      rps: 6100,
      latencyMs: 32,
      errorRatePercent: 1.1,
    },
    {
      id: "edge-order-pg",
      from: "srv-order-proc",
      to: "srv-postgres-primary",
      status: "SEVERED",
      rps: 9400,
      latencyMs: 380,
      errorRatePercent: 24.6,
    },
    {
      id: "edge-auth-pg",
      from: "srv-auth",
      to: "srv-postgres-primary",
      status: "DEGRADED",
      rps: 4800,
      latencyMs: 180,
      errorRatePercent: 12.8,
    },
    {
      id: "edge-order-kafka",
      from: "srv-order-proc",
      to: "srv-kafka-broker",
      status: "NOMINAL",
      rps: 8200,
      latencyMs: 16,
      errorRatePercent: 0.2,
    },
    {
      id: "edge-billing-kafka",
      from: "srv-billing",
      to: "srv-kafka-broker",
      status: "NOMINAL",
      rps: 3100,
      latencyMs: 14,
      errorRatePercent: 0.1,
    },
    {
      id: "edge-kafka-notif",
      from: "srv-kafka-broker",
      to: "srv-notification",
      status: "NOMINAL",
      rps: 2800,
      latencyMs: 22,
      errorRatePercent: 0.2,
    },
  ];

  const logs: StructuredErrorLog[] = [
    {
      id: "log-101",
      timestamp: "2026-11-10T08:14:02.114Z",
      serviceId: "srv-postgres-primary",
      level: "FATAL",
      statusCode: 500,
      message: "FATAL: remaining connection slots are reserved for non-replication superuser connections (max_connections=500 exceeded)",
      traceId: "trace-9912a-db-starve",
    },
    {
      id: "log-102",
      timestamp: "2026-11-10T08:14:03.481Z",
      serviceId: "srv-order-proc",
      level: "ERROR",
      statusCode: 503,
      message: "HikariPool-1 - Connection is not available, request timed out after 30005ms (timeout awaiting DB lease)",
      traceId: "trace-9912b-order-timeout",
    },
    {
      id: "log-103",
      timestamp: "2026-11-10T08:14:05.122Z",
      serviceId: "srv-api-gateway",
      level: "ERROR",
      statusCode: 502,
      message: "Upstream downstream cluster 'srv-order-proc' returned 503 Service Unavailable: upstream connect error or disconnect/reset before headers",
      traceId: "trace-9912c-gw-502",
    },
    {
      id: "log-104",
      timestamp: "2026-11-10T08:14:08.902Z",
      serviceId: "srv-redis-cache",
      level: "WARN",
      statusCode: 429,
      message: "OOM command not allowed when used memory > 'maxmemory' (96.4% saturation threshold tripped)",
      traceId: "trace-9912d-redis-oom",
    },
    {
      id: "log-105",
      timestamp: "2026-11-10T08:14:12.339Z",
      serviceId: "srv-auth",
      level: "WARN",
      statusCode: 504,
      message: "Session token verification timed out waiting on Redis fallback to PostgreSQL auth_sessions table",
      traceId: "trace-9912e-auth-fallback",
    },
  ];

  const auditLog: SreAuditEntry[] = [
    {
      id: "sre-aud-01",
      timestamp: "2026-11-10T08:00:00Z",
      actionType: "SIMULATE_TRAFFIC_SURGE",
      targetServiceId: "srv-api-gateway",
      summary: "Simulated Q4 flash sale spike: traffic jumped from 11k RPS to 34.5k RPS on US-East ingress",
      errorBudgetSavedPercent: 0,
      operator: "chaos-monkey@aegis-sre.io",
    },
  ];

  const summary: ClusterSummary = {
    activeIncidents: 1,
    severity: "SEV-1",
    incidentTitle: "PostgreSQL Pool Starvation Cascading to API Gateway & Order Processing",
    elapsedMinutes: 14,
    globalErrorRatePercent: 14.8,
    globalRps: 68400,
    totalNodes: 16,
    unhealthyNodes: 3,
    clusterMttdMinutes: 2.1,
    errorBudgetRemainingPercent: 62.4,
  };

  return {
    cluster: {
      summary,
      selectedServiceId: "srv-api-gateway",
      services,
      edges,
      logs,
      auditLog,
      filters: {
        tierFilter: "ALL",
        regionFilter: "ALL",
        searchQuery: "",
      },
    },
  };
}

export function recomputeClusterSummary(
  services: Record<string, ServiceNodeData>
): ClusterSummary {
  const serviceList = Object.values(services);
  let unhealthyCount = 0;
  let totalErrorRate = 0;
  let totalRps = 0;

  for (const s of serviceList) {
    totalRps += s.rps;
    totalErrorRate += s.errorRatePercent * (s.rps / 10000);
    if (s.status === "CRITICAL_OUTAGE" || s.status === "DEGRADED" || s.status === "CIRCUIT_OPEN") {
      unhealthyCount++;
    }
  }

  const globalErrorRate = Math.min(
    100,
    Math.round((totalErrorRate / Math.max(1, totalRps / 10000)) * 10) / 10
  );

  const severity: ClusterSummary["severity"] =
    unhealthyCount >= 3
      ? "SEV-1"
      : unhealthyCount > 0
      ? "SEV-2"
      : "NOMINAL";

  return {
    activeIncidents: unhealthyCount > 0 ? 1 : 0,
    severity,
    incidentTitle:
      unhealthyCount === 0
        ? "Nominal Operations — Zero Active Severity Incidents"
        : `${severity}: ${unhealthyCount} Cluster Nodes Compromised or Tripped`,
    elapsedMinutes: unhealthyCount > 0 ? 14 : 0,
    globalErrorRatePercent: globalErrorRate,
    globalRps: totalRps,
    totalNodes: serviceList.length,
    unhealthyNodes: unhealthyCount,
    clusterMttdMinutes: 2.1,
    errorBudgetRemainingPercent: Math.max(0, 100 - globalErrorRate * 2.5),
  };
}

/**
 * Executes a verified, stateful SRE mitigation mutation against the TimeTravelStateStore.
 * Uses atomic `store.update({...})` so TimeTravelStateStore records a single atomic
 * undo/redo snapshot per action.
 */
export function executeSreMutation(
  store: MutableClusterStoreAdapter,
  actionType:
    | "tripCircuitBreaker"
    | "triggerRegionalFailover"
    | "scaleServiceReplicas"
    | "rollbackDeployment",
  payload: Record<string, unknown>
): SreAuditEntry {
  const services = structuredClone(
    (store.get("/cluster/services") as Record<string, ServiceNodeData> | undefined) ?? {}
  );
  const edges = structuredClone(
    (store.get("/cluster/edges") as TrafficEdgeData[] | undefined) ?? []
  );
  const auditLog = structuredClone(
    (store.get("/cluster/auditLog") as SreAuditEntry[] | undefined) ?? []
  );
  const logs = structuredClone(
    (store.get("/cluster/logs") as StructuredErrorLog[] | undefined) ?? []
  );

  let auditEntry: SreAuditEntry;

  if (actionType === "tripCircuitBreaker") {
    const serviceId = String(payload.serviceId ?? "srv-order-proc");
    const target = services[serviceId] ?? Object.values(services)[0];
    if (!target) {
      return {
        id: `sre-aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actionType: "TRIP_CIRCUIT_BREAKER",
        targetServiceId: serviceId || "none",
        summary: "No active service discovered yet to trip circuit breaker",
        errorBudgetSavedPercent: 0,
        operator: "sre-lead@aegis-warroom.io",
      };
    }

    target.circuitBreakerTripped = true;
    target.status = "CIRCUIT_OPEN";
    target.errorRatePercent = 0.1;
    target.p99LatencyMs = 15;
    target.cpuSaturationPercent = Math.max(20, target.cpuSaturationPercent - 45);

    // Sever connecting incoming edges so traffic stops flooding
    for (const edge of edges) {
      if (edge.to === target.id) {
        edge.status = "SEVERED";
        edge.errorRatePercent = 0;
      }
    }

    auditEntry = {
      id: `sre-aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: "TRIP_CIRCUIT_BREAKER",
      targetServiceId: target.id,
      summary: `Tripped circuit breaker on ${target.name} (${target.id}) — shed upstream queue, isolated cascading panic`,
      errorBudgetSavedPercent: 18.4,
      operator: "sre-lead@aegis-warroom.io",
    };

    logs.unshift({
      id: `log-sre-${Date.now()}`,
      timestamp: new Date().toISOString(),
      serviceId: target.id,
      level: "INFO",
      statusCode: 200,
      message: `[CIRCUIT_BREAKER] Tripped circuit breaker for ${target.id}. Ingress requests immediately fast-failed with HTTP 429/fallback.`,
      traceId: `trace-cb-${target.id}`,
    });
  } else if (actionType === "triggerRegionalFailover") {
    const fromRegion = String(payload.fromRegion ?? "US-East");
    const toRegion = String(payload.toRegion ?? "EU-West");

    // Route 80% traffic to EU standby gateway and replicas
    const standbyGw = services["srv-eu-failover-gw"];
    const primaryGw = services["srv-api-gateway"];
    if (standbyGw && primaryGw) {
      standbyGw.status = "NOMINAL";
      standbyGw.rps += Math.round(primaryGw.rps * 0.7);
      standbyGw.replicas = Math.min(standbyGw.maxReplicas, standbyGw.replicas + 8);

      primaryGw.rps = Math.round(primaryGw.rps * 0.3);
      primaryGw.status = "DEGRADED";
      primaryGw.errorRatePercent = 4.2;
      primaryGw.cpuSaturationPercent = 54;
    }

    // Restore edges
    for (const edge of edges) {
      if (edge.to === "srv-eu-failover-gw") {
        edge.status = "NOMINAL";
        edge.rps += 14000;
      }
    }

    auditEntry = {
      id: `sre-aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: "TRIGGER_REGIONAL_FAILOVER",
      targetServiceId: "srv-eu-failover-gw",
      summary: `Executed regional traffic failover from ${fromRegion} to ${toRegion}: shifted 70% traffic to EU standby cluster`,
      errorBudgetSavedPercent: 24.1,
      operator: "sre-lead@aegis-warroom.io",
    };
  } else if (actionType === "scaleServiceReplicas") {
    const serviceId = String(payload.serviceId ?? "srv-api-gateway");
    const target = services[serviceId] ?? Object.values(services)[0];
    if (!target) {
      return {
        id: `sre-aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actionType: "SCALE_SERVICE_REPLICAS",
        targetServiceId: serviceId || "none",
        summary: "No active service discovered yet to scale replicas",
        errorBudgetSavedPercent: 0,
        operator: "sre-lead@aegis-warroom.io",
      };
    }
    const deltaReplicas = Number(payload.deltaReplicas ?? 6);

    const prevReplicas = target.replicas;
    target.replicas = Math.max(1, Math.min(target.maxReplicas, target.replicas + deltaReplicas));
    target.cpuSaturationPercent = Math.max(25, Math.round(target.cpuSaturationPercent * (prevReplicas / target.replicas)));
    target.memorySaturationPercent = Math.max(30, Math.round(target.memorySaturationPercent * (prevReplicas / target.replicas)));
    if (target.cpuSaturationPercent < 70 && target.status === "CRITICAL_OUTAGE") {
      target.status = "DEGRADED";
      target.errorRatePercent = Math.round(target.errorRatePercent * 0.4);
    }

    auditEntry = {
      id: `sre-aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: "SCALE_SERVICE_REPLICAS",
      targetServiceId: target.id,
      summary: `Scaled ${target.name} replicas from ${prevReplicas} to ${target.replicas} pods (saturation dropped to ${target.cpuSaturationPercent}%)`,
      errorBudgetSavedPercent: 12.0,
      operator: "sre-lead@aegis-warroom.io",
    };
  } else {
    // rollbackDeployment
    const serviceId = String(payload.serviceId ?? "srv-api-gateway");
    const target = services[serviceId] ?? Object.values(services)[0];
    if (!target) {
      return {
        id: `sre-aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actionType: "ROLLBACK_DEPLOYMENT",
        targetServiceId: serviceId || "none",
        summary: "No active service discovered yet to rollback deployment",
        errorBudgetSavedPercent: 0,
        operator: "sre-lead@aegis-warroom.io",
      };
    }
    const targetVersion = String(payload.targetVersion ?? "v3.8.3-stable");

    const prevVersion = target.version;
    target.version = targetVersion;
    target.status = "NOMINAL";
    target.errorRatePercent = 0.5;
    target.p99LatencyMs = 85;
    target.cpuSaturationPercent = 48;

    auditEntry = {
      id: `sre-aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: "ROLLBACK_DEPLOYMENT",
      targetServiceId: target.id,
      summary: `Canary rollback executed on ${target.name}: reverted from ${prevVersion} to ${targetVersion} — health restored to NOMINAL`,
      errorBudgetSavedPercent: 32.5,
      operator: "sre-lead@aegis-warroom.io",
    };
  }

  auditLog.unshift(auditEntry);
  const nextSummary = recomputeClusterSummary(services);

  if (typeof store.update === "function") {
    store.update({
      "/cluster/services": services,
      "/cluster/edges": edges,
      "/cluster/logs": logs,
      "/cluster/auditLog": auditLog,
      "/cluster/summary": nextSummary,
    });
  } else {
    store.set("/cluster/services", services);
    store.set("/cluster/edges", edges);
    store.set("/cluster/logs", logs);
    store.set("/cluster/auditLog", auditLog);
    store.set("/cluster/summary", nextSummary);
  }

  return auditEntry;
}
