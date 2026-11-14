import {
  ChaosFaultConfig,
  OtelSpan,
  RemediationActionRequest,
  RemediationActionResult,
  ServiceTelemetryMetrics,
  TelemetryTrace,
} from "./types.js";

export interface MeshServiceDefinition {
  id: string;
  name: string;
  tier: "INGRESS" | "GATEWAY" | "SERVICE" | "CACHE" | "DATABASE" | "BROKER";
  region: "US-East" | "EU-West" | "APAC-South";
  baseLatencyMs: number;
  baseRps: number;
}

export const MESH_SERVICES: Record<string, MeshServiceDefinition> = {
  "srv-ingress": {
    id: "srv-ingress",
    name: "Edge Ingress Router",
    tier: "INGRESS",
    region: "US-East",
    baseLatencyMs: 3,
    baseRps: 2450,
  },
  "srv-api-gateway": {
    id: "srv-api-gateway",
    name: "API Gateway Core",
    tier: "GATEWAY",
    region: "US-East",
    baseLatencyMs: 5,
    baseRps: 2450,
  },
  "srv-auth": {
    id: "srv-auth",
    name: "Auth & IAM Broker",
    tier: "SERVICE",
    region: "US-East",
    baseLatencyMs: 8,
    baseRps: 1800,
  },
  "srv-order-service": {
    id: "srv-order-service",
    name: "Order Processing Engine",
    tier: "SERVICE",
    region: "US-East",
    baseLatencyMs: 14,
    baseRps: 920,
  },
  "srv-payment-v2": {
    id: "srv-payment-v2",
    name: "Payment Gateway V2",
    tier: "SERVICE",
    region: "US-East",
    baseLatencyMs: 18,
    baseRps: 640,
  },
  "srv-payment-db": {
    id: "srv-payment-db",
    name: "PostgreSQL Aurora Primary",
    tier: "DATABASE",
    region: "US-East",
    baseLatencyMs: 12,
    baseRps: 640,
  },
  "srv-inventory": {
    id: "srv-inventory",
    name: "Inventory Warehouse API",
    tier: "SERVICE",
    region: "US-East",
    baseLatencyMs: 9,
    baseRps: 890,
  },
  "srv-redis-cache": {
    id: "srv-redis-cache",
    name: "Redis Session Cache",
    tier: "CACHE",
    region: "US-East",
    baseLatencyMs: 2,
    baseRps: 1800,
  },
};

export class LiveServiceMeshSimulator {
  private activeFaults = new Map<string, ChaosFaultConfig>();
  private traceListeners = new Set<(trace: TelemetryTrace) => void>();
  private metricsListeners = new Set<(metrics: Record<string, ServiceTelemetryMetrics>) => void>();
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private traceHistory: TelemetryTrace[] = [];
  private maxHistorySize = 60;
  private circuitBreakers = new Set<string>();

  constructor(options?: { autoStart?: boolean }) {
    if (options?.autoStart) {
      this.startEmitting(3500);
    }
  }

