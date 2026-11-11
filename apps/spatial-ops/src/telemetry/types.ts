/**
 * OpenTelemetry-compatible Span and Telemetry definitions for Aegis 3D
 */

export type SpanStatusCode = "OK" | "ERROR" | "UNSET";

export interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  serviceName: string;
  serviceId: string;
  operationName: string;
  startTimeMs: number;
  durationMs: number;
  statusCode: SpanStatusCode;
  statusMessage?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface TelemetryTrace {
  traceId: string;
  rootSpan: OtelSpan;
  spans: OtelSpan[];
  totalDurationMs: number;
  hasError: boolean;
  serviceIds: string[];
}

export interface ServiceTelemetryMetrics {
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

export interface ChaosFaultConfig {
  targetServiceId: string;
  faultType: "DB_POOL_STARVATION" | "HIGH_LATENCY" | "ERROR_SPIKE";
  injectedLatencyMs: number;
  errorProbability: number;
  description: string;
}

export interface RemediationActionRequest {
  action: "tripCircuitBreaker" | "scaleServiceReplicas" | "triggerRegionalFailover" | "rollbackDeployment";
  targetServiceId: string;
  operator?: string;
  parameters?: Record<string, unknown>;
}

export interface RemediationActionResult {
  success: boolean;
  action: string;
  targetServiceId: string;
  message: string;
  timestamp: string;
  verificationPassed: boolean;
}
