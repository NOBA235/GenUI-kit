import type { TimeTravelStateStore } from "@genui-studio/core";
import {
  createEmptyOtlpClusterState,
  createSampleOtlpRequest,
  type DynamicTopologySnapshot,
} from "./otlp-topology.js";

export const DEFAULT_OTLP_COLLECTOR_URL = "http://localhost:4318";

export type OtlpConnectionStatus =
  | "CONNECTING"
  | "LISTENING"
  | "STREAMING"
  | "OFFLINE";

export interface OtlpClientCallbacks {
  onSnapshot: (snapshot: DynamicTopologySnapshot) => void;
  onStatusChange?: (status: OtlpConnectionStatus, detail?: string) => void;
}

/**
 * Applies a derived live OTLP topology snapshot onto the SpatialOps TimeTravelStateStore.
 * Preserves existing SRE audit logs and current service selection when still present.
 */
export function applyOtlpSnapshotToStore(
  store: TimeTravelStateStore,
  snapshot: DynamicTopologySnapshot
): void {
  if (snapshot.mode === "WAITING" && snapshot.totalIngestedTraces === 0) {
    const emptyState = createEmptyOtlpClusterState();
    const existingAudit = store.get("/cluster/auditLog");
    store.update({
      "/cluster/services": emptyState.cluster.services,
      "/cluster/edges": emptyState.cluster.edges,
      "/cluster/summary": snapshot.summary,
      "/cluster/logs": emptyState.cluster.logs,
      "/cluster/selectedServiceId": "",
      "/cluster/auditLog": Array.isArray(existingAudit) ? existingAudit : [],
    });
    return;
  }

  const currentSelected = store.get("/cluster/selectedServiceId");
  const serviceIds = Object.keys(snapshot.services);
  const nextSelected =
    typeof currentSelected === "string" && snapshot.services[currentSelected]
      ? currentSelected
      : snapshot.bottleneckServiceId && snapshot.services[snapshot.bottleneckServiceId]
        ? snapshot.bottleneckServiceId
        : (serviceIds[0] ?? "");

  store.update({
    "/cluster/services": snapshot.services,
    "/cluster/edges": snapshot.edges,
    "/cluster/summary": snapshot.summary,
    "/cluster/logs": snapshot.logs.slice(0, 60),
    "/cluster/selectedServiceId": nextSelected,
  });
}

export class LiveOtlpCollectorClient {
  private readonly baseUrl: string;
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private callbacks: OtlpClientCallbacks;

  constructor(callbacks: OtlpClientCallbacks, baseUrl = DEFAULT_OTLP_COLLECTOR_URL) {
    this.callbacks = callbacks;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public getEndpointUrl(): string {
    return `${this.baseUrl}/v1/traces`;
  }

  public async connect(): Promise<void> {
    this.closed = false;
    this.callbacks.onStatusChange?.("CONNECTING");

    try {
      const resp = await fetch(`${this.baseUrl}/api/snapshot`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const snapshot = (await resp.json()) as DynamicTopologySnapshot;
      this.callbacks.onSnapshot(snapshot);
      this.callbacks.onStatusChange?.(
        snapshot.totalIngestedTraces > 0 ? "STREAMING" : "LISTENING"
      );
      this.openEventStream();
    } catch (err) {
      this.callbacks.onStatusChange?.(
        "OFFLINE",
        err instanceof Error ? err.message : "Collector unreachable"
      );
      this.scheduleReconnect();
    }
  }

  private openEventStream(): void {
    if (this.closed || typeof EventSource === "undefined") return;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const es = new EventSource(`${this.baseUrl}/api/events`);
    this.eventSource = es;

    es.addEventListener("snapshot", (evt) => {
      if (this.closed) return;
      try {
        const snapshot = JSON.parse((evt as MessageEvent<string>).data) as DynamicTopologySnapshot;
        this.callbacks.onSnapshot(snapshot);
        this.callbacks.onStatusChange?.(
          snapshot.totalIngestedTraces > 0 ? "STREAMING" : "LISTENING"
        );
      } catch {
        // Ignore malformed frame
      }
    });

    es.onerror = () => {
      if (this.closed) return;
      es.close();
      this.eventSource = null;
      this.callbacks.onStatusChange?.("OFFLINE", "SSE stream disconnected");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed) {
        void this.connect();
      }
    }, 3000);
  }

  public async sendSampleOtlpTrace(faulty = false): Promise<void> {
    const payload = createSampleOtlpRequest({ faulty });
    const resp = await fetch(`${this.baseUrl}/v1/traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Collector rejected /v1/traces with HTTP ${resp.status}`);
    }
    // Fetch immediate snapshot in case SSE is unavailable
    const snapResp = await fetch(`${this.baseUrl}/api/snapshot`);
    if (snapResp.ok) {
      const snapshot = (await snapResp.json()) as DynamicTopologySnapshot;
      this.callbacks.onSnapshot(snapshot);
      this.callbacks.onStatusChange?.(
        snapshot.totalIngestedTraces > 0 ? "STREAMING" : "LISTENING"
      );
    }
  }

  public async resetTraces(): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/api/reset`, { method: "POST" });
    if (!resp.ok) {
      throw new Error(`Failed to reset collector traces: HTTP ${resp.status}`);
    }
    const data = (await resp.json()) as { snapshot?: DynamicTopologySnapshot };
    if (data.snapshot) {
      this.callbacks.onSnapshot(data.snapshot);
      this.callbacks.onStatusChange?.("LISTENING");
    }
  }

  public disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
