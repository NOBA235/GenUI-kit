import { z } from "zod";

export interface McpSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  serviceName: string;
  serviceId: string;
  operationName: string;
  startTimeMs: number;
  durationMs: number;
  statusCode: "OK" | "ERROR";
  statusMessage?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface McpTraceWaterfall {
  traceId: string;
  rootSpanName: string;
  totalDurationMs: number;
  hasError: boolean;
  bottleneckServiceId?: string;
  rootCauseHypothesis?: string;
  spans: McpSpan[];
}

export interface McpServiceMetric {
  serviceId: string;
  serviceName: string;
  rps: number;
  errorRatePercent: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  status: "NOMINAL" | "DEGRADED" | "CRITICAL_OUTAGE" | "CIRCUIT_OPEN";
  cpuSaturationPercent: number;
  memorySaturationPercent: number;
  connectionPoolUsagePercent?: number;
}

export interface McpTelemetryProvider {
  getMetrics: (filter?: { serviceId?: string; minErrorRate?: number }) => {
    clusterSummary: {
      activeIncidents: number;
      severity: string;
      globalRps: number;
      globalErrorRatePercent: number;
      unhealthyNodes: number;
    };
    services: McpServiceMetric[];
  };
  getTraceWaterfall: (traceId?: string, onlyAnomalous?: boolean) => McpTraceWaterfall;
  executeRemediation: (req: {
    action: string;
    targetServiceId: string;
    parameters?: Record<string, unknown>;
  }) => {
    success: boolean;
    action: string;
    targetServiceId: string;
    message: string;
    timestamp: string;
    verificationPassed: boolean;
  };
}

// Default in-memory telemetry provider for standalone MCP server
class DefaultMcpTelemetryProvider implements McpTelemetryProvider {
  private chaosActive = true; // starts with anomalous state ready for AI investigation

  public getMetrics(filter?: { serviceId?: string; minErrorRate?: number }) {
    const services: McpServiceMetric[] = [
      {
        serviceId: "srv-ingress",
        serviceName: "Edge Ingress Router",
        rps: 2450,
        errorRatePercent: this.chaosActive ? 18.5 : 0.0,
        p50Ms: this.chaosActive ? 1830 : 5,
        p95Ms: this.chaosActive ? 1860 : 8,
        p99Ms: this.chaosActive ? 1895 : 12,
        status: this.chaosActive ? "DEGRADED" : "NOMINAL",
        cpuSaturationPercent: 42,
        memorySaturationPercent: 55,
      },
      {
        serviceId: "srv-api-gateway",
        serviceName: "API Gateway Core",
        rps: 2450,
        errorRatePercent: this.chaosActive ? 18.5 : 0.0,
        p50Ms: this.chaosActive ? 1830 : 6,
        p95Ms: this.chaosActive ? 1860 : 10,
        p99Ms: this.chaosActive ? 1895 : 14,
        status: this.chaosActive ? "DEGRADED" : "NOMINAL",
        cpuSaturationPercent: 64,
        memorySaturationPercent: 44,
      },
      {
        serviceId: "srv-order-service",
        serviceName: "Order Processing Engine",
        rps: 920,
        errorRatePercent: this.chaosActive ? 42.6 : 0.0,
        p50Ms: this.chaosActive ? 1820 : 14,
        p95Ms: this.chaosActive ? 1848 : 22,
        p99Ms: this.chaosActive ? 1870 : 30,
        status: this.chaosActive ? "DEGRADED" : "NOMINAL",
        cpuSaturationPercent: 72,
        memorySaturationPercent: 36,
      },
      {
        serviceId: "srv-payment-v2",
        serviceName: "Payment Gateway V2",
        rps: 640,
        errorRatePercent: this.chaosActive ? 84.1 : 0.0,
        p50Ms: this.chaosActive ? 1810 : 16,
        p95Ms: this.chaosActive ? 1835 : 22,
        p99Ms: this.chaosActive ? 1860 : 30,
        status: this.chaosActive ? "CRITICAL_OUTAGE" : "NOMINAL",
        cpuSaturationPercent: 88,
        memorySaturationPercent: 42,
      },
      {
        serviceId: "srv-payment-db",
        serviceName: "PostgreSQL Aurora Primary",
        rps: 640,
        errorRatePercent: this.chaosActive ? 92.4 : 0.0,
        p50Ms: this.chaosActive ? 1800 : 11,
        p95Ms: this.chaosActive ? 1845 : 18,
        p99Ms: this.chaosActive ? 1890 : 24,
        status: this.chaosActive ? "CRITICAL_OUTAGE" : "NOMINAL",
        cpuSaturationPercent: 98.2,
        memorySaturationPercent: 94.1,
        connectionPoolUsagePercent: this.chaosActive ? 100 : 28,
      },
    ];

    let filtered = services;
    if (filter?.serviceId) {
      filtered = filtered.filter((s) => s.serviceId === filter.serviceId);
    }
    if (filter?.minErrorRate !== undefined) {
      filtered = filtered.filter((s) => s.errorRatePercent >= filter.minErrorRate!);
    }

    const unhealthyCount = filtered.filter(
      (s) => s.status === "CRITICAL_OUTAGE" || s.status === "DEGRADED"
    ).length;

    return {
      clusterSummary: {
        activeIncidents: this.chaosActive ? 1 : 0,
        severity: this.chaosActive ? "SEV-1" : "NOMINAL",
        globalRps: 68400,
        globalErrorRatePercent: this.chaosActive ? 14.8 : 0.0,
        unhealthyNodes: unhealthyCount,
      },
      services: filtered,
    };
  }

