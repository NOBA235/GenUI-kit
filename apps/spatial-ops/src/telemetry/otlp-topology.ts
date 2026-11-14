import type { Spec } from "@json-render/core";
import type {
  ClusterSummary,
  RegionDatacenter,
  ServiceHealthStatus,
  ServiceNodeData,
  ServiceTier,
  SpatialClusterState,
  StructuredErrorLog,
  TrafficEdgeData,
} from "../data/cluster-seed.js";
import type {
  OtelSpan,
  SpanStatusCode,
  TelemetryTrace,
} from "./types.js";

// ============================================================================
// Standard OpenTelemetry OTLP/HTTP JSON (ExportTraceServiceRequest) Types
// ============================================================================

export interface OtlpAnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values?: OtlpAnyValue[] };
  kvlistValue?: { values?: OtlpKeyValue[] };
}

export interface OtlpKeyValue {
  key: string;
  value?: OtlpAnyValue;
}

export interface OtlpSpanRaw {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: number | string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OtlpKeyValue[];
  status?: {
    code?: number | string;
    message?: string;
  };
}

export interface OtlpScopeSpans {
  scope?: { name?: string; version?: string };
  spans?: OtlpSpanRaw[];
}

export interface OtlpResourceSpans {
  resource?: { attributes?: OtlpKeyValue[] };
  scopeSpans?: OtlpScopeSpans[];
  instrumentationLibrarySpans?: OtlpScopeSpans[];
}

export interface OtlpExportTraceServiceRequest {
  resourceSpans?: OtlpResourceSpans[];
}

// ============================================================================
// Standard OpenTelemetry OTLP/HTTP JSON (Logs & Metrics) Types
// ============================================================================

export interface OtlpLogRecordRaw {
  timeUnixNano?: string | number;
  observedTimeUnixNano?: string | number;
  severityNumber?: number;
  severityText?: string;
  body?: OtlpAnyValue;
  attributes?: OtlpKeyValue[];
  traceId?: string;
  spanId?: string;
}

export interface OtlpScopeLogs {
  scope?: { name?: string; version?: string };
  logRecords?: OtlpLogRecordRaw[];
}

export interface OtlpResourceLogs {
  resource?: { attributes?: OtlpKeyValue[] };
  scopeLogs?: OtlpScopeLogs[];
  instrumentationLibraryLogs?: OtlpScopeLogs[];
}

export interface OtlpExportLogsServiceRequest {
  resourceLogs?: OtlpResourceLogs[];
}

export interface OtlpNumberDataPoint {
  timeUnixNano?: string | number;
  startTimeUnixNano?: string | number;
  asDouble?: number;
  asInt?: number | string;
  attributes?: OtlpKeyValue[];
}

export interface OtlpHistogramDataPoint {
  timeUnixNano?: string | number;
  startTimeUnixNano?: string | number;
  count?: string | number;
  sum?: number;
  attributes?: OtlpKeyValue[];
}

export interface OtlpMetricRaw {
  name?: string;
  description?: string;
  unit?: string;
  gauge?: { dataPoints?: OtlpNumberDataPoint[] };
  sum?: { dataPoints?: OtlpNumberDataPoint[] };
  histogram?: { dataPoints?: OtlpHistogramDataPoint[] };
}

export interface OtlpScopeMetrics {
  scope?: { name?: string; version?: string };
  metrics?: OtlpMetricRaw[];
}

export interface OtlpResourceMetrics {
  resource?: { attributes?: OtlpKeyValue[] };
  scopeMetrics?: OtlpScopeMetrics[];
  instrumentationLibraryMetrics?: OtlpScopeMetrics[];
}

export interface OtlpExportMetricsServiceRequest {
  resourceMetrics?: OtlpResourceMetrics[];
}

export interface OtlpNormalizedLog extends StructuredErrorLog {
  serviceName: string;
  serviceVersion: string;
  region: RegionDatacenter;
  inferredTier: ServiceTier;
}

export interface OtlpServiceMetricSample {
  serviceId: string;
  serviceName: string;
  serviceVersion: string;
  region: RegionDatacenter;
  inferredTier: ServiceTier;
  metricName: string;
  value: number;
  unit: string;
  timestampMs: number;
}

export interface OtlpLogsIngestionStats {
  acceptedLogs: number;
  rejectedLogs: number;
  traceIds: string[];
  servicesDiscovered: string[];
}

export interface OtlpMetricsIngestionStats {
  acceptedMetrics: number;
  rejectedMetrics: number;
  servicesDiscovered: string[];
}

// ============================================================================
// Normalized Internal Span & Dynamic Topology Types
// ============================================================================

export type OtlpSpanKind =
  | "UNSPECIFIED"
  | "INTERNAL"
  | "SERVER"
  | "CLIENT"
  | "PRODUCER"
  | "CONSUMER";

export interface VirtualDependencyHint {
  targetServiceId: string;
  targetName: string;
  targetTier: ServiceTier;
  targetRegion: RegionDatacenter;
  relation: string;
}

export interface OtlpNormalizedSpan extends OtelSpan {
  kind: OtlpSpanKind;
  startUnixNano: string;
  endUnixNano: string;
  serviceVersion: string;
  region: RegionDatacenter;
  inferredTier: ServiceTier;
  virtualTarget?: VirtualDependencyHint;
}

export interface OtlpTraceRecord {
  traceId: string;
  firstSeenAtMs: number;
  updatedAtMs: number;
  minStartUnixNano: string;
  spans: OtlpNormalizedSpan[];
}

export interface OtlpIngestionStats {
  acceptedSpans: number;
  rejectedSpans: number;
  traceIds: string[];
  servicesDiscovered: string[];
}

export interface DynamicTopologySnapshot {
  mode: "WAITING" | "LIVE";
  totalIngestedSpans: number;
  totalIngestedTraces: number;
  totalIngestedLogs?: number;
  totalIngestedMetrics?: number;
  lastIngestedAt: string | null;
  services: Record<string, ServiceNodeData>;
  edges: TrafficEdgeData[];
  summary: ClusterSummary;
  recentTraces: TelemetryTrace[];
  logs: StructuredErrorLog[];
  bottleneckServiceId: string | null;
  bottleneckTraceId?: string | null;
  criticalPathServiceIds?: string[];
}

export interface SerializableOtlpStoreState {
  version: 1;
  totalIngestedSpans: number;
  totalIngestedTraces: number;
  totalIngestedLogs?: number;
  totalIngestedMetrics?: number;
  lastIngestedAt: string | null;
  traces: OtlpTraceRecord[];
  logs?: OtlpNormalizedLog[];
}

// ============================================================================
// Bounds & Normalization Helpers
// ============================================================================

const MAX_RESOURCE_SPANS_PER_REQUEST = 64;
const MAX_SCOPES_PER_RESOURCE = 32;
const MAX_SPANS_PER_SCOPE = 256;
const MAX_LOGS_IN_RING = 200;
const MAX_ATTRIBUTES_PER_ENTITY = 48;
const MAX_STRING_LENGTH = 512;
const MAX_SPANS_PER_TRACE = 200;
const MAX_NODE_RENDER_LIMIT = 36;
const MAX_EDGE_RENDER_LIMIT = 64;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function truncateText(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return maxLen <= 1 ? value.slice(0, maxLen) : `${value.slice(0, maxLen - 1)}…`;
}

/**
 * Deterministic slug within catalog's `z.string().min(1).max(48)` bound.
 */
export function toSafeServiceId(rawServiceName: string): string {
  const cleaned = rawServiceName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = cleaned.length > 0 ? cleaned : "unknown-service";
  if (base.length <= 48) {
    return base;
  }
  const suffix = fnv1aHex(rawServiceName).slice(0, 6);
  return `${base.slice(0, 41)}-${suffix}`;
}

export function toSafeServiceName(rawName: string): string {
  const trimmed = rawName.trim() || "Unknown Service";
  return truncateText(trimmed, 64);
}

export function normalizeRegionZone(rawRegion: unknown): RegionDatacenter {
  if (typeof rawRegion !== "string" || !rawRegion.trim()) {
    return "US-East";
  }
  const lower = rawRegion.toLowerCase();
  if (lower.includes("eu") || lower.includes("europe") || lower.includes("london") || lower.includes("frankfurt")) {
    return "EU-West";
  }
  if (lower.includes("ap-") || lower.includes("apac") || lower.includes("asia") || lower.includes("tokyo") || lower.includes("singapore") || lower.includes("sydney")) {
    return "APAC-South";
  }
  return "US-East";
}

function parseAnyValue(val?: OtlpAnyValue): string | number | boolean | undefined {
  if (!val || typeof val !== "object") return undefined;
  if (typeof val.stringValue === "string") {
    return truncateText(val.stringValue, MAX_STRING_LENGTH);
  }
  if (typeof val.boolValue === "boolean") {
    return val.boolValue;
  }
  if (typeof val.intValue === "number" && Number.isFinite(val.intValue)) {
    return val.intValue;
  }
  if (typeof val.intValue === "string" && val.intValue.trim().length > 0) {
    const parsed = Number(val.intValue);
    return Number.isSafeInteger(parsed) ? parsed : truncateText(val.intValue, 64);
  }
  if (typeof val.doubleValue === "number" && Number.isFinite(val.doubleValue)) {
    return round2(val.doubleValue);
  }
  if (val.arrayValue && Array.isArray(val.arrayValue.values)) {
    const items = val.arrayValue.values
      .slice(0, 8)
      .map((item) => parseAnyValue(item))
      .filter((v): v is string | number | boolean => v !== undefined);
    return truncateText(items.join(", "), MAX_STRING_LENGTH);
  }
  return undefined;
}

function extractAttributeMap(
  attrs?: OtlpKeyValue[]
): Record<string, string | number | boolean> {
  const map: Record<string, string | number | boolean> = {};
  if (!Array.isArray(attrs)) return map;
  const limit = Math.min(attrs.length, MAX_ATTRIBUTES_PER_ENTITY);
  for (let i = 0; i < limit; i += 1) {
    const entry = attrs[i];
    if (!entry || typeof entry.key !== "string" || !entry.key) continue;
    const key = entry.key.slice(0, 128);
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    const parsed = parseAnyValue(entry.value);
    if (parsed !== undefined) {
      map[key] = parsed;
    }
  }
  return map;
}

function parseNanoBigInt(raw: string | number | undefined): bigint | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return BigInt(Math.trunc(raw));
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum >= 0) {
      return BigInt(Math.trunc(asNum));
    }
  }
  return null;
}