  public startEmitting(intervalMs = 3500): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stopEmitting(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public onTrace(listener: (trace: TelemetryTrace) => void): () => void {
    this.traceListeners.add(listener);
    return () => this.traceListeners.delete(listener);
  }

  public onMetrics(listener: (metrics: Record<string, ServiceTelemetryMetrics>) => void): () => void {
    this.metricsListeners.add(listener);
    return () => this.metricsListeners.delete(listener);
  }

  public getTraceHistory(): TelemetryTrace[] {
    return [...this.traceHistory];
  }

  public getAnomalousTraces(): TelemetryTrace[] {
    return this.traceHistory.filter((t) => t.hasError || t.totalDurationMs > 300);
  }

  public injectChaos(fault: ChaosFaultConfig): void {
    this.activeFaults.set(fault.targetServiceId, fault);
    // Immediately emit a tick reflecting this fault
    this.tick();
  }

  public clearChaos(serviceId?: string): void {
    if (serviceId) {
      this.activeFaults.delete(serviceId);
      this.circuitBreakers.delete(serviceId);
    } else {
      this.activeFaults.clear();
      this.circuitBreakers.clear();
    }
    this.tick();
  }

  public executeRemediation(req: RemediationActionRequest): RemediationActionResult {
    const timestamp = new Date().toISOString();
    if (req.action === "tripCircuitBreaker") {
      this.circuitBreakers.add(req.targetServiceId);
      // Tripping the circuit breaker immediately isolates the degraded database!
      this.activeFaults.delete("srv-payment-db");
      this.activeFaults.delete(req.targetServiceId);
      this.tick();
      return {
        success: true,
        action: req.action,
        targetServiceId: req.targetServiceId,
        message: `Circuit breaker successfully tripped for ${req.targetServiceId}. Traffic rerouted to secondary queue.`,
        timestamp,
        verificationPassed: true,
      };
    }

    if (req.action === "scaleServiceReplicas") {
      this.activeFaults.delete(req.targetServiceId);
      this.activeFaults.delete("srv-payment-db");
      this.tick();
      return {
        success: true,
        action: req.action,
        targetServiceId: req.targetServiceId,
        message: `Successfully scaled replicas for ${req.targetServiceId} from 4 to 12. Connection pool recovered.`,
        timestamp,
        verificationPassed: true,
      };
    }

    if (req.action === "triggerRegionalFailover") {
      this.activeFaults.clear();
      this.tick();
      return {
        success: true,
        action: req.action,
        targetServiceId: req.targetServiceId,
        message: `Traffic successfully failed over from US-East to EU-West cluster. Active connections normalized.`,
        timestamp,
        verificationPassed: true,
      };
    }

    // Default rollback
    this.activeFaults.clear();
    this.tick();
    return {
      success: true,
      action: req.action,
      targetServiceId: req.targetServiceId,
      message: `Rollback deployment completed for ${req.targetServiceId}. Service returned to stable version.`,
      timestamp,
      verificationPassed: true,
    };
  }

  public tick(): void {
    const trace = this.simulateCheckoutTrace();
    this.traceHistory.push(trace);
    if (this.traceHistory.length > this.maxHistorySize) {
      this.traceHistory.shift();
    }

    // Notify trace listeners
    for (const listener of this.traceListeners) {
      try {
        listener(trace);
      } catch (err) {
        console.error("Trace listener error", err);
      }
    }

    // Calculate current metrics across all services
    const metrics = this.computeMetrics();
    for (const listener of this.metricsListeners) {
      try {
        listener(metrics);
      } catch (err) {
        console.error("Metrics listener error", err);
      }
    }
  }

  private simulateCheckoutTrace(): TelemetryTrace {
    const traceId = `tr-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    const now = Date.now();
    const hasDbFault = this.activeFaults.has("srv-payment-db");
    const isCircuitOpen = this.circuitBreakers.has("srv-payment-v2") || this.circuitBreakers.has("srv-payment-db");

    const spans: OtelSpan[] = [];

    // 1. Ingress Span
    const srvIngress = MESH_SERVICES["srv-ingress"]!;
    const ingressSpan: OtelSpan = {
      traceId,
      spanId: `sp-${Math.random().toString(36).slice(2, 8)}`,
      parentSpanId: null,
      serviceName: srvIngress.name,
      serviceId: srvIngress.id,
      operationName: "HTTP POST /api/v2/checkout",
      startTimeMs: 0,
      durationMs: hasDbFault && !isCircuitOpen ? 1860 : 42,
      statusCode: hasDbFault && !isCircuitOpen ? "ERROR" : "OK",
      statusMessage: hasDbFault && !isCircuitOpen ? "HTTP 504 Gateway Timeout" : undefined,
      attributes: {
        "http.method": "POST",
        "http.route": "/api/v2/checkout",
        "http.status_code": hasDbFault && !isCircuitOpen ? 504 : 200,
        "net.peer.ip": "198.51.100.44",
      },
    };
    spans.push(ingressSpan);

    // 2. API Gateway Span
    const srvGw = MESH_SERVICES["srv-api-gateway"]!;
    const gwSpan: OtelSpan = {
      traceId,
      spanId: `sp-${Math.random().toString(36).slice(2, 8)}`,
      parentSpanId: ingressSpan.spanId,
      serviceName: srvGw.name,
      serviceId: srvGw.id,
      operationName: "dispatch.route_checkout",
      startTimeMs: 2,
      durationMs: hasDbFault && !isCircuitOpen ? 1855 : 38,
      statusCode: hasDbFault && !isCircuitOpen ? "ERROR" : "OK",
      attributes: {
        "gw.route": "upstream:srv-order-service",
        "rpc.system": "grpc",
      },
    };
    spans.push(gwSpan);

    // 3. Auth Token Verification Span
    const srvAuth = MESH_SERVICES["srv-auth"]!;
    const authSpan: OtelSpan = {
      traceId,
      spanId: `sp-${Math.random().toString(36).slice(2, 8)}`,
      parentSpanId: gwSpan.spanId,
      serviceName: srvAuth.name,
      serviceId: srvAuth.id,
      operationName: "jwt.verify_session",
      startTimeMs: 5,
      durationMs: 8,
      statusCode: "OK",
      attributes: {
        "auth.tenant": "tenant_enterprise_419",
        "auth.role": "ORG_ADMIN",
      },
    };
    spans.push(authSpan);

    // 4. Order Processing Span
    const srvOrder = MESH_SERVICES["srv-order-service"]!;
    const orderSpan: OtelSpan = {
      traceId,
      spanId: `sp-${Math.random().toString(36).slice(2, 8)}`,
      parentSpanId: gwSpan.spanId,
      serviceName: srvOrder.name,
      serviceId: srvOrder.id,
      operationName: "orders.create_order",
      startTimeMs: 14,
      durationMs: hasDbFault && !isCircuitOpen ? 1840 : 28,
      statusCode: hasDbFault && !isCircuitOpen ? "ERROR" : "OK",
      statusMessage: hasDbFault && !isCircuitOpen ? "Downstream payment timeout" : undefined,
      attributes: {
        "order.items_count": 3,
        "order.total_amount_usd": 384.5,
      },
    };
    spans.push(orderSpan);

    // 5. Inventory Stock Check Span
    const srvInv = MESH_SERVICES["srv-inventory"]!;
    const invSpan: OtelSpan = {
      traceId,
      spanId: `sp-${Math.random().toString(36).slice(2, 8)}`,
      parentSpanId: orderSpan.spanId,
      serviceName: srvInv.name,
      serviceId: srvInv.id,
      operationName: "inventory.reserve_stock",
      startTimeMs: 18,
      durationMs: 9,
      statusCode: "OK",
      attributes: {
        "inventory.warehouse": "US-East-W1",
        "inventory.lock_acquired": true,
      },
    };
    spans.push(invSpan);

    // 6. Payment Service Span
    const srvPay = MESH_SERVICES["srv-payment-v2"]!;
    const paySpan: OtelSpan = {
      traceId,
      spanId: `sp-${Math.random().toString(36).slice(2, 8)}`,
      parentSpanId: orderSpan.spanId,
      serviceName: srvPay.name,
      serviceId: srvPay.id,
      operationName: isCircuitOpen ? "payment.fallback_async_queue" : "payment.charge_card",
      startTimeMs: 24,
      durationMs: isCircuitOpen ? 6 : hasDbFault ? 1826 : 18,
      statusCode: hasDbFault && !isCircuitOpen ? "ERROR" : "OK",
      statusMessage: isCircuitOpen
        ? "Circuit Breaker OPEN: Rerouted to async queue"
        : hasDbFault
        ? "Postgres pool connection acquisition timeout after 1800ms"
        : undefined,
      attributes: {
        "payment.provider": "STRIPE",
        "payment.circuit_breaker_active": isCircuitOpen,
      },
    };
    spans.push(paySpan);

    // 7. Database Query Span (if circuit is not open)
    if (!isCircuitOpen) {
      const srvDb = MESH_SERVICES["srv-payment-db"]!;
      const dbSpan: OtelSpan = {
        traceId,
        spanId: `sp-${Math.random().toString(36).slice(2, 8)}`,
        parentSpanId: paySpan.spanId,
        serviceName: srvDb.name,
        serviceId: srvDb.id,
        operationName: "pg_pool.acquire_and_commit",
        startTimeMs: 26,
        durationMs: hasDbFault ? 1820 : 12,
        statusCode: hasDbFault ? "ERROR" : "OK",
        statusMessage: hasDbFault
          ? "FATAL: remaining connection slots are reserved for non-replication superuser connections (max_connections=100 reached)"
          : undefined,
        attributes: {
          "db.system": "postgresql",
          "db.statement": "UPDATE customer_ledgers SET balance = balance - 384.50 WHERE account_id = $1",
          "db.pool.active_connections": hasDbFault ? 100 : 28,
          "db.pool.max_connections": 100,
          "db.pool.wait_queue_length": hasDbFault ? 46 : 0,
        },
      };
      spans.push(dbSpan);
    }

    const totalDurationMs = spans.reduce((max, s) => Math.max(max, s.startTimeMs + s.durationMs), 0);
    const hasError = spans.some((s) => s.statusCode === "ERROR");

    return {
      traceId,
      rootSpan: ingressSpan,
      spans,
      totalDurationMs,
      hasError,
      serviceIds: Array.from(new Set(spans.map((s) => s.serviceId))),
    };
  }

  public computeMetrics(): Record<string, ServiceTelemetryMetrics> {
    const hasDbFault = this.activeFaults.has("srv-payment-db");
    const isCircuitOpen = this.circuitBreakers.has("srv-payment-v2") || this.circuitBreakers.has("srv-payment-db");

    const result: Record<string, ServiceTelemetryMetrics> = {};

    for (const [id, def] of Object.entries(MESH_SERVICES)) {
      if (id === "srv-payment-db") {
        result[id] = {
          serviceId: id,
          serviceName: def.name,
          rps: hasDbFault && !isCircuitOpen ? 680 : def.baseRps,
          errorRatePercent: hasDbFault && !isCircuitOpen ? 92.4 : 0.0,
          p50Ms: hasDbFault && !isCircuitOpen ? 1800 : 11,
          p95Ms: hasDbFault && !isCircuitOpen ? 1845 : 18,
          p99Ms: hasDbFault && !isCircuitOpen ? 1890 : 24,
          status: isCircuitOpen ? "CIRCUIT_OPEN" : hasDbFault ? "CRITICAL_OUTAGE" : "NOMINAL",
          cpuSaturationPercent: hasDbFault && !isCircuitOpen ? 98.2 : 24.5,
          memorySaturationPercent: hasDbFault && !isCircuitOpen ? 94.1 : 38.0,
          connectionPoolUsagePercent: hasDbFault && !isCircuitOpen ? 100 : 28,
        };
      } else if (id === "srv-payment-v2") {
        result[id] = {
          serviceId: id,
          serviceName: def.name,
          rps: def.baseRps,
          errorRatePercent: isCircuitOpen ? 0.0 : hasDbFault ? 84.1 : 0.0,
          p50Ms: isCircuitOpen ? 6 : hasDbFault ? 1810 : 16,
          p95Ms: isCircuitOpen ? 8 : hasDbFault ? 1835 : 22,
          p99Ms: isCircuitOpen ? 12 : hasDbFault ? 1860 : 30,
          status: isCircuitOpen ? "CIRCUIT_OPEN" : hasDbFault ? "CRITICAL_OUTAGE" : "NOMINAL",
          cpuSaturationPercent: hasDbFault && !isCircuitOpen ? 88.0 : 31.0,
          memorySaturationPercent: 42.0,
        };
      } else if (id === "srv-order-service") {
        result[id] = {
          serviceId: id,
          serviceName: def.name,
          rps: def.baseRps,
          errorRatePercent: isCircuitOpen ? 0.0 : hasDbFault ? 42.6 : 0.0,
          p50Ms: isCircuitOpen ? 26 : hasDbFault ? 1820 : 24,
          p95Ms: isCircuitOpen ? 32 : hasDbFault ? 1848 : 34,
          p99Ms: isCircuitOpen ? 40 : hasDbFault ? 1870 : 42,
          status: hasDbFault && !isCircuitOpen ? "DEGRADED" : "NOMINAL",
          cpuSaturationPercent: hasDbFault && !isCircuitOpen ? 72.0 : 28.0,
          memorySaturationPercent: 36.0,
        };
      } else if (id === "srv-api-gateway") {
        result[id] = {
          serviceId: id,
          serviceName: def.name,
          rps: def.baseRps,
          errorRatePercent: isCircuitOpen ? 0.0 : hasDbFault ? 18.5 : 0.0,
          p50Ms: isCircuitOpen ? 38 : hasDbFault ? 1830 : 34,
          p95Ms: isCircuitOpen ? 46 : hasDbFault ? 1860 : 48,
          p99Ms: isCircuitOpen ? 58 : hasDbFault ? 1895 : 62,
          status: hasDbFault && !isCircuitOpen ? "DEGRADED" : "NOMINAL",
          cpuSaturationPercent: hasDbFault && !isCircuitOpen ? 64.0 : 35.0,
          memorySaturationPercent: 44.0,
        };
      } else {
        result[id] = {
          serviceId: id,
          serviceName: def.name,
          rps: def.baseRps,
          errorRatePercent: 0.0,
          p50Ms: def.baseLatencyMs,
          p95Ms: Math.round(def.baseLatencyMs * 1.4),
          p99Ms: Math.round(def.baseLatencyMs * 1.8),
          status: "NOMINAL",
          cpuSaturationPercent: 22.0,
          memorySaturationPercent: 30.0,
        };
      }
    }

    return result;
  }
}

// Global singleton instance for live telemetry in spatial-ops
export const liveMeshSimulator = new LiveServiceMeshSimulator();
