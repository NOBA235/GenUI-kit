import { TimeTravelStateStore } from "@genui-studio/core";
import { liveMeshSimulator } from "./live-service-mesh.js";
import {
  ChaosFaultConfig,
  RemediationActionRequest,
  RemediationActionResult,
  ServiceTelemetryMetrics,
  TelemetryTrace,
} from "./types.js";
import { ServiceNodeData, TrafficEdgeData, StructuredErrorLog, SreAuditEntry } from "../data/cluster-seed.js";

/**
 * Bridges the live OpenTelemetry-compatible microservice mesh simulator
 * to Aegis 3D's TimeTravelStateStore.
 */
export class TelemetryBridge {
  private unsubscribeTrace: (() => void) | null = null;
  private unsubscribeMetrics: (() => void) | null = null;
  private store: TimeTravelStateStore | null = null;

  public attachToStore(store: TimeTravelStateStore): void {
    this.store = store;

    // Listen to metrics updates and sync to store
    this.unsubscribeMetrics = liveMeshSimulator.onMetrics((metrics) => {
      this.syncMetricsToStore(metrics);
    });

    // Listen to traces and push any error trace into logs
    this.unsubscribeTrace = liveMeshSimulator.onTrace((trace) => {
      this.syncTraceToLogs(trace);
    });
  }

  public detach(): void {
    if (this.unsubscribeMetrics) {
      this.unsubscribeMetrics();
      this.unsubscribeMetrics = null;
    }
    if (this.unsubscribeTrace) {
      this.unsubscribeTrace();
      this.unsubscribeTrace = null;
    }
    this.store = null;
  }

  public injectDbPoolChaos(): void {
    const fault: ChaosFaultConfig = {
      targetServiceId: "srv-payment-db",
      faultType: "DB_POOL_STARVATION",
      injectedLatencyMs: 1820,
      errorProbability: 0.95,
      description: "Postgres connection pool saturation (100/100 active connections)",
    };
    liveMeshSimulator.injectChaos(fault);
  }

  public clearChaos(): void {
    liveMeshSimulator.clearChaos();
  }

  public executeRemediation(req: RemediationActionRequest): RemediationActionResult {
    const result = liveMeshSimulator.executeRemediation(req);

    const actionTypeMap: Record<RemediationActionRequest["action"], SreAuditEntry["actionType"]> = {
      tripCircuitBreaker: "TRIP_CIRCUIT_BREAKER",
      triggerRegionalFailover: "TRIGGER_REGIONAL_FAILOVER",
      scaleServiceReplicas: "SCALE_SERVICE_REPLICAS",
      rollbackDeployment: "ROLLBACK_DEPLOYMENT",
    };

    if (this.store) {
      // Record in SRE audit trail
      const auditEntry: SreAuditEntry = {
        id: `aud-${Date.now().toString(36)}`,
        timestamp: result.timestamp,
        actionType: actionTypeMap[req.action] ?? "TRIP_CIRCUIT_BREAKER",
        targetServiceId: req.targetServiceId,
        summary: result.message,
        errorBudgetSavedPercent: 18.4,
        operator: req.operator ?? "agent@genui-studio.mcp",
      };

      const prevAudit = (this.store.get("/cluster/auditLog") as SreAuditEntry[] | undefined) ?? [];
      this.store.set("/cluster/auditLog", [auditEntry, ...prevAudit]);
    }

    return result;
  }

  private syncMetricsToStore(metrics: Record<string, ServiceTelemetryMetrics>): void {
    if (!this.store) return;

    const services = (this.store.get("/cluster/services") as Record<string, ServiceNodeData> | undefined) ?? {};
    let hasChanges = false;
    const updatedServices: Record<string, ServiceNodeData> = { ...services };

    for (const [id, metric] of Object.entries(metrics)) {
      const existing = updatedServices[id];
      if (existing) {
        if (
          existing.status !== metric.status ||
          existing.errorRatePercent !== metric.errorRatePercent ||
          existing.p95LatencyMs !== metric.p95Ms
        ) {
          updatedServices[id] = {
            ...existing,
            status: metric.status,
            errorRatePercent: metric.errorRatePercent,
            p50LatencyMs: metric.p50Ms,
            p95LatencyMs: metric.p95Ms,
            p99LatencyMs: metric.p99Ms,
            rps: metric.rps,
            cpuSaturationPercent: metric.cpuSaturationPercent,
            memorySaturationPercent: metric.memorySaturationPercent,
            circuitBreakerTripped: metric.status === "CIRCUIT_OPEN",
          };
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      this.store.set("/cluster/services", updatedServices);

      // Recompute summary
      const serviceList = Object.values(updatedServices);
      let unhealthyCount = 0;
      let totalRps = 0;
      let weightedErrors = 0;

      for (const s of serviceList) {
        totalRps += s.rps;
        weightedErrors += s.errorRatePercent * (s.rps / 1000);
        if (s.status === "CRITICAL_OUTAGE" || s.status === "DEGRADED" || s.status === "CIRCUIT_OPEN") {
          unhealthyCount++;
        }
      }

      const globalErrorRate = totalRps > 0 ? Math.round((weightedErrors / (totalRps / 1000)) * 10) / 10 : 0;
      const severity = unhealthyCount >= 3 ? "SEV-1" : unhealthyCount > 0 ? "SEV-2" : "NOMINAL";

      this.store.set("/cluster/summary", {
        activeIncidents: unhealthyCount > 0 ? 1 : 0,
        severity,
        incidentTitle:
          unhealthyCount >= 3
            ? "CRITICAL: PostgreSQL Aurora Pool Starvation Cascading to Ingress"
            : unhealthyCount > 0
            ? "WARNING: Elevated latency and packet degradation in US-East"
            : "Fleet Operating Normally — All Systems NOMINAL",
        elapsedMinutes: unhealthyCount > 0 ? 4 : 0,
        globalErrorRatePercent: globalErrorRate,
        globalRps: totalRps,
        totalNodes: serviceList.length,
        unhealthyNodes: unhealthyCount,
        clusterMttdMinutes: 1.4,
        errorBudgetRemainingPercent: Math.max(0, Math.round(98 - globalErrorRate * 2.5)),
      });
    }
  }

  private syncTraceToLogs(trace: TelemetryTrace): void {
    if (!this.store || !trace.hasError) return;

    const errorSpan = trace.spans.find((s) => s.statusCode === "ERROR");
    if (!errorSpan) return;

    const newLog: StructuredErrorLog = {
      id: `err-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      serviceId: errorSpan.serviceId,
      level: "ERROR",
      statusCode: (errorSpan.attributes["http.status_code"] as number) || 500,
      message: errorSpan.statusMessage || `Error in ${errorSpan.operationName} (${errorSpan.durationMs}ms)`,
      traceId: trace.traceId,
    };

    const prevLogs = (this.store.get("/cluster/logs") as StructuredErrorLog[] | undefined) ?? [];
    this.store.set("/cluster/logs", [newLog, ...prevLogs.slice(0, 24)]);
  }
}

export const telemetryBridge = new TelemetryBridge();