export function nanoDiffMs(
  startUnixNano: string | number | undefined,
  endUnixNano: string | number | undefined
): number {
  const start = parseNanoBigInt(startUnixNano);
  const end = parseNanoBigInt(endUnixNano);
  if (start === null || end === null || end <= start) return 0;
  const diffNs = end - start;
  // Convert to milliseconds with 0.01 ms resolution using BigInt to avoid IEEE-754 loss
  const centiMs = (diffNs * 100n) / 1_000_000n;
  const maxCenti = BigInt(Number.MAX_SAFE_INTEGER);
  const clamped = centiMs > maxCenti ? maxCenti : centiMs;
  return Number(clamped) / 100;
}

function parseSpanKind(kind: number | string | undefined): OtlpSpanKind {
  if (kind === 1 || kind === "1" || kind === "SPAN_KIND_INTERNAL" || kind === "INTERNAL") {
    return "INTERNAL";
  }
  if (kind === 2 || kind === "2" || kind === "SPAN_KIND_SERVER" || kind === "SERVER") {
    return "SERVER";
  }
  if (kind === 3 || kind === "3" || kind === "SPAN_KIND_CLIENT" || kind === "CLIENT") {
    return "CLIENT";
  }
  if (kind === 4 || kind === "4" || kind === "SPAN_KIND_PRODUCER" || kind === "PRODUCER") {
    return "PRODUCER";
  }
  if (kind === 5 || kind === "5" || kind === "SPAN_KIND_CONSUMER" || kind === "CONSUMER") {
    return "CONSUMER";
  }
  return "UNSPECIFIED";
}

function parseSpanStatus(
  rawStatus: OtlpSpanRaw["status"],
  attributes: Record<string, string | number | boolean>
): { statusCode: SpanStatusCode; statusMessage?: string } {
  const code = rawStatus?.code;
  const msg =
    typeof rawStatus?.message === "string" && rawStatus.message.trim().length > 0
      ? truncateText(rawStatus.message.trim(), 240)
      : undefined;

  const httpStatus =
    typeof attributes["http.response.status_code"] === "number"
      ? attributes["http.response.status_code"]
      : typeof attributes["http.status_code"] === "number"
        ? attributes["http.status_code"]
        : undefined;

  if (
    code === 2 ||
    code === "2" ||
    code === "STATUS_CODE_ERROR" ||
    code === "ERROR" ||
    (httpStatus !== undefined && httpStatus >= 500)
  ) {
    return {
      statusCode: "ERROR",
      statusMessage:
        msg ??
        (typeof attributes["exception.message"] === "string"
          ? truncateText(attributes["exception.message"], 240)
          : httpStatus !== undefined
            ? `HTTP ${httpStatus} Error`
            : "Span failed"),
    };
  }
  if (code === 1 || code === "1" || code === "STATUS_CODE_OK" || code === "OK") {
    return { statusCode: "OK", statusMessage: msg };
  }
  return { statusCode: "UNSET", statusMessage: msg };
}

export function inferServiceTier(
  serviceName: string,
  attributes: Record<string, string | number | boolean> = {},
  kind: OtlpSpanKind = "UNSPECIFIED"
): ServiceTier {
  const lower = serviceName.toLowerCase();
  const dbSystem = String(attributes["db.system"] ?? "").toLowerCase();
  const msgSystem = String(attributes["messaging.system"] ?? "").toLowerCase();

  if (
    dbSystem.includes("redis") ||
    dbSystem.includes("memcached") ||
    dbSystem.includes("valkey") ||
    /\b(redis|cache|memcached|valkey|dragonfly)\b/.test(lower)
  ) {
    return "CACHE";
  }

  if (
    dbSystem.length > 0 ||
    /\b(postgres|postgresql|mysql|mariadb|sqlite|mongodb|mongo|dynamodb|cassandra|cockroach|aurora|clickhouse|snowflake|db)\b/.test(
      lower
    )
  ) {
    return "DATABASE";
  }

  if (
    msgSystem.length > 0 ||
    /\b(kafka|rabbitmq|rabbit|nats|pulsar|sqs|sns|pubsub|broker|eventbus)\b/.test(
      lower
    )
  ) {
    return "BROKER";
  }

  if (/\b(gateway|api-gw|apigw|router|bff|graphql|apollo|proxy)\b/.test(lower)) {
    return "GATEWAY";
  }

  if (/\b(ingress|edge|cdn|nginx|envoy|cloudflare|frontend|web-app)\b/.test(lower)) {
    return "INGRESS";
  }

  if (
    kind === "CONSUMER" ||
    /\b(worker|cron|job|consumer|batch|queue-processor|pipeline)\b/.test(lower)
  ) {
    return "WORKER";
  }

  return "SERVICE";
}

function inferVirtualTarget(
  kind: OtlpSpanKind,
  attributes: Record<string, string | number | boolean>,
  callerServiceId: string,
  callerRegion: RegionDatacenter
): VirtualDependencyHint | undefined {
  const dbSystem =
    typeof attributes["db.system"] === "string"
      ? attributes["db.system"].trim()
      : "";
  const dbName =
    typeof attributes["db.name"] === "string"
      ? attributes["db.name"].trim()
      : "";
  const msgSystem =
    typeof attributes["messaging.system"] === "string"
      ? attributes["messaging.system"].trim()
      : "";
  const msgDest =
    typeof attributes["messaging.destination.name"] === "string"
      ? attributes["messaging.destination.name"].trim()
      : "";
  const peerService =
    typeof attributes["peer.service"] === "string"
      ? attributes["peer.service"].trim()
      : "";
  const genAiSystem =
    typeof attributes["gen_ai.system"] === "string"
      ? attributes["gen_ai.system"].trim()
      : "";
  const rpcService =
    typeof attributes["rpc.service"] === "string"
      ? attributes["rpc.service"].trim()
      : "";
  const serverAddr =
    typeof attributes["server.address"] === "string"
      ? attributes["server.address"].trim()
      : typeof attributes["net.peer.name"] === "string"
        ? attributes["net.peer.name"].trim()
        : "";
  const serverPort =
    typeof attributes["server.port"] === "number"
      ? attributes["server.port"]
      : typeof attributes["net.peer.port"] === "number"
        ? attributes["net.peer.port"]
        : undefined;

  let rawTargetName = "";
  let relation = "downstream";
  let forcedTier: ServiceTier | null = null;

  if (peerService) {
    rawTargetName = peerService;
    relation = "peer.service";
  } else if (dbSystem) {
    rawTargetName = dbName ? `${dbSystem}-${dbName}` : dbSystem;
    relation = `db:${dbSystem}`;
    forcedTier = inferServiceTier(rawTargetName, { "db.system": dbSystem });
  } else if (msgSystem) {
    rawTargetName = msgDest ? `${msgSystem}-${msgDest}` : msgSystem;
    relation = `messaging:${msgSystem}`;
    forcedTier = "BROKER";
  } else if (genAiSystem) {
    rawTargetName = `${genAiSystem}-api`;
    relation = `gen_ai:${genAiSystem}`;
    forcedTier = "SERVICE";
  } else if (kind === "CLIENT" || kind === "PRODUCER") {
    if (rpcService) {
      rawTargetName = rpcService;
      relation = "rpc.service";
    } else if (
      serverAddr &&
      serverAddr !== "localhost" &&
      serverAddr !== "127.0.0.1" &&
      serverAddr !== "::1"
    ) {
      rawTargetName = serverAddr;
      relation = "server.address";
    } else if (serverPort === 5432) {
      rawTargetName = "postgresql";
      forcedTier = "DATABASE";
      relation = "port:5432";
    } else if (serverPort === 6379) {
      rawTargetName = "redis";
      forcedTier = "CACHE";
      relation = "port:6379";
    }
  }

  if (!rawTargetName) return undefined;
  const targetServiceId = toSafeServiceId(rawTargetName);
  if (targetServiceId === callerServiceId) return undefined;

  return {
    targetServiceId,
    targetName: toSafeServiceName(rawTargetName),
    targetTier: forcedTier ?? inferServiceTier(rawTargetName, attributes),
    targetRegion: callerRegion,
    relation,
  };
}

// ============================================================================
// OTLP Payload Parser
// ============================================================================

