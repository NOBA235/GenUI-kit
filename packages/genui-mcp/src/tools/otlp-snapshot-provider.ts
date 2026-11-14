import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  McpServiceMetric,
  McpSpan,
  McpTelemetryProvider,
  McpTraceWaterfall,
} from "./telemetry-tools.js";

interface RawSnapshotService {
  id: string;
  name: string;
  rps: number;
  errorRatePercent: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  status: McpServiceMetric["status"];
  cpuSaturationPercent: number;
  memorySaturationPercent: number;
}

interface RawSnapshotSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  serviceName: string;
  serviceId: string;
  operationName: string;
  startTimeMs: number;
  durationMs: number;
  statusCode: "OK" | "ERROR" | "UNSET";
  statusMessage?: string;
  attributes: Record<string, string | number | boolean>;
}

interface RawSnapshotTrace {
  traceId: string;
  rootSpan: {
    operationName: string;
    serviceId: string;
  };
  spans: RawSnapshotSpan[];
  totalDurationMs: number;
  hasError: boolean;
}

interface RawOtlpSnapshotFile {
  mode?: "WAITING" | "LIVE";
  services?: Record<string, RawSnapshotService>;
  summary?: {
    activeIncidents?: number;
    severity?: string;
    globalRps?: number;
    globalErrorRatePercent?: number;
    unhealthyNodes?: number;
  };
  recentTraces?: RawSnapshotTrace[];
  bottleneckServiceId?: string | null;
}

export function getDefaultOtlpSnapshotPath(): string {
  return (
    process.env.SPATIAL_OPS_OTLP_SNAPSHOT ??
    path.join(os.homedir(), ".spatial-ops", "otlp-snapshot.json")
  );
}

/**
 * MCP Telemetry Provider backed by the local OTLP HTTP/JSON collector's
 * atomic topology snapshot file (`~/.spatial-ops/otlp-snapshot.json`).
 */
export class OtlpSnapshotMcpTelemetryProvider implements McpTelemetryProvider {
  private readonly snapshotPath: string;

  constructor(snapshotPath = getDefaultOtlpSnapshotPath()) {
    this.snapshotPath = snapshotPath;
  }

  private readSnapshot(): RawOtlpSnapshotFile | null {
    try {
      if (!fs.existsSync(this.snapshotPath)) {
        return null;
      }
      const raw = fs.readFileSync(this.snapshotPath, "utf8").trim();
      if (!raw) return null;
      return JSON.parse(raw) as RawOtlpSnapshotFile;
    } catch {
      return null;
    }
  }

  public getMetrics(filter?: { serviceId?: string; minErrorRate?: number }) {
    const snapshot = this.readSnapshot();
    const rawServices = snapshot?.services ? Object.values(snapshot.services) : [];

    let services: McpServiceMetric[] = rawServices.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      rps: s.rps,
      errorRatePercent: s.errorRatePercent,
      p50Ms: s.p50LatencyMs,
      p95Ms: s.p95LatencyMs,
      p99Ms: s.p99LatencyMs,
      status: s.status,
      cpuSaturationPercent: s.cpuSaturationPercent,
      memorySaturationPercent: s.memorySaturationPercent,
    }));

    if (filter?.serviceId) {
      services = services.filter((s) => s.serviceId === filter.serviceId);
    }
    if (filter?.minErrorRate !== undefined) {
      services = services.filter(
        (s) => s.errorRatePercent >= filter.minErrorRate!
      );
    }

    const unhealthyNodes = services.filter(
      (s) => s.status === "CRITICAL_OUTAGE" || s.status === "DEGRADED"
    ).length;

    return {
      clusterSummary: {
        activeIncidents: snapshot?.summary?.activeIncidents ?? 0,
        severity: snapshot?.summary?.severity ?? "NOMINAL",
        globalRps: snapshot?.summary?.globalRps ?? 0,
        globalErrorRatePercent: snapshot?.summary?.globalErrorRatePercent ?? 0,
        unhealthyNodes,
      },
      services,
    };
  }

  public getTraceWaterfall(
    traceId?: string,
    onlyAnomalous = true
  ): McpTraceWaterfall {
    const snapshot = this.readSnapshot();
    const traces = Array.isArray(snapshot?.recentTraces)
      ? snapshot.recentTraces
      : [];

    const chosen =
      (traceId ? traces.find((t) => t.traceId === traceId) : undefined) ??
      (onlyAnomalous ? traces.find((t) => t.hasError) : undefined) ??
      traces[0];

    if (!chosen) {
      return {
        traceId: traceId ?? "none",
        rootSpanName: "No OTLP spans ingested yet on :4318",
        totalDurationMs: 0,
        hasError: false,
        rootCauseHypothesis:
          "Point a service to OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 (OTEL_EXPORTER_OTLP_PROTOCOL=http/json) and run `pnpm --filter @genui-studio/spatial-ops collector`.",
        spans: [],
      };
    }

    const errorSpan = [...chosen.spans]
      .filter((s) => s.statusCode === "ERROR")
      .sort((a, b) => b.durationMs - a.durationMs)[0];

    const rootCauseHypothesis = errorSpan
      ? `${errorSpan.serviceName} (${errorSpan.operationName}) failed in ${errorSpan.durationMs}ms${errorSpan.statusMessage ? `: ${errorSpan.statusMessage}` : ""}.`
      : undefined;

    const normalizedSpans: McpSpan[] = chosen.spans.map((s) => ({
      traceId: s.traceId,
      spanId: s.spanId,
      parentSpanId: s.parentSpanId ?? null,
      serviceName: s.serviceName,
      serviceId: s.serviceId,
      operationName: s.operationName,
      startTimeMs: s.startTimeMs,
      durationMs: s.durationMs,
      statusCode: s.statusCode === "ERROR" ? "ERROR" : "OK",
      statusMessage: s.statusMessage,
      attributes: s.attributes ?? {},
    }));

    return {
      traceId: chosen.traceId,
      rootSpanName: chosen.rootSpan?.operationName ?? normalizedSpans[0]?.operationName ?? "root",
      totalDurationMs: chosen.totalDurationMs,
      hasError: chosen.hasError,
      bottleneckServiceId:
        errorSpan?.serviceId ?? snapshot?.bottleneckServiceId ?? undefined,
      rootCauseHypothesis,
      spans: normalizedSpans,
    };
  }

  public executeRemediation(req: {
    action: string;
    targetServiceId: string;
    parameters?: Record<string, unknown>;
  }) {
    const snapshot = this.readSnapshot();
    const exists = Boolean(snapshot?.services?.[req.targetServiceId]);
    return {
      success: true,
      action: req.action,
      targetServiceId: req.targetServiceId,
      message: exists
        ? `Recorded local Time-Travel remediation action '${req.action}' for observed OTLP service '${req.targetServiceId}'. No external control-plane mutation was executed.`
        : `Service '${req.targetServiceId}' is not currently present in the local OTLP snapshot (${this.snapshotPath}); recorded dry-run remediation request '${req.action}'.`,
      timestamp: new Date().toISOString(),
      verificationPassed: exists,
    };
  }
}