  public getTraceWaterfall(traceId?: string, onlyAnomalous = true): McpTraceWaterfall {
    const isError = this.chaosActive || onlyAnomalous;
    const tid = traceId ?? (isError ? "tr-9a8b7c6d-outage" : "tr-1a2b3c4d-nominal");

    if (isError) {
      return {
        traceId: tid,
        rootSpanName: "HTTP POST /api/v2/checkout",
        totalDurationMs: 1860,
        hasError: true,
        bottleneckServiceId: "srv-payment-db",
        rootCauseHypothesis:
          "PostgreSQL primary connection lease saturation: active_connections reached max limit (100/100). Threads blocking on pg_pool.acquire for 1,820ms before timing out.",
        spans: [
          {
            traceId: tid,
            spanId: "sp-001",
            parentSpanId: null,
            serviceName: "Edge Ingress Router",
            serviceId: "srv-ingress",
            operationName: "HTTP POST /api/v2/checkout",
            startTimeMs: 0,
            durationMs: 1860,
            statusCode: "ERROR",
            statusMessage: "HTTP 504 Gateway Timeout",
            attributes: { "http.status_code": 504, "http.method": "POST" },
          },
          {
            traceId: tid,
            spanId: "sp-002",
            parentSpanId: "sp-001",
            serviceName: "API Gateway Core",
            serviceId: "srv-api-gateway",
            operationName: "dispatch.route_checkout",
            startTimeMs: 2,
            durationMs: 1855,
            statusCode: "ERROR",
            attributes: { "rpc.system": "grpc" },
          },
          {
            traceId: tid,
            spanId: "sp-003",
            parentSpanId: "sp-002",
            serviceName: "Order Processing Engine",
            serviceId: "srv-order-service",
            operationName: "orders.create_order",
            startTimeMs: 14,
            durationMs: 1840,
            statusCode: "ERROR",
            statusMessage: "Downstream payment timeout",
            attributes: { "order.items_count": 3 },
          },
          {
            traceId: tid,
            spanId: "sp-004",
            parentSpanId: "sp-003",
            serviceName: "Payment Gateway V2",
            serviceId: "srv-payment-v2",
            operationName: "payment.charge_card",
            startTimeMs: 24,
            durationMs: 1826,
            statusCode: "ERROR",
            statusMessage: "Database connection timeout after 1800ms",
            attributes: { "payment.provider": "STRIPE" },
          },
          {
            traceId: tid,
            spanId: "sp-005",
            parentSpanId: "sp-004",
            serviceName: "PostgreSQL Aurora Primary",
            serviceId: "srv-payment-db",
            operationName: "pg_pool.acquire_and_commit",
            startTimeMs: 26,
            durationMs: 1820,
            statusCode: "ERROR",
            statusMessage: "FATAL: max_connections=100 reached (active=100, waiting=46)",
            attributes: {
              "db.system": "postgresql",
              "db.statement": "UPDATE customer_ledgers SET balance = balance - 384.50 WHERE account_id = $1",
              "db.pool.active_connections": 100,
              "db.pool.max_connections": 100,
            },
          },
        ],
      };
    }

    return {
      traceId: tid,
      rootSpanName: "HTTP POST /api/v2/checkout",
      totalDurationMs: 42,
      hasError: false,
      spans: [
        {
          traceId: tid,
          spanId: "sp-001",
          parentSpanId: null,
          serviceName: "Edge Ingress Router",
          serviceId: "srv-ingress",
          operationName: "HTTP POST /api/v2/checkout",
          startTimeMs: 0,
          durationMs: 42,
          statusCode: "OK",
          attributes: { "http.status_code": 200 },
        },
      ],
    };
  }

  public executeRemediation(req: {
    action: string;
    targetServiceId: string;
    parameters?: Record<string, unknown>;
  }) {
    this.chaosActive = false; // clears chaos
    return {
      success: true,
      action: req.action,
      targetServiceId: req.targetServiceId,
      message: `Remediation action '${req.action}' executed successfully on ${req.targetServiceId}. Fleet health verified: 0% errors, <45ms p95 latency.`,
      timestamp: new Date().toISOString(),
      verificationPassed: true,
    };
  }
}

let activeTelemetryProvider: McpTelemetryProvider = new DefaultMcpTelemetryProvider();

export function setMcpTelemetryProvider(provider: McpTelemetryProvider): void {
  activeTelemetryProvider = provider;
}

export function getMcpTelemetryProvider(): McpTelemetryProvider {
  return activeTelemetryProvider;
}

export function handleQueryTelemetryMetrics(input?: {
  serviceId?: string;
  minErrorRate?: number;
}) {
  return activeTelemetryProvider.getMetrics(input);
}

export function handleFetchTraceSpans(input?: {
  traceId?: string;
  onlyAnomalous?: boolean;
}) {
  return activeTelemetryProvider.getTraceWaterfall(input?.traceId, input?.onlyAnomalous);
}

export function handleExecuteRemediation(input: {
  action: string;
  targetServiceId: string;
  parameters?: Record<string, unknown>;
}) {
  return activeTelemetryProvider.executeRemediation(input);
}