export function parseOtlpTracePayload(rawPayload: unknown): OtlpNormalizedSpan[] {
  if (!rawPayload || typeof rawPayload !== "object") {
    return [];
  }
  const payload = rawPayload as OtlpExportTraceServiceRequest;
  if (!Array.isArray(payload.resourceSpans)) {
    return [];
  }

  const normalized: OtlpNormalizedSpan[] = [];
  const resLimit = Math.min(payload.resourceSpans.length, MAX_RESOURCE_SPANS_PER_REQUEST);

  for (let rIdx = 0; rIdx < resLimit; rIdx += 1) {
    const resSpan = payload.resourceSpans[rIdx];
    if (!resSpan || typeof resSpan !== "object") continue;

    const resourceAttrs = extractAttributeMap(resSpan.resource?.attributes);
    const rawServiceName =
      typeof resourceAttrs["service.name"] === "string" &&
      resourceAttrs["service.name"].trim().length > 0
        ? resourceAttrs["service.name"].trim()
        : "unknown-service";
    const serviceId = toSafeServiceId(rawServiceName);
    const serviceName = toSafeServiceName(rawServiceName);
    const serviceVersion =
      typeof resourceAttrs["service.version"] === "string" &&
      resourceAttrs["service.version"].trim().length > 0
        ? truncateText(resourceAttrs["service.version"].trim(), 32)
        : "unversioned";
    const region = normalizeRegionZone(
      resourceAttrs["cloud.region"] ??
        resourceAttrs["cloud.availability_zone"] ??
        resourceAttrs["deployment.environment.name"] ??
        resourceAttrs["deployment.environment"]
    );

    const scopes = Array.isArray(resSpan.scopeSpans)
      ? resSpan.scopeSpans
      : Array.isArray(resSpan.instrumentationLibrarySpans)
        ? resSpan.instrumentationLibrarySpans
        : [];

    const scopeLimit = Math.min(scopes.length, MAX_SCOPES_PER_RESOURCE);
    for (let sIdx = 0; sIdx < scopeLimit; sIdx += 1) {
      const scopeEntry = scopes[sIdx];
      if (!scopeEntry || !Array.isArray(scopeEntry.spans)) continue;

      const spanLimit = Math.min(scopeEntry.spans.length, MAX_SPANS_PER_SCOPE);
      for (let i = 0; i < spanLimit; i += 1) {
        const rawSpan = scopeEntry.spans[i];
        if (!rawSpan || typeof rawSpan !== "object") continue;

        const traceId =
          typeof rawSpan.traceId === "string" && rawSpan.traceId.trim().length > 0
            ? truncateText(rawSpan.traceId.trim(), 64)
            : "";
        const spanId =
          typeof rawSpan.spanId === "string" && rawSpan.spanId.trim().length > 0
            ? truncateText(rawSpan.spanId.trim(), 48)
            : "";
        if (!traceId || !spanId) continue;

        const parentSpanId =
          typeof rawSpan.parentSpanId === "string" && rawSpan.parentSpanId.trim().length > 0
            ? truncateText(rawSpan.parentSpanId.trim(), 48)
            : null;

        const spanAttrs = extractAttributeMap(rawSpan.attributes);
        const kind = parseSpanKind(rawSpan.kind);
        const startNanoBig = parseNanoBigInt(rawSpan.startTimeUnixNano) ?? 0n;
        const endNanoBigRaw = parseNanoBigInt(rawSpan.endTimeUnixNano);
        const endNanoBig =
          endNanoBigRaw !== null && endNanoBigRaw >= startNanoBig
            ? endNanoBigRaw
            : startNanoBig;

        const durationMs = nanoDiffMs(startNanoBig.toString(), endNanoBig.toString());
        const { statusCode, statusMessage } = parseSpanStatus(
          rawSpan.status,
          spanAttrs
        );
        const operationName = truncateText(
          typeof rawSpan.name === "string" && rawSpan.name.trim().length > 0
            ? rawSpan.name.trim()
            : "unnamed-span",
          100
        );

        const mergedAttrs: Record<string, string | number | boolean> = {
          ...spanAttrs,
        };
        if (serviceVersion !== "unversioned" && !mergedAttrs["service.version"]) {
          mergedAttrs["service.version"] = serviceVersion;
        }

        const inferredTier = inferServiceTier(serviceName, spanAttrs, kind);
        const virtualTarget = inferVirtualTarget(
          kind,
          spanAttrs,
          serviceId,
          region
        );

        normalized.push({
          traceId,
          spanId,
          parentSpanId,
          serviceName,
          serviceId,
          operationName,
          startTimeMs: 0, // Recomputed relative to trace root inside OtlpTopologyRingStore
          durationMs,
          statusCode,
          statusMessage,
          attributes: mergedAttrs,
          kind,
          startUnixNano: startNanoBig.toString(),
          endUnixNano: endNanoBig.toString(),
          serviceVersion,
          region,
          inferredTier,
          virtualTarget,
        });
      }
    }
  }

  return normalized;
}

function nanoToIsoString(raw: string | number | undefined, fallbackMs: number): string {
  const ns = parseNanoBigInt(raw);
  if (ns !== null && ns > 0n) {
    const ms = Number(ns / 1_000_000n);
    // Sanity bound: between 2015 and 2100
    if (Number.isFinite(ms) && ms > 1_420_070_400_000 && ms < 4_102_444_800_000) {
      return new Date(ms).toISOString();
    }
  }
  return new Date(fallbackMs).toISOString();
}

function normalizeOtlpLogSeverity(
  severityNumber?: number,
  severityText?: string
): StructuredErrorLog["level"] {
  const text = (severityText ?? "").trim().toUpperCase();
  if (typeof severityNumber === "number" && Number.isFinite(severityNumber)) {
    if (severityNumber >= 21) return "FATAL";
    if (severityNumber >= 17) return "ERROR";
    if (severityNumber >= 13) return "WARN";
    if (severityNumber >= 1) return "INFO";
  }
  if (/FATAL|CRITICAL|PANIC|EMERG/.test(text)) return "FATAL";
  if (/ERR/.test(text)) return "ERROR";
  if (/WARN/.test(text)) return "WARN";
  return "INFO";
}

function extractBodyText(body?: OtlpAnyValue, fallback = "OTLP log record"): string {
  const parsed = parseAnyValue(body);
  if (parsed !== undefined) {
    return truncateText(String(parsed), 240);
  }
  if (body?.kvlistValue && Array.isArray(body.kvlistValue.values)) {
    const pairs = extractAttributeMap(body.kvlistValue.values);
    const json = JSON.stringify(pairs);
    if (json && json !== "{}") {
      return truncateText(json, 240);
    }
  }
  return fallback;
}

function extractResourceMeta(attrs?: OtlpKeyValue[]): {
  serviceId: string;
  serviceName: string;
  serviceVersion: string;
  region: RegionDatacenter;
} {
  const resourceAttrs = extractAttributeMap(attrs);
  const rawServiceName =
    typeof resourceAttrs["service.name"] === "string" &&
    resourceAttrs["service.name"].trim().length > 0
      ? resourceAttrs["service.name"].trim()
      : "unknown-service";
  const serviceId = toSafeServiceId(rawServiceName);
  const serviceName = toSafeServiceName(rawServiceName);
  const serviceVersion =
    typeof resourceAttrs["service.version"] === "string" &&
    resourceAttrs["service.version"].trim().length > 0
      ? truncateText(resourceAttrs["service.version"].trim(), 32)
      : "unversioned";
  const region = normalizeRegionZone(
    resourceAttrs["cloud.region"] ??
      resourceAttrs["cloud.availability_zone"] ??
      resourceAttrs["deployment.environment.name"] ??
      resourceAttrs["deployment.environment"]
  );
  return { serviceId, serviceName, serviceVersion, region };
}

export function parseOtlpLogsPayload(
  rawPayload: unknown,
  nowMs = Date.now()
): OtlpNormalizedLog[] {
  if (!rawPayload || typeof rawPayload !== "object") {
    return [];
  }
  const payload = rawPayload as OtlpExportLogsServiceRequest;
  if (!Array.isArray(payload.resourceLogs)) {
    return [];
  }

  const normalized: OtlpNormalizedLog[] = [];
  const resLimit = Math.min(payload.resourceLogs.length, MAX_RESOURCE_SPANS_PER_REQUEST);

  for (let rIdx = 0; rIdx < resLimit; rIdx += 1) {
    const resLog = payload.resourceLogs[rIdx];
    if (!resLog || typeof resLog !== "object") continue;

    const meta = extractResourceMeta(resLog.resource?.attributes);
    const scopes = Array.isArray(resLog.scopeLogs)
      ? resLog.scopeLogs
      : Array.isArray(resLog.instrumentationLibraryLogs)
        ? resLog.instrumentationLibraryLogs
        : [];
    const scopeLimit = Math.min(scopes.length, MAX_SCOPES_PER_RESOURCE);

    for (let sIdx = 0; sIdx < scopeLimit; sIdx += 1) {
      const scopeEntry = scopes[sIdx];
      if (!scopeEntry || !Array.isArray(scopeEntry.logRecords)) continue;

      const recLimit = Math.min(scopeEntry.logRecords.length, MAX_SPANS_PER_SCOPE);
      for (let i = 0; i < recLimit; i += 1) {
        const rawRec = scopeEntry.logRecords[i];
        if (!rawRec || typeof rawRec !== "object") continue;

        const logAttrs = extractAttributeMap(rawRec.attributes);
        const level = normalizeOtlpLogSeverity(rawRec.severityNumber, rawRec.severityText);
        const timestamp = nanoToIsoString(
          rawRec.timeUnixNano ?? rawRec.observedTimeUnixNano,
          nowMs
        );
        const traceId =
          typeof rawRec.traceId === "string" && rawRec.traceId.trim().length > 0
            ? truncateText(rawRec.traceId.trim(), 64)
            : "uncorrelated";
        const spanSuffix =
          typeof rawRec.spanId === "string" && rawRec.spanId.trim().length > 0
            ? ` [span:${truncateText(rawRec.spanId.trim(), 16)}]`
            : "";
        const message = truncateText(
          `${extractBodyText(rawRec.body, rawRec.severityText ?? "OTLP log")}${spanSuffix}`,
          240
        );
        const httpCodeRaw =
          logAttrs["http.response.status_code"] ?? logAttrs["http.status_code"];
        const statusCode =
          typeof httpCodeRaw === "number" && Number.isFinite(httpCodeRaw)
            ? httpCodeRaw
            : level === "FATAL"
              ? 503
              : level === "ERROR"
                ? 500
                : level === "WARN"
                  ? 429
                  : 200;
        const inferredTier = inferServiceTier(meta.serviceName, logAttrs, "SERVER");
        const id = `otlp-logrec-${fnv1aHex(
          `${meta.serviceId}|${traceId}|${timestamp}|${level}|${message}`
        )}`;

        normalized.push({
          id,
          timestamp,
          serviceId: meta.serviceId,
          level,
          statusCode,
          message,
          traceId,
          serviceName: meta.serviceName,
          serviceVersion: meta.serviceVersion,
          region: meta.region,
          inferredTier,
        });
      }
    }
  }

  return normalized;
}

export function parseOtlpMetricsPayload(
  rawPayload: unknown,
  nowMs = Date.now()
): OtlpServiceMetricSample[] {
  if (!rawPayload || typeof rawPayload !== "object") {
    return [];
  }
  const payload = rawPayload as OtlpExportMetricsServiceRequest;
  if (!Array.isArray(payload.resourceMetrics)) {
    return [];
  }

  const samples: OtlpServiceMetricSample[] = [];
  const resLimit = Math.min(
    payload.resourceMetrics.length,
    MAX_RESOURCE_SPANS_PER_REQUEST
  );

  for (let rIdx = 0; rIdx < resLimit; rIdx += 1) {
    const resMetric = payload.resourceMetrics[rIdx];
    if (!resMetric || typeof resMetric !== "object") continue;

    const meta = extractResourceMeta(resMetric.resource?.attributes);
    const scopes = Array.isArray(resMetric.scopeMetrics)
      ? resMetric.scopeMetrics
      : Array.isArray(resMetric.instrumentationLibraryMetrics)
        ? resMetric.instrumentationLibraryMetrics
        : [];
    const scopeLimit = Math.min(scopes.length, MAX_SCOPES_PER_RESOURCE);

    for (let sIdx = 0; sIdx < scopeLimit; sIdx += 1) {
      const scopeEntry = scopes[sIdx];
      if (!scopeEntry || !Array.isArray(scopeEntry.metrics)) continue;

      const metricLimit = Math.min(scopeEntry.metrics.length, MAX_SPANS_PER_SCOPE);
      for (let mIdx = 0; mIdx < metricLimit; mIdx += 1) {
        const rawMetric = scopeEntry.metrics[mIdx];
        if (!rawMetric || typeof rawMetric !== "object" || typeof rawMetric.name !== "string") {
          continue;
        }
        const metricName = truncateText(rawMetric.name.trim(), 128);
        if (!metricName) continue;
        const unit = truncateText(String(rawMetric.unit ?? ""), 24);

        const dataPoints =
          rawMetric.gauge?.dataPoints ?? rawMetric.sum?.dataPoints ?? [];
        if (Array.isArray(dataPoints) && dataPoints.length > 0) {
          const dpLimit = Math.min(dataPoints.length, 64);
          for (let dIdx = 0; dIdx < dpLimit; dIdx += 1) {
            const dp = dataPoints[dIdx];
            if (!dp || typeof dp !== "object") continue;
            const numVal =
              typeof dp.asDouble === "number"
                ? dp.asDouble
                : dp.asInt !== undefined
                  ? Number(dp.asInt)
                  : NaN;
            if (!Number.isFinite(numVal)) continue;

            const dpAttrs = extractAttributeMap(dp.attributes);
            const inferredTier = inferServiceTier(meta.serviceName, dpAttrs, "SERVER");
            const ns = parseNanoBigInt(dp.timeUnixNano);
            const tsMs =
              ns !== null && ns > 0n
                ? Number(ns / 1_000_000n)
                : nowMs;

            samples.push({
              serviceId: meta.serviceId,
              serviceName: meta.serviceName,
              serviceVersion: meta.serviceVersion,
              region: meta.region,
              inferredTier,
              metricName,
              value: numVal,
              unit,
              timestampMs: Number.isFinite(tsMs) && tsMs > 0 ? tsMs : nowMs,
            });
          }
          continue;
        }

        const histPoints = rawMetric.histogram?.dataPoints;
        if (Array.isArray(histPoints) && histPoints.length > 0) {
          const dp = histPoints[histPoints.length - 1];
          const count = dp?.count !== undefined ? Number(dp.count) : 0;
          const sum = typeof dp?.sum === "number" ? dp.sum : NaN;
          if (Number.isFinite(sum) && Number.isFinite(count) && count > 0) {
            samples.push({
              serviceId: meta.serviceId,
              serviceName: meta.serviceName,
              serviceVersion: meta.serviceVersion,
              region: meta.region,
              inferredTier: inferServiceTier(meta.serviceName, {}, "SERVER"),
              metricName,
              value: sum / count,
              unit,
              timestampMs: nowMs,
            });
          }
        }
      }
    }
  }

  return samples;
}

// ============================================================================
// Bounded Ring-Buffer Store & Dynamic Topology Derivation
// ============================================================================

function computePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return round1(sortedValues[0]!);
  const idx = clamp((p / 100) * (sortedValues.length - 1), 0, sortedValues.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  const val = sortedValues[lo]! * (1 - frac) + sortedValues[hi]! * frac;
  return round1(val);
}

const TIER_Y_BAND: Record<ServiceTier, number> = {
  INGRESS: 2.3,
  GATEWAY: 1.4,
  SERVICE: 0.25,
  WORKER: -0.65,
  BROKER: -1.35,
  CACHE: -1.85,
  DATABASE: -2.4,
};

function assignDeterministic3dPositions(
  nodes: Array<{ id: string; tier: ServiceTier }>
): Record<string, [number, number, number]> {
  const byTier = new Map<ServiceTier, string[]>();
  for (const n of nodes) {
    const bucket = byTier.get(n.tier) ?? [];
    bucket.push(n.id);
    byTier.set(n.tier, bucket);
  }

  const positions: Record<string, [number, number, number]> = {};
  for (const [tier, ids] of byTier.entries()) {
    ids.sort();
    const baseY = TIER_Y_BAND[tier];
    const maxCols = 5;
    ids.forEach((id, index) => {
      const row = Math.floor(index / maxCols);
      const col = index % maxCols;
      const countInRow = Math.min(maxCols, ids.length - row * maxCols);
      const spacing = countInRow > 3 ? 2.1 : 2.5;
      const xRaw = (col - (countInRow - 1) / 2) * spacing;
      const zRaw = -1.2 - row * 1.9 - (col % 2 === 0 ? 0 : 0.45);
      const yRaw = baseY + (row % 2 === 0 ? 0 : 0.25);
      positions[id] = [
        round2(clamp(xRaw, -10, 10)),
        round2(clamp(yRaw, -10, 10)),
        round2(clamp(zRaw, -10, 10)),
      ];
    });
  }
  return positions;
}

interface MutableServiceAcc {
  id: string;
  name: string;
  tier: ServiceTier;
  region: RegionDatacenter;
  version: string;
  durations: number[];
  errorCount: number;
  spanCount: number;
  minUnixMs: number;
  maxUnixMs: number;
  dependencies: Set<string>;
  callers: Set<string>;
}

interface MutableEdgeAcc {
  id: string;
  from: string;
  to: string;
  durations: number[];
  errorCount: number;
  callCount: number;
  minUnixMs: number;
  maxUnixMs: number;
}

export class OtlpTopologyRingStore {
  private readonly maxTraces: number;
  private readonly traces = new Map<string, OtlpTraceRecord>();
  private traceOrder: string[] = [];
  private ingestedLogs: OtlpNormalizedLog[] = [];
  private readonly ingestedLogIds = new Set<string>();
  private readonly serviceMetrics = new Map<
    string,
    {
      serviceName: string;
      serviceVersion: string;
      region: RegionDatacenter;
      inferredTier: ServiceTier;
      cpuPercent?: number;
      memoryPercent?: number;
      updatedAtMs: number;
    }
  >();
  private totalIngestedSpans = 0;
  private totalIngestedTraces = 0;
  private totalIngestedLogs = 0;
  private totalIngestedMetrics = 0;
  private lastIngestedAt: string | null = null;

  constructor(options?: { maxTraces?: number }) {
    this.maxTraces = Math.max(10, options?.maxTraces ?? 150);
  }

  public clear(): void {
    this.traces.clear();
    this.traceOrder = [];
    this.ingestedLogs = [];
    this.ingestedLogIds.clear();
    this.serviceMetrics.clear();
    this.totalIngestedSpans = 0;
    this.totalIngestedTraces = 0;
    this.totalIngestedLogs = 0;
    this.totalIngestedMetrics = 0;
    this.lastIngestedAt = null;
  }

  public getStats(): {
    totalIngestedSpans: number;
    totalIngestedTraces: number;
    totalIngestedLogs: number;
    totalIngestedMetrics: number;
    activeTraceCount: number;
    lastIngestedAt: string | null;
  } {
    return {
      totalIngestedSpans: this.totalIngestedSpans,
      totalIngestedTraces: this.totalIngestedTraces,
      totalIngestedLogs: this.totalIngestedLogs,
      totalIngestedMetrics: this.totalIngestedMetrics,
      activeTraceCount: this.traces.size,
      lastIngestedAt: this.lastIngestedAt,
    };
  }

  public ingestOtlpLogsPayload(
    rawPayload: unknown,
    nowMs = Date.now()
  ): OtlpLogsIngestionStats {
    const incoming = parseOtlpLogsPayload(rawPayload, nowMs);
    if (incoming.length === 0) {
      return {
        acceptedLogs: 0,
        rejectedLogs: 0,
        traceIds: [],
        servicesDiscovered: [],
      };
    }

    let accepted = 0;
    let rejected = 0;
    const touchedTraces = new Set<string>();
    const discoveredServices = new Set<string>();

    for (const log of incoming) {
      if (this.ingestedLogIds.has(log.id)) {
        rejected += 1;
        continue;
      }
      this.ingestedLogs.unshift(log);
      this.ingestedLogIds.add(log.id);
      if (this.ingestedLogs.length > MAX_LOGS_IN_RING) {
        const evicted = this.ingestedLogs.pop();
        if (evicted) {
          this.ingestedLogIds.delete(evicted.id);
        }
      }
      accepted += 1;
      this.totalIngestedLogs += 1;
      discoveredServices.add(log.serviceId);
      if (log.traceId !== "uncorrelated") {
        touchedTraces.add(log.traceId);
      }
    }

    if (accepted > 0) {
      this.lastIngestedAt = new Date(nowMs).toISOString();
    }

    return {
      acceptedLogs: accepted,
      rejectedLogs: rejected,
      traceIds: Array.from(touchedTraces),
      servicesDiscovered: Array.from(discoveredServices),
    };
  }

  public ingestOtlpMetricsPayload(
    rawPayload: unknown,
    nowMs = Date.now()
  ): OtlpMetricsIngestionStats {
    const samples = parseOtlpMetricsPayload(rawPayload, nowMs);
    if (samples.length === 0) {
      return {
        acceptedMetrics: 0,
        rejectedMetrics: 0,
        servicesDiscovered: [],
      };
    }

    let accepted = 0;
    const discoveredServices = new Set<string>();

    for (const sample of samples) {
      let existing = this.serviceMetrics.get(sample.serviceId);
      if (!existing) {
        existing = {
          serviceName: sample.serviceName,
          serviceVersion: sample.serviceVersion,
          region: sample.region,
          inferredTier: sample.inferredTier,
          updatedAtMs: sample.timestampMs,
        };
        this.serviceMetrics.set(sample.serviceId, existing);
      } else {
        if (sample.serviceVersion !== "unversioned") {
          existing.serviceVersion = sample.serviceVersion;
        }
        existing.updatedAtMs = Math.max(existing.updatedAtMs, sample.timestampMs);
      }

      const lowerName = sample.metricName.toLowerCase();
      const normalizePercent = (val: number): number => {
        if (
          sample.unit === "1" ||
          (lowerName.includes("utilization") && val >= 0 && val <= 1)
        ) {
          return round1(clamp(val * 100, 0, 100));
        }
        return round1(clamp(val, 0, 100));
      };

      if (
        lowerName.includes("cpu.utilization") ||
        lowerName.includes("cpu.usage") ||
        lowerName.includes("cpu_percent")
      ) {
        existing.cpuPercent = normalizePercent(sample.value);
      } else if (
        lowerName.includes("memory.utilization") ||
        lowerName.includes("memory.usage") ||
        lowerName.includes("memory_percent")
      ) {
        existing.memoryPercent = normalizePercent(sample.value);
      }

      accepted += 1;
      this.totalIngestedMetrics += 1;
      discoveredServices.add(sample.serviceId);
    }

    if (accepted > 0) {
      this.lastIngestedAt = new Date(nowMs).toISOString();
    }

    return {
      acceptedMetrics: accepted,
      rejectedMetrics: 0,
      servicesDiscovered: Array.from(discoveredServices),
    };
  }

  public ingestOtlpPayload(rawPayload: unknown, nowMs = Date.now()): OtlpIngestionStats {
    const incomingSpans = parseOtlpTracePayload(rawPayload);
    return this.ingestNormalizedSpans(incomingSpans, nowMs);
  }

  public ingestNormalizedSpans(
    incomingSpans: OtlpNormalizedSpan[],
    nowMs = Date.now()
  ): OtlpIngestionStats {
    if (incomingSpans.length === 0) {
      return {
        acceptedSpans: 0,
        rejectedSpans: 0,
        traceIds: [],
        servicesDiscovered: [],
      };
    }

    let accepted = 0;
    let rejected = 0;
    const touchedTraces = new Set<string>();
    const discoveredServices = new Set<string>();

    for (const span of incomingSpans) {
      let record = this.traces.get(span.traceId);
      if (!record) {
        if (this.traceOrder.length >= this.maxTraces) {
          const oldestId = this.traceOrder.shift();
          if (oldestId) {
            this.traces.delete(oldestId);
          }
        }
        record = {
          traceId: span.traceId,
          firstSeenAtMs: nowMs,
          updatedAtMs: nowMs,
          minStartUnixNano: span.startUnixNano,
          spans: [],
        };
        this.traces.set(span.traceId, record);
        this.traceOrder.push(span.traceId);
        this.totalIngestedTraces += 1;
      } else {
        // Move to most-recent tail for LRU eviction
        this.traceOrder = this.traceOrder.filter((id) => id !== span.traceId);
        this.traceOrder.push(span.traceId);
      }

      const existingIdx = record.spans.findIndex(
        (s) => s.spanId === span.spanId && s.serviceId === span.serviceId
      );
      if (existingIdx >= 0) {
        record.spans[existingIdx] = span;
      } else if (record.spans.length >= MAX_SPANS_PER_TRACE) {
        rejected += 1;
        continue;
      } else {
        record.spans.push(span);
      }

      accepted += 1;
      this.totalIngestedSpans += 1;
      record.updatedAtMs = nowMs;
      touchedTraces.add(span.traceId);
      discoveredServices.add(span.serviceId);
      if (span.virtualTarget) {
        discoveredServices.add(span.virtualTarget.targetServiceId);
      }
    }

    // Recompute trace-relative start offsets (`startTimeMs`) for touched traces
    for (const traceId of touchedTraces) {
      const record = this.traces.get(traceId);
      if (!record || record.spans.length === 0) continue;

      let minNano: bigint | null = null;
      for (const s of record.spans) {
        const sNano = parseNanoBigInt(s.startUnixNano);
        if (sNano !== null && (minNano === null || sNano < minNano)) {
          minNano = sNano;
        }
      }
      const minStr = minNano !== null ? minNano.toString() : "0";
      record.minStartUnixNano = minStr;

      for (const s of record.spans) {
        s.startTimeMs = nanoDiffMs(minStr, s.startUnixNano);
      }

      record.spans.sort((a, b) => a.startTimeMs - b.startTimeMs);
    }

    if (accepted > 0) {
      this.lastIngestedAt = new Date(nowMs).toISOString();
    }

    return {
      acceptedSpans: accepted,
      rejectedSpans: rejected,
      traceIds: Array.from(touchedTraces),
      servicesDiscovered: Array.from(discoveredServices),
    };
  }

  public getTrace(traceId: string): TelemetryTrace | undefined {
    const record = this.traces.get(traceId);
    if (!record || record.spans.length === 0) return undefined;
    return this.toTelemetryTrace(record);
  }

  public getRecentTraces(limit = 25): TelemetryTrace[] {
    const ids = [...this.traceOrder].reverse().slice(0, limit);
    const out: TelemetryTrace[] = [];
    for (const id of ids) {
      const rec = this.traces.get(id);
      if (rec && rec.spans.length > 0) {
        out.push(this.toTelemetryTrace(rec));
      }
    }
    return out;
  }

  private toTelemetryTrace(record: OtlpTraceRecord): TelemetryTrace {
    const spanIdSet = new Set(record.spans.map((s) => s.spanId));
    const rootSpan =
      record.spans.find((s) => !s.parentSpanId || !spanIdSet.has(s.parentSpanId)) ??
      record.spans[0]!;

    const totalDurationMs = round2(
      record.spans.reduce(
        (max, s) => Math.max(max, s.startTimeMs + s.durationMs),
        0
      )
    );
    const hasError = record.spans.some((s) => s.statusCode === "ERROR");

    const serviceIds = new Set<string>();
    for (const s of record.spans) {
      serviceIds.add(s.serviceId);
    }

    return {
      traceId: record.traceId,
      rootSpan,
      spans: record.spans,
      totalDurationMs,
      hasError,
      serviceIds: Array.from(serviceIds),
    };
  }

  public buildSnapshot(maxRecentTraces = 25): DynamicTopologySnapshot {
    if (
      this.traces.size === 0 &&
      this.ingestedLogs.length === 0 &&
      this.serviceMetrics.size === 0
    ) {
      return {
        mode: "WAITING",
        totalIngestedSpans: this.totalIngestedSpans,
        totalIngestedTraces: this.totalIngestedTraces,
        totalIngestedLogs: this.totalIngestedLogs,
        totalIngestedMetrics: this.totalIngestedMetrics,
        lastIngestedAt: this.lastIngestedAt,
        services: {},
        edges: [],
        summary: {
          activeIncidents: 0,
          severity: "NOMINAL",
          incidentTitle:
            "OTLP Collector Listening on :4318 — Awaiting Real OpenTelemetry Spans, Logs & Metrics",
          elapsedMinutes: 0,
          globalErrorRatePercent: 0,
          globalRps: 0,
          totalNodes: 0,
          unhealthyNodes: 0,
          clusterMttdMinutes: 0,
          errorBudgetRemainingPercent: 100,
        },
        recentTraces: [],
        logs: [],
        bottleneckServiceId: null,
        bottleneckTraceId: null,
        criticalPathServiceIds: [],
      };
    }

    const serviceAccs = new Map<string, MutableServiceAcc>();
    const edgeAccs = new Map<string, MutableEdgeAcc>();
    const logs: StructuredErrorLog[] = [];

    const ensureService = (
      id: string,
      name: string,
      tier: ServiceTier,
      region: RegionDatacenter,
      version: string
    ): MutableServiceAcc => {
      let existing = serviceAccs.get(id);
      if (!existing) {
        existing = {
          id,
          name,
          tier,
          region,
          version,
          durations: [],
          errorCount: 0,
          spanCount: 0,
          minUnixMs: Infinity,
          maxUnixMs: 0,
          dependencies: new Set(),
          callers: new Set(),
        };
        serviceAccs.set(id, existing);
      } else {
        // Real emitted service attributes override tentative virtual guess
        if (version !== "unversioned" && existing.version === "virtual-downstream") {
          existing.version = version;
          existing.name = name;
          existing.tier = tier;
        }
      }
      return existing;
    };

    let globalSpanCount = 0;
    let globalErrorCount = 0;

    // Iterate newest-first for recent logs
    const orderedIds = [...this.traceOrder].reverse();
    for (const traceId of orderedIds) {
      const rec = this.traces.get(traceId);
      if (!rec) continue;

      const spansById = new Map<string, OtlpNormalizedSpan>();
      const parentIdsWithCrossServiceChild = new Set<string>();

      for (const span of rec.spans) {
        spansById.set(span.spanId, span);
      }

      for (const span of rec.spans) {
        if (span.parentSpanId) {
          const parent = spansById.get(span.parentSpanId);
          if (parent && parent.serviceId !== span.serviceId) {
            parentIdsWithCrossServiceChild.add(parent.spanId);
          }
        }
      }

      for (const span of rec.spans) {
        const isErr = span.statusCode === "ERROR";
        const spanTimestampMs = rec.updatedAtMs;
        globalSpanCount += 1;
        if (isErr) globalErrorCount += 1;

        const acc = ensureService(
          span.serviceId,
          span.serviceName,
          span.inferredTier,
          span.region,
          span.serviceVersion
        );
        acc.spanCount += 1;
        acc.durations.push(span.durationMs);
        if (isErr) acc.errorCount += 1;
        acc.minUnixMs = Math.min(acc.minUnixMs, spanTimestampMs);
        acc.maxUnixMs = Math.max(acc.maxUnixMs, spanTimestampMs);

        // Structured error / warning log extraction from real OTel spans
        if (isErr && logs.length < 80) {
          const httpCode =
            typeof span.attributes["http.response.status_code"] === "number"
              ? span.attributes["http.response.status_code"]
              : typeof span.attributes["http.status_code"] === "number"
                ? span.attributes["http.status_code"]
                : 500;
          const dbStatement =
            typeof span.attributes["db.statement"] === "string"
              ? ` | query: ${truncateText(span.attributes["db.statement"], 96)}`
              : "";
          logs.push({
            id: `otlp-log-${traceId.slice(0, 8)}-${span.spanId}`,
            timestamp: new Date(spanTimestampMs).toISOString(),
            serviceId: span.serviceId,
            level: span.durationMs >= 1500 ? "FATAL" : "ERROR",
            statusCode: httpCode,
            message: `${span.operationName}: ${span.statusMessage ?? "Span status ERROR"}${dbStatement}`,
            traceId,
          });
        }

        // Edge 1: Real parentSpanId -> childSpan relationship across services
        if (span.parentSpanId) {
          const parent = spansById.get(span.parentSpanId);
          if (parent && parent.serviceId !== span.serviceId) {
            const parentAcc = ensureService(
              parent.serviceId,
              parent.serviceName,
              parent.inferredTier,
              parent.region,
              parent.serviceVersion
            );
            parentAcc.dependencies.add(span.serviceId);
            acc.callers.add(parent.serviceId);

            const edgeId = `edge-${parent.serviceId}-to-${span.serviceId}`;
            let edge = edgeAccs.get(edgeId);
            if (!edge) {
              edge = {
                id: edgeId,
                from: parent.serviceId,
                to: span.serviceId,
                durations: [],
                errorCount: 0,
                callCount: 0,
                minUnixMs: Infinity,
                maxUnixMs: 0,
              };
              edgeAccs.set(edgeId, edge);
            }
            edge.callCount += 1;
            edge.durations.push(span.durationMs);
            if (isErr) edge.errorCount += 1;
            edge.minUnixMs = Math.min(edge.minUnixMs, spanTimestampMs);
            edge.maxUnixMs = Math.max(edge.maxUnixMs, spanTimestampMs);
          }
        }

        // Edge 2: Unresolved virtual downstream target (DB / Redis / Kafka / OpenAI / peer.service)
        if (span.virtualTarget && !parentIdsWithCrossServiceChild.has(span.spanId)) {
          const vt = span.virtualTarget;
          const vtAcc = ensureService(
            vt.targetServiceId,
            vt.targetName,
            vt.targetTier,
            vt.targetRegion,
            "virtual-downstream"
          );
          vtAcc.spanCount += 1;
          vtAcc.durations.push(span.durationMs);
          if (isErr) vtAcc.errorCount += 1;
          vtAcc.minUnixMs = Math.min(vtAcc.minUnixMs, spanTimestampMs);
          vtAcc.maxUnixMs = Math.max(vtAcc.maxUnixMs, spanTimestampMs);

          acc.dependencies.add(vt.targetServiceId);
          vtAcc.callers.add(span.serviceId);

          const edgeId = `edge-${span.serviceId}-to-${vt.targetServiceId}`;
          let edge = edgeAccs.get(edgeId);
          if (!edge) {
            edge = {
              id: edgeId,
              from: span.serviceId,
              to: vt.targetServiceId,
              durations: [],
              errorCount: 0,
              callCount: 0,
              minUnixMs: Infinity,
              maxUnixMs: 0,
            };
            edgeAccs.set(edgeId, edge);
          }
          edge.callCount += 1;
          edge.durations.push(span.durationMs);
          if (isErr) edge.errorCount += 1;
          edge.minUnixMs = Math.min(edge.minUnixMs, spanTimestampMs);
          edge.maxUnixMs = Math.max(edge.maxUnixMs, spanTimestampMs);
        }
      }
    }

    // Ensure services seen via OTLP Metrics or OTLP Logs are also represented in topology
    for (const [serviceId, m] of this.serviceMetrics.entries()) {
      const acc = ensureService(
        serviceId,
        m.serviceName,
        m.inferredTier,
        m.region,
        m.serviceVersion
      );
      acc.minUnixMs = Math.min(acc.minUnixMs, m.updatedAtMs);
      acc.maxUnixMs = Math.max(acc.maxUnixMs, m.updatedAtMs);
    }

    const logErrorsByService = new Map<string, { errors: number; fatals: number }>();
    for (const log of this.ingestedLogs) {
      ensureService(
        log.serviceId,
        log.serviceName,
        log.inferredTier,
        log.region,
        log.serviceVersion
      );
      if (log.level === "FATAL" || log.level === "ERROR") {
        const counts = logErrorsByService.get(log.serviceId) ?? {
          errors: 0,
          fatals: 0,
        };
        if (log.level === "FATAL") counts.fatals += 1;
        else counts.errors += 1;
        logErrorsByService.set(log.serviceId, counts);
      }
    }

    const rawNodeList = Array.from(serviceAccs.values()).map((s) => ({
      id: s.id,
      tier: s.tier,
    }));
    const positions = assignDeterministic3dPositions(rawNodeList);

    const services: Record<string, ServiceNodeData> = {};
    let healthyNodes = 0;
    let degradedNodes = 0;
    let criticalNodes = 0;
    let globalRps = 0;
    let worstServiceId: string | null = null;
    let worstScore = -1;

    for (const acc of serviceAccs.values()) {
      const sorted = [...acc.durations].sort((a, b) => a - b);
      const p50 = computePercentile(sorted, 50);
      const p95 = computePercentile(sorted, 95);
      const p99 = computePercentile(sorted, 99);
      const logCounts = logErrorsByService.get(acc.id);
      const errorRatePercent =
        acc.spanCount > 0 ? round1((acc.errorCount / acc.spanCount) * 100) : 0;

      const windowSec = Math.max(
        1,
        (acc.maxUnixMs - acc.minUnixMs) / 1000
      );
      const rps = acc.spanCount > 0 ? Math.max(1, Math.round(acc.spanCount / windowSec)) : 0;
      globalRps += rps;

      const realMetric = this.serviceMetrics.get(acc.id);
      const cpuSaturationPercent =
        typeof realMetric?.cpuPercent === "number"
          ? Math.round(clamp(realMetric.cpuPercent, 1, 99))
          : acc.spanCount > 0
            ? Math.round(clamp(18 + errorRatePercent * 0.65 + p95 / 40, 5, 99))
            : 12;
      const memorySaturationPercent =
        typeof realMetric?.memoryPercent === "number"
          ? Math.round(clamp(realMetric.memoryPercent, 1, 99))
          : acc.spanCount > 0
            ? Math.round(clamp(28 + errorRatePercent * 0.35 + p99 / 75, 10, 98))
            : 22;

      let status: ServiceHealthStatus = "NOMINAL";
      if (
        errorRatePercent >= 15 ||
        p95 >= 1500 ||
        (logCounts?.fatals ?? 0) > 0 ||
        cpuSaturationPercent >= 95
      ) {
        status = "CRITICAL_OUTAGE";
        criticalNodes += 1;
      } else if (
        errorRatePercent >= 2 ||
        p95 >= 400 ||
        (logCounts?.errors ?? 0) > 0 ||
        cpuSaturationPercent >= 85
      ) {
        status = "DEGRADED";
        degradedNodes += 1;
      } else {
        healthyNodes += 1;
      }

      const healthScore =
        errorRatePercent * 10 +
        p95 / 20 +
        (logCounts ? logCounts.fatals * 20 + logCounts.errors * 5 : 0) +
        (cpuSaturationPercent >= 85 ? cpuSaturationPercent * 0.2 : 0);
      if (healthScore > worstScore) {
        worstScore = healthScore;
        worstServiceId = acc.id;
      }

      services[acc.id] = {
        id: acc.id,
        name: acc.name,
        tier: acc.tier,
        region: acc.region,
        position: positions[acc.id] ?? [0, 0, -1],
        status,
        rps,
        errorRatePercent,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        p99LatencyMs: p99,
        cpuSaturationPercent,
        memorySaturationPercent,
        replicas: acc.tier === "DATABASE" ? 1 : 2,
        maxReplicas: acc.tier === "DATABASE" ? 2 : 10,
        version: acc.version,
        circuitBreakerTripped: false,
        dependencies: Array.from(acc.dependencies).sort(),
        callers: Array.from(acc.callers).sort(),
      };
    }

    // Merge real OTLP Logs (/v1/logs) ahead of synthetic span error extractions
    const mergedLogs: StructuredErrorLog[] = [];
    for (const extLog of this.ingestedLogs) {
      if (mergedLogs.length >= 80) break;
      mergedLogs.push({
        id: extLog.id,
        timestamp: extLog.timestamp,
        serviceId: extLog.serviceId,
        level: extLog.level,
        statusCode: extLog.statusCode,
        message: extLog.message,
        traceId: extLog.traceId,
      });
    }
    for (const spanLog of logs) {
      if (mergedLogs.length >= 80) break;
      mergedLogs.push(spanLog);
    }

    const edges: TrafficEdgeData[] = [];
    for (const acc of edgeAccs.values()) {
      const avgLatencyMs =
        acc.durations.length > 0
          ? round1(
              acc.durations.reduce((sum, d) => sum + d, 0) / acc.durations.length
            )
          : 0;
      const sorted = [...acc.durations].sort((a, b) => a - b);
      const edgeP95 = computePercentile(sorted, 95);
      const errorRatePercent =
        acc.callCount > 0 ? round1((acc.errorCount / acc.callCount) * 100) : 0;
      const windowSec = Math.max(1, (acc.maxUnixMs - acc.minUnixMs) / 1000);
      const rps = Math.max(1, Math.round(acc.callCount / windowSec));

      const targetStatus = services[acc.to]?.status;
      let status: TrafficEdgeData["status"] = "NOMINAL";
      if (errorRatePercent >= 50 || targetStatus === "CRITICAL_OUTAGE") {
        status = "SEVERED";
      } else if (
        errorRatePercent >= 5 ||
        edgeP95 >= 400 ||
        targetStatus === "DEGRADED"
      ) {
        status = "CONGESTED";
      }

      edges.push({
        id: truncateText(acc.id, 48),
        from: acc.from,
        to: acc.to,
        status,
        rps,
        latencyMs: avgLatencyMs,
        errorRatePercent,
      });
    }

    const totalNodes = Object.keys(services).length;
    const globalErrorRatePercent =
      globalSpanCount > 0
        ? round1((globalErrorCount / globalSpanCount) * 100)
        : 0;
    const errorBudgetRemainingPercent = round1(
      clamp(100 - globalErrorRatePercent * 1.4, 0, 100)
    );

    let severity: ClusterSummary["severity"] = "NOMINAL";
    if (criticalNodes >= 2 || globalErrorRatePercent >= 25) {
      severity = "SEV-0";
    } else if (criticalNodes >= 1 || globalErrorRatePercent >= 10) {
      severity = "SEV-1";
    } else if (degradedNodes >= 1 || globalErrorRatePercent >= 2) {
      severity = "SEV-2";
    }

    const bottleneckService = worstServiceId ? services[worstServiceId] : undefined;
    const unhealthyNodes = degradedNodes + criticalNodes;
    const incidentTitle =
      severity === "NOMINAL"
        ? `Live OTLP Mesh Nominal — ${totalNodes} services · ${this.totalIngestedTraces} traces`
        : `${severity}: ${bottleneckService?.name ?? "Service Mesh"} Anomaly (${bottleneckService?.errorRatePercent ?? globalErrorRatePercent}% errors, p95 ${bottleneckService?.p95LatencyMs ?? 0}ms)`;

    const recentTraces = this.getRecentTraces(maxRecentTraces);
    const focusTrace =
      recentTraces.find((t) => t.hasError) ?? recentTraces[0] ?? null;
    const criticalPathServices: string[] = [];
    if (focusTrace && focusTrace.spans.length > 0) {
      const seenPath = new Set<string>();
      const rawTraceSpans = this.traces.get(focusTrace.traceId)?.spans ?? [];
      const rawById = new Map(rawTraceSpans.map((s) => [s.spanId, s]));
      const childrenByParent = new Map<string, OtelSpan[]>();
      for (const s of focusTrace.spans) {
        if (s.parentSpanId) {
          const list = childrenByParent.get(s.parentSpanId) ?? [];
          list.push(s);
          childrenByParent.set(s.parentSpanId, list);
        }
      }

      const chain: string[] = [];
      const visitedSpans = new Set<string>();
      let cursor: OtelSpan | undefined = focusTrace.rootSpan;
      let guard = 0;

      while (cursor && guard < 32 && !visitedSpans.has(cursor.spanId)) {
        visitedSpans.add(cursor.spanId);
        guard += 1;
        chain.push(cursor.serviceId);

        const recSpan = rawById.get(cursor.spanId);
        const children: OtelSpan[] = childrenByParent.get(cursor.spanId) ?? [];
        if (children.length === 0) {
          if (recSpan?.virtualTarget) {
            chain.push(recSpan.virtualTarget.targetServiceId);
          }
          break;
        }

        // Follow the failing or slowest child down the critical bottleneck branch
        const sortedChildren: OtelSpan[] = [...children].sort((a, b) => {
          const aErr = a.statusCode === "ERROR" ? 1 : 0;
          const bErr = b.statusCode === "ERROR" ? 1 : 0;
          if (aErr !== bErr) return bErr - aErr;
          return b.durationMs - a.durationMs;
        });
        cursor = sortedChildren[0];
      }

      // Include any erroring services not reached in disconnected trace fragments
      for (const s of focusTrace.spans) {
        if (s.statusCode === "ERROR") {
          chain.push(s.serviceId);
          const recSpan = rawById.get(s.spanId);
          if (recSpan?.virtualTarget) {
            chain.push(recSpan.virtualTarget.targetServiceId);
          }
        }
      }

      for (const sid of chain) {
        if (!seenPath.has(sid)) {
          seenPath.add(sid);
          criticalPathServices.push(sid);
        }
      }
    }

    return {
      mode: "LIVE",
      totalIngestedSpans: this.totalIngestedSpans,
      totalIngestedTraces: this.totalIngestedTraces,
      totalIngestedLogs: this.totalIngestedLogs,
      totalIngestedMetrics: this.totalIngestedMetrics,
      lastIngestedAt: this.lastIngestedAt,
      services,
      edges,
      summary: {
        activeIncidents: unhealthyNodes > 0 ? 1 : 0,
        severity,
        incidentTitle: truncateText(incidentTitle, 140),
        elapsedMinutes: Math.max(0, Math.round((Date.now() - (this.lastIngestedAt ? Date.parse(this.lastIngestedAt) : Date.now())) / 60000)),
        globalErrorRatePercent,
        globalRps,
        totalNodes,
        unhealthyNodes,
        clusterMttdMinutes: 0.2,
        errorBudgetRemainingPercent,
      },
      recentTraces,
      logs: mergedLogs,
      bottleneckServiceId: severity === "NOMINAL" ? null : worstServiceId,
      bottleneckTraceId: focusTrace?.traceId ?? null,
      criticalPathServiceIds: criticalPathServices,
    };
  }

  public toSerializable(): SerializableOtlpStoreState {
    return {
      version: 1,
      totalIngestedSpans: this.totalIngestedSpans,
      totalIngestedTraces: this.totalIngestedTraces,
      totalIngestedLogs: this.totalIngestedLogs,
      totalIngestedMetrics: this.totalIngestedMetrics,
      lastIngestedAt: this.lastIngestedAt,
      traces: this.traceOrder
        .map((id) => this.traces.get(id))
        .filter((rec): rec is OtlpTraceRecord => Boolean(rec)),
      logs: [...this.ingestedLogs],
    };
  }

  public hydrate(serialized: SerializableOtlpStoreState): void {
    this.clear();
    if (!serialized || serialized.version !== 1 || !Array.isArray(serialized.traces)) {
      return;
    }
    const capped = serialized.traces.slice(-this.maxTraces);
    for (const rec of capped) {
      if (rec && typeof rec.traceId === "string" && Array.isArray(rec.spans)) {
        this.traces.set(rec.traceId, rec);
        this.traceOrder.push(rec.traceId);
      }
    }
    if (Array.isArray(serialized.logs)) {
      for (const log of serialized.logs.slice(0, MAX_LOGS_IN_RING)) {
        if (log && typeof log.id === "string" && !this.ingestedLogIds.has(log.id)) {
          this.ingestedLogs.push(log);
          this.ingestedLogIds.add(log.id);
        }
      }
    }
    this.totalIngestedSpans =
      typeof serialized.totalIngestedSpans === "number"
        ? serialized.totalIngestedSpans
        : capped.reduce((acc, r) => acc + r.spans.length, 0);
    this.totalIngestedTraces =
      typeof serialized.totalIngestedTraces === "number"
        ? serialized.totalIngestedTraces
        : capped.length;
    this.totalIngestedLogs =
      typeof serialized.totalIngestedLogs === "number"
        ? serialized.totalIngestedLogs
        : this.ingestedLogs.length;
    this.totalIngestedMetrics =
      typeof serialized.totalIngestedMetrics === "number"
        ? serialized.totalIngestedMetrics
        : 0;
    this.lastIngestedAt = serialized.lastIngestedAt ?? null;
  }
}

// ============================================================================
// Dynamic @json-render Spec Builder from Live OTLP Snapshot
// ============================================================================

export function createEmptyOtlpClusterState(): SpatialClusterState {
  return {
    cluster: {
      selectedServiceId: "",
      services: {},
      edges: [],
      logs: [],
      auditLog: [],
      filters: {
        tierFilter: "ALL",
        regionFilter: "ALL",
        searchQuery: "",
      },
      summary: {
        activeIncidents: 0,
        severity: "NOMINAL",
        incidentTitle:
          "OTLP Collector Listening on :4318 — Awaiting Real OpenTelemetry Spans",
        elapsedMinutes: 0,
        globalErrorRatePercent: 0,
        globalRps: 0,
        totalNodes: 0,
        unhealthyNodes: 0,
        clusterMttdMinutes: 0,
        errorBudgetRemainingPercent: 100,
      },
    },
  };
}

export interface OtlpSpecFilterOptions {
  tierFilter?: string;
  statusFilter?: string;
  searchQuery?: string;
  criticalPathOnly?: boolean;
}

export function buildDynamicOtlpSpec(
  snapshot: DynamicTopologySnapshot,
  selectedTraceId?: string,
  filters?: OtlpSpecFilterOptions
): Spec {
  const tierFilter = (filters?.tierFilter ?? "ALL").toUpperCase();
  const statusFilter = (filters?.statusFilter ?? "ALL").toUpperCase();
  const query = (filters?.searchQuery ?? "").trim().toLowerCase();
  const criticalPathSet = new Set(snapshot.criticalPathServiceIds ?? []);
  const criticalOnly =
    Boolean(filters?.criticalPathOnly) && criticalPathSet.size > 0;

  const servicesList = Object.values(snapshot.services)
    .filter((srv) => {
      if (tierFilter !== "ALL" && srv.tier !== tierFilter) {
        return false;
      }
      if (statusFilter === "UNHEALTHY") {
        if (srv.status === "NOMINAL") return false;
      } else if (statusFilter !== "ALL" && srv.status !== statusFilter) {
        return false;
      }
      if (criticalOnly && !criticalPathSet.has(srv.id)) {
        return false;
      }
      if (query.length > 0) {
        const haystack = `${srv.id} ${srv.name} ${srv.tier} ${srv.region}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .slice(0, MAX_NODE_RENDER_LIMIT);
  const serviceIdSet = new Set(servicesList.map((s) => s.id));
  const edgesList = snapshot.edges
    .filter((e) => serviceIdSet.has(e.from) && serviceIdSet.has(e.to))
    .slice(0, MAX_EDGE_RENDER_LIMIT);

  const elements: Spec["elements"] = {};
  const spatialChildren: string[] = [];
  const hudChildren: string[] = [];

  for (const srv of servicesList) {
    const elemId = `otlp-node-${srv.id}`;
    spatialChildren.push(elemId);
    const scaleRaw =
      srv.status === "CRITICAL_OUTAGE"
        ? 1.3
        : srv.status === "DEGRADED"
          ? 1.15
          : srv.tier === "INGRESS" || srv.tier === "DATABASE"
            ? 1.1
            : 0.95;

    elements[elemId] = {
      type: "ServiceMeshNode3D",
      props: {
        serviceId: truncateText(srv.id, 48),
        name: truncateText(srv.name, 64),
        tier: srv.tier,
        position: [
          clamp(srv.position[0], -12, 12),
          clamp(srv.position[1], -12, 12),
          clamp(srv.position[2], -12, 12),
        ],
        status: srv.status,
        scale: clamp(scaleRaw, 0.2, 4.0),
      },
      children: [],
    };
  }

  for (const edge of edgesList) {
    const elemId = `otlp-edge-${edge.id}`;
    spatialChildren.push(elemId);
    const speed =
      edge.status === "SEVERED"
        ? 0.35
        : edge.status === "CONGESTED"
          ? 2.6
          : 1.4;
    elements[elemId] = {
      type: "TrafficFlowEdge3D",
      props: {
        edgeId: truncateText(edge.id, 48),
        fromServiceId: truncateText(edge.from, 48),
        toServiceId: truncateText(edge.to, 48),
        status: edge.status,
        particleSpeed: clamp(speed, 0.2, 4.0),
      },
      children: [],
    };
  }

  if (snapshot.bottleneckServiceId && serviceIdSet.has(snapshot.bottleneckServiceId)) {
    spatialChildren.push("otlp-blast-sphere");
    elements["otlp-blast-sphere"] = {
      type: "BlastRadiusSphere3D",
      props: {
        targetServiceId: truncateText(snapshot.bottleneckServiceId, 48),
        radius: snapshot.summary.severity === "SEV-0" || snapshot.summary.severity === "SEV-1" ? 3.4 : 2.2,
        severity:
          snapshot.summary.severity === "SEV-0" || snapshot.summary.severity === "SEV-1"
            ? "CRITICAL"
            : snapshot.summary.severity === "SEV-2"
              ? "HIGH"
              : "MEDIUM",
        pulseRate: snapshot.summary.severity === "NOMINAL" ? 0.8 : 1.9,
      },
      children: [],
    };
  }

  const primaryRegion: RegionDatacenter =
    servicesList[0]?.region ?? "US-East";
  spatialChildren.push("otlp-region-boundary");
  elements["otlp-region-boundary"] = {
    type: "RegionZoneBoundary3D",
    props: {
      regionName: primaryRegion,
      center: [0, 0, -1.8],
      size: [10, 6.5, 8],
      wireframeColor:
        snapshot.summary.severity === "SEV-0" || snapshot.summary.severity === "SEV-1"
          ? "#EF4444"
          : snapshot.summary.severity === "SEV-2"
            ? "#F59E0B"
            : "#38BDF8",
    },
    children: [],
  };

  // HUD composition
  const focusServiceId =
    snapshot.bottleneckServiceId ??
    servicesList[0]?.id ??
    "awaiting-otlp-spans";

  const bannerSummary =
    snapshot.mode === "WAITING"
      ? "Point any Node.js, Next.js, Go, or Python service to OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 to construct live 3D service topology from real spans."
      : `Discovered ${servicesList.length} live services and ${edgesList.length} call edges across ${snapshot.totalIngestedTraces} traces (${snapshot.totalIngestedSpans} spans ingested).`;

  elements["otlp-banner-incident"] = {
    type: "IncidentHeroBanner",
    props: {
      severity: snapshot.summary.severity,
      title: truncateText(snapshot.summary.incidentTitle, 140),
      summary: truncateText(bannerSummary, 280),
      mttdMinutes: 0.2,
    },
    children: [],
  };
  hudChildren.push("otlp-banner-incident");

  elements["otlp-grid-metrics"] = {
    type: "ClusterMetricsGrid",
    props: {
      heading:
        snapshot.mode === "LIVE"
          ? "Live OTLP Mesh Telemetry"
          : "Local OTLP Receiver Telemetry",
      columns: "3",
    },
    children: [],
  };
  hudChildren.push("otlp-grid-metrics");

  const activeTrace =
    (selectedTraceId
      ? snapshot.recentTraces.find((t) => t.traceId === selectedTraceId)
      : undefined) ??
    snapshot.recentTraces.find((t) => t.hasError) ??
    snapshot.recentTraces[0];

  if (activeTrace && activeTrace.spans.length > 0) {
    elements["otlp-trace-waterfall"] = {
      type: "TraceWaterfallViewer",
      props: {
        title: truncateText(
          activeTrace.hasError
            ? `OTLP Anomalous Trace: ${activeTrace.rootSpan.operationName}`
            : `OTLP Distributed Trace: ${activeTrace.rootSpan.operationName}`,
          100
        ),
        traceId: truncateText(activeTrace.traceId, 64),
        rootSpanName: truncateText(activeTrace.rootSpan.operationName, 100),
        totalDurationMs: Math.max(0, round2(activeTrace.totalDurationMs)),
        highlightServiceId: truncateText(
          snapshot.bottleneckServiceId ?? activeTrace.rootSpan.serviceId,
          48
        ),
        spans: activeTrace.spans.slice(0, 48).map((sp) => ({
          spanId: truncateText(sp.spanId, 48),
          parentSpanId: sp.parentSpanId ? truncateText(sp.parentSpanId, 48) : null,
          serviceName: truncateText(sp.serviceName, 64),
          serviceId: truncateText(sp.serviceId, 48),
          operation: truncateText(sp.operationName, 100),
          startOffsetMs: Math.max(0, round2(sp.startTimeMs)),
          durationMs: Math.max(0, round2(sp.durationMs)),
          status: sp.statusCode === "ERROR" ? ("ERROR" as const) : ("OK" as const),
          statusMessage: sp.statusMessage ? truncateText(sp.statusMessage, 200) : undefined,
          attributes: sp.attributes,
        })),
      },
      children: [],
    };
    hudChildren.push("otlp-trace-waterfall");
  }

  elements["otlp-panel-diagnostic"] = {
    type: "ServiceDiagnosticPanel",
    props: {
      defaultServiceId: truncateText(focusServiceId, 48),
      showDependencies: true,
    },
    children: [],
  };
  hudChildren.push("otlp-panel-diagnostic");

  elements["otlp-card-latency"] = {
    type: "LatencyHistogramCard",
    props: {
      serviceId: truncateText(focusServiceId, 48),
      timeWindow: "15m",
    },
    children: [],
  };
  hudChildren.push("otlp-card-latency");

  elements["otlp-tree-blast"] = {
    type: "BlastRadiusDependencyTree",
    props: {
      rootServiceId: truncateText(focusServiceId, 48),
      depthLimit: 3,
    },
    children: [],
  };
  hudChildren.push("otlp-tree-blast");

  elements["otlp-tailer-logs"] = {
    type: "ErrorLogTailer",
    props: {
      title: "OTLP Span Error & Exception Stream",
      maxEntries: 6,
      filterLevel: "ALL",
    },
    children: [],
  };
  hudChildren.push("otlp-tailer-logs");

  elements["otlp-runbook-desk"] = {
    type: "RunbookActionDesk",
    props: {
      heading: "SRE Time-Travel Simulation & Remediation",
      allowDirectExecution: true,
    },
    children: [],
  };
  hudChildren.push("otlp-runbook-desk");

  elements["otlp-audit-trail"] = {
    type: "SreAuditTrailBanner",
    props: {
      title: "Time-Travel State & Action Audit Log",
      maxEntries: 4,
    },
    children: [],
  };
  hudChildren.push("otlp-audit-trail");

  elements["otlp-canvas-viewport"] = {
    type: "ClusterTopologyCanvas",
    props: {
      cameraFov: 48,
      enableOrbitControls: true,
      enableGrid: true,
      enableBloom: snapshot.summary.severity !== "NOMINAL",
      ambientIntensity: 0.85,
    },
    children: spatialChildren,
  };

  elements["warroom-shell-otlp"] = {
    type: "AegisWarRoomShell",
    props: {
      incidentTitle: truncateText(snapshot.summary.incidentTitle, 140),
      severity: snapshot.summary.severity,
      activeRegion: snapshot.mode === "LIVE" ? primaryRegion : "GLOBAL",
      hudPosition: "RIGHT_SPLIT",
    },
    slots: {
      spatial: ["otlp-canvas-viewport"],
      hud: hudChildren,
    },
    children: [],
  };

  return {
    root: "warroom-shell-otlp",
    elements,
  };
}

// ============================================================================
// Standard OTLP Test Trace Payload Factory (for verification & quickstart)
// ============================================================================

function randomHex(bytes: number): string {
  let out = "";
  for (let i = 0; i < bytes * 2; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export function createSampleOtlpRequest(options?: {
  faulty?: boolean;
  traceId?: string;
  nowMs?: number;
}): OtlpExportTraceServiceRequest {
  const faulty = options?.faulty ?? false;
  const traceId = options?.traceId ?? randomHex(16);
  const rootId = randomHex(8);
  const apiId = randomHex(8);
  const authId = randomHex(8);
  const checkoutId = randomHex(8);
  const dbSpanId = randomHex(8);
  const cacheSpanId = randomHex(8);

  const baseNs = BigInt(Math.trunc(options?.nowMs ?? Date.now())) * 1_000_000n;
  const ms = (offset: number): string =>
    (baseNs + BigInt(Math.round(offset * 1_000_000))).toString();

  const totalEnd = faulty ? 1860 : 48;

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "edge-ingress" } },
            { key: "service.version", value: { stringValue: "1.12.0" } },
            { key: "cloud.region", value: { stringValue: "us-east-1" } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "@opentelemetry/instrumentation-http", version: "0.52.0" },
            spans: [
              {
                traceId,
                spanId: rootId,
                name: "POST /api/v2/checkout",
                kind: 2,
                startTimeUnixNano: ms(0),
                endTimeUnixNano: ms(totalEnd),
                status: faulty
                  ? { code: 2, message: "HTTP 504 Upstream Timeout" }
                  : { code: 1 },
                attributes: [
                  { key: "http.request.method", value: { stringValue: "POST" } },
                  { key: "http.route", value: { stringValue: "/api/v2/checkout" } },
                  { key: "http.response.status_code", value: { intValue: faulty ? 504 : 200 } },
                ],
              },
            ],
          },
        ],
      },
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "api-gateway" } },
            { key: "service.version", value: { stringValue: "3.4.1" } },
            { key: "cloud.region", value: { stringValue: "us-east-1" } },
          ],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId,
                spanId: apiId,
                parentSpanId: rootId,
                name: "gateway.dispatch_checkout",
                kind: 2,
                startTimeUnixNano: ms(2),
                endTimeUnixNano: ms(totalEnd - 2),
                status: faulty
                  ? { code: 2, message: "Upstream deadline exceeded" }
                  : { code: 1 },
                attributes: [
                  { key: "rpc.system", value: { stringValue: "grpc" } },
                ],
              },
              {
                traceId,
                spanId: cacheSpanId,
                parentSpanId: apiId,
                name: "GET session:user_9821",
                kind: 3,
                startTimeUnixNano: ms(4),
                endTimeUnixNano: ms(9),
                status: { code: 1 },
                attributes: [
                  { key: "db.system", value: { stringValue: "redis" } },
                  { key: "db.statement", value: { stringValue: "GET session:user_9821" } },
                ],
              },
            ],
          },
        ],
      },
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "auth-service" } },
            { key: "service.version", value: { stringValue: "2.1.0" } },
            { key: "cloud.region", value: { stringValue: "us-east-1" } },
          ],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId,
                spanId: authId,
                parentSpanId: apiId,
                name: "verify_jwt_session",
                kind: 2,
                startTimeUnixNano: ms(5),
                endTimeUnixNano: ms(14),
                status: { code: 1 },
                attributes: [
                  { key: "auth.provider", value: { stringValue: "oidc" } },
                ],
              },
            ],
          },
        ],
      },
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "checkout-service" } },
            { key: "service.version", value: { stringValue: "4.0.2" } },
            { key: "cloud.region", value: { stringValue: "us-east-1" } },
          ],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId,
                spanId: checkoutId,
                parentSpanId: apiId,
                name: "checkout.commit_ledger",
                kind: 2,
                startTimeUnixNano: ms(15),
                endTimeUnixNano: ms(totalEnd - 4),
                status: faulty
                  ? { code: 2, message: "PostgreSQL pool connection acquire timeout (1820ms)" }
                  : { code: 1 },
                attributes: [
                  { key: "order.currency", value: { stringValue: "USD" } },
                ],
              },
              {
                traceId,
                spanId: dbSpanId,
                parentSpanId: checkoutId,
                name: "UPDATE customer_ledgers",
                kind: 3,
                startTimeUnixNano: ms(18),
                endTimeUnixNano: ms(totalEnd - 6),
                status: faulty
                  ? { code: 2, message: "FATAL: remaining connection slots reserved (max_connections=100)" }
                  : { code: 1 },
                attributes: [
                  { key: "db.system", value: { stringValue: "postgresql" } },
                  { key: "db.name", value: { stringValue: "orders_prod" } },
                  {
                    key: "db.statement",
                    value: {
                      stringValue: "UPDATE customer_ledgers SET balance = balance - $1 WHERE account_id = $2",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
