import React, {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { defineRegistry, useStateStore } from "@json-render/react";
import {
  TelemetryTracker,
  TimeTravelStateStore,
  wrapRegistryWithTelemetry,
} from "@genui-studio/core";
import { spatialVerifiedCatalog } from "./spatial-catalog.js";
import {
  BlastRadiusView,
  ClusterTopologyCanvasView,
  RegionZoneView,
  ServiceMeshNodeView,
  TrafficFlowEdgeView,
} from "../three/spatial-components.js";
import {
  ClusterSummary,
  executeSreMutation,
  recomputeClusterSummary,
  ServiceNodeData,
  SreAuditEntry,
  StructuredErrorLog,
  TrafficEdgeData,
} from "../data/cluster-seed.js";

export interface SpatialRuntimeContextValue {
  timeTravelStore?: TimeTravelStateStore;
  onMutationExecuted?: (entry: SreAuditEntry) => void;
}

export const SpatialRuntimeContext = createContext<SpatialRuntimeContextValue>({});

type SreActionName =
  | "tripCircuitBreaker"
  | "triggerRegionalFailover"
  | "scaleServiceReplicas"
  | "rollbackDeployment";

/**
 * Builds a catalog-level action handler that executes the real SRE mutation against
 * the @json-render state model (used when an LLM-emitted `on.press` binding triggers an action).
 */
function createSreActionHandler(actionName: SreActionName) {
  return async (
    params: Record<string, unknown> | undefined,
    setState: (
      updater: (prev: Record<string, unknown>) => Record<string, unknown>
    ) => void
  ): Promise<void> => {
    if (!params) return;
    setState((prev) => {
      const next = structuredClone(prev);
      const readPointer = (path: string): unknown =>
        path
          .split("/")
          .filter(Boolean)
          .reduce<unknown>(
            (node, seg) =>
              node && typeof node === "object"
                ? (node as Record<string, unknown>)[seg]
                : undefined,
            next
          );
      const writePointer = (path: string, value: unknown): void => {
        const segs = path.split("/").filter(Boolean);
        let node = next as Record<string, unknown>;
        for (const seg of segs.slice(0, -1)) {
          node[seg] ??= {};
          node = node[seg] as Record<string, unknown>;
        }
        node[segs[segs.length - 1]!] = value;
      };
      executeSreMutation(
        { get: readPointer, set: writePointer },
        actionName,
        params
      );
      return next;
    });
  };
}

export const sreActionHandlers = {
  tripCircuitBreaker: createSreActionHandler("tripCircuitBreaker"),
  triggerRegionalFailover: createSreActionHandler("triggerRegionalFailover"),
  scaleServiceReplicas: createSreActionHandler("scaleServiceReplicas"),
  rollbackDeployment: createSreActionHandler("rollbackDeployment"),
};

function useSreMutation() {
  const stateStore = useStateStore();
  const { timeTravelStore, onMutationExecuted } = useContext(SpatialRuntimeContext);

  return (
    type: SreActionName,
    payload: Record<string, unknown>
  ): SreAuditEntry => {
    const targetStore = timeTravelStore ?? {
      get: (p: string) => stateStore.get(p),
      set: (p: string, v: unknown) => stateStore.set(p, v),
      update: (updates: Record<string, unknown>) => stateStore.update(updates),
    };
    const entry = executeSreMutation(targetStore, type, payload);
    if (onMutationExecuted) {
      onMutationExecuted(entry);
    }
    return entry;
  };
}

/**
 * Modern Web Guidance: Light-dismiss backdrop click fallback for modal <dialog>
 */
function handleDialogLightDismiss(
  e: React.MouseEvent<HTMLDialogElement>,
  dialogEl: HTMLDialogElement | null
) {
  if (!dialogEl) return;
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const rect = dialogEl.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      dialogEl.close();
    }
  }
}

export function createSpatialRegistry(telemetry?: TelemetryTracker) {
  const { registry: rawComponentRegistry, handlers, executeAction } = defineRegistry(
    spatialVerifiedCatalog.catalog,
    {
      components: {
        // ==========================================
        // 3D SPATIAL COMPONENTS
        // ==========================================
        AegisWarRoomShell: ({ props, slots, children }) => {
          const sevBadge =
            props.severity === "SEV-0"
              ? "bg-rose-600/25 text-rose-300 border-rose-500/60 animate-pulse"
              : props.severity === "SEV-1"
              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
              : props.severity === "SEV-2"
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

          return (
            <div
              className="space-y-4 rounded-xl border border-slate-800/90 bg-slate-950/80 p-4 shadow-2xl"
              data-testid="aegis-war-room-shell"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-xs font-bold ${sevBadge}`}
                  >
                    {props.severity} INCIDENT
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-100">
                      {props.incidentTitle}
                    </h2>
                    <p className="font-mono text-xs text-slate-400">
                      Spatial Region: <span className="text-cyan-300 font-semibold">{props.activeRegion}</span> · Layout: {props.hudPosition}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span>Dual-Viewport 3D/2D SRE Topology</span>
                </div>
              </div>

              {/* Viewport Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* 3D Spatial Viewport (Left/Center: 7 columns) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      3D SPATIAL TOPOLOGY CANVAS
                    </span>
                    <span>Raycast Hover & Selection Active</span>
                  </div>
                  <div className="relative min-h-[440px] rounded-lg border border-slate-800/90 bg-[#04060E] overflow-hidden">
                    {slots?.spatial ?? children}
                  </div>
                </div>

                {/* 2D Tactical HUD (Right: 5 columns) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      TACTICAL SRE HUD & RUNBOOKS
                    </span>
                    <span>Live State-Store Bound</span>
                  </div>
                  <div className="space-y-4">
                    {slots?.hud ?? null}
                  </div>
                </div>
              </div>
            </div>
          );
        },

        ClusterTopologyCanvas: ({ props, children }) => (
          <ClusterTopologyCanvasView props={props}>{children}</ClusterTopologyCanvasView>
        ),

        ServiceMeshNode3D: ({ props }) => {
          if (
            props.name === "CHAOS_TRIGGER_RENDER_CRASH" ||
            props.serviceId === "srv-chaos-throw"
          ) {
            throw new Error("Simulated WebGL mesh shader compilation failure");
          }
          return <ServiceMeshNodeView props={props} />;
        },

        TrafficFlowEdge3D: ({ props }) => <TrafficFlowEdgeView props={props} />,

        BlastRadiusSphere3D: ({ props }) => <BlastRadiusView props={props} />,

        RegionZoneBoundary3D: ({ props }) => <RegionZoneView props={props} />,

        // ==========================================
        // 2D TACTICAL HUD COMPONENTS
        // ==========================================
        IncidentHeroBanner: ({ props }) => {
          const executeMutation = useSreMutation();

          return (
            <div
              className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-4 space-y-2 shadow-lg"
              data-testid="incident-hero-banner"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-rose-500 px-2 py-0.5 font-mono text-xs font-bold text-slate-950">
                    {props.severity} ACTIVE
                  </span>
                  <span className="font-mono text-xs text-slate-300">
                    MTTD: {props.mttdMinutes}m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    executeMutation("triggerRegionalFailover", {
                      fromRegion: "US-East",
                      toRegion: "EU-West",
                      trafficPercentage: 70,
                    })
                  }
                  className="rounded bg-rose-500 px-3 py-1 font-mono text-xs font-semibold text-slate-950 hover:bg-rose-400 transition"
                >
                  Trigger Emergency Regional Failover ⚡
                </button>
              </div>
              <h3 className="text-sm font-bold text-slate-100">{props.title}</h3>
              <p className="text-xs text-slate-300">{props.summary}</p>
            </div>
          );
        },

        ServiceDiagnosticPanel: ({ props }) => {
          const { get } = useStateStore();
          const selectedId =
            (get("/cluster/selectedServiceId") as string | undefined) ??
            props.defaultServiceId;
          const services =
            (get("/cluster/services") as Record<string, ServiceNodeData> | undefined) ?? {};
          const service = services[selectedId] ?? services[props.defaultServiceId];

          if (!service) {
            return (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs text-slate-400">
                Select a 3D service node to inspect telemetry.
              </div>
            );
          }

          return (
            <div
              className="rounded-lg border border-slate-800/90 bg-slate-900/75 p-4 space-y-3"
              data-testid="service-diagnostic-panel"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    {service.name}
                  </h4>
                  <span className="font-mono text-xs text-slate-400">
                    {service.id} · {service.region} · {service.version}
                  </span>
                </div>
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${
                    service.status === "CRITICAL_OUTAGE"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : service.status === "DEGRADED"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {service.status}
                </span>
              </div>

              {/* Progress Gauges */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between font-mono text-[11px] text-slate-400 mb-1">
                    <span>CPU SATURATION</span>
                    <span className="font-semibold text-slate-200">
                      {service.cpuSaturationPercent}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${service.cpuSaturationPercent}%` }}
                      className={`h-full ${
                        service.cpuSaturationPercent > 85
                          ? "bg-rose-500"
                          : service.cpuSaturationPercent > 65
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-mono text-[11px] text-slate-400 mb-1">
                    <span>MEMORY SATURATION</span>
                    <span className="font-semibold text-slate-200">
                      {service.memorySaturationPercent}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${service.memorySaturationPercent}%` }}
                      className={`h-full ${
                        service.memorySaturationPercent > 85
                          ? "bg-rose-500"
                          : service.memorySaturationPercent > 65
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* RPS & Replica Counters */}
              <div className="grid grid-cols-3 gap-2 rounded border border-slate-800 bg-slate-950/70 p-2.5 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">THROUGHPUT</span>
                  <span className="text-slate-100 font-semibold">
                    {service.rps.toLocaleString()} RPS
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">ERROR RATE</span>
                  <span
                    className={
                      service.errorRatePercent > 5
                        ? "text-rose-300 font-semibold"
                        : "text-emerald-300"
                    }
                  >
                    {service.errorRatePercent}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">REPLICAS</span>
                  <span className="text-cyan-300 font-semibold">
                    {service.replicas} / {service.maxReplicas} pods
                  </span>
                </div>
              </div>

              {props.showDependencies && service.dependencies.length > 0 && (
                <div className="font-mono text-[11px] text-slate-400">
                  <span className="block text-[10px] uppercase text-slate-500 mb-0.5">
                    Downstream Dependencies
                  </span>
                  <span>{service.dependencies.join(", ")}</span>
                </div>
              )}
            </div>
          );
        },

        LatencyHistogramCard: ({ props }) => {
          const { get } = useStateStore();
          const selectedId =
            (get("/cluster/selectedServiceId") as string | undefined) ??
            props.serviceId;
          const services =
            (get("/cluster/services") as Record<string, ServiceNodeData> | undefined) ?? {};
          const service = services[selectedId] ?? services[props.serviceId];

          const p50 = service?.p50LatencyMs ?? 25;
          const p95 = service?.p95LatencyMs ?? 120;
          const p99 = service?.p99LatencyMs ?? 480;

          return (
            <div
              className="rounded-lg border border-slate-800/90 bg-slate-900/75 p-4 space-y-3"
              data-testid="latency-histogram-card"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-100">
                  Latency Distribution & Burn Rate
                </h4>
                <span className="font-mono text-xs text-slate-400">
                  Window: {props.timeWindow}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
                  <span className="text-[10px] text-slate-400 block">p50 MEDIAN</span>
                  <span className="text-emerald-300 font-semibold">{p50}ms</span>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
                  <span className="text-[10px] text-slate-400 block">p95 TAIL</span>
                  <span
                    className={p95 > 200 ? "text-amber-300 font-semibold" : "text-slate-200"}
                  >
                    {p95}ms
                  </span>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
                  <span className="text-[10px] text-slate-400 block">p99 OUTLIER</span>
                  <span
                    className={p99 > 500 ? "text-rose-300 font-semibold" : "text-slate-200"}
                  >
                    {p99}ms
                  </span>
                </div>
              </div>
            </div>
          );
        },

        ErrorLogTailer: ({ props }) => {
          const { get } = useStateStore();
          const logs =
            (get("/cluster/logs") as StructuredErrorLog[] | undefined) ?? [];
          const visible = logs.slice(0, props.maxEntries);

          return (
            <div
              className="rounded-lg border border-slate-800/90 bg-slate-900/75 p-4 space-y-2.5"
              data-testid="error-log-tailer"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-100">
                  {props.title}
                </h4>
                <span className="font-mono text-xs text-slate-400">
                  {visible.length} entries
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto">
                {visible.map((l) => (
                  <div
                    key={l.id}
                    className="rounded border border-slate-800/80 bg-slate-950/80 p-2 space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`font-semibold ${
                          l.level === "FATAL" || l.level === "ERROR"
                            ? "text-rose-300"
                            : "text-amber-300"
                        }`}
                      >
                        [{l.level}] {l.serviceId} · HTTP {l.statusCode}
                      </span>
                      <span className="text-slate-500">
                        {l.timestamp.slice(11, 23)}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] break-all">
                      {l.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        },

        BlastRadiusDependencyTree: ({ props }) => {
          const { get } = useStateStore();
          const selectedId =
            (get("/cluster/selectedServiceId") as string | undefined) ??
            props.rootServiceId;
          const services =
            (get("/cluster/services") as Record<string, ServiceNodeData> | undefined) ?? {};
          const service = services[selectedId] ?? services[props.rootServiceId];

          return (
            <div
              className="rounded-lg border border-slate-800/90 bg-slate-900/75 p-4 space-y-2.5"
              data-testid="blast-radius-tree"
            >
              <h4 className="text-sm font-semibold text-slate-100">
                Topological Blast Radius & Call Graph
              </h4>
              <div className="rounded border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    UPSTREAM INGRESS CALLERS
                  </span>
                  <span className="text-cyan-300">
                    {service?.callers.join(", ") || "None"}
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-1.5">
                  <span className="text-[10px] text-slate-400 block">
                    TARGET NODE
                  </span>
                  <span className="font-semibold text-slate-100">
                    {service?.id} ({service?.status})
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-1.5">
                  <span className="text-[10px] text-slate-400 block">
                    DOWNSTREAM CASCADING IMPACT
                  </span>
                  <span className="text-rose-300">
                    {service?.dependencies.join(" → ") || "Terminal node"}
                  </span>
                </div>
              </div>
            </div>
          );
        },

        RunbookActionDesk: ({ props }) => {
          const { get } = useStateStore();
          const executeMutation = useSreMutation();
          const selectedId =
            (get("/cluster/selectedServiceId") as string | undefined) ?? "srv-api-gateway";
          const [replicasDelta, setReplicasDelta] = useState("6");
          const [lastAudit, setLastAudit] = useState<SreAuditEntry | null>(null);
          const dialogRef = useRef<HTMLDialogElement>(null);
          const hintId = useId();

          const handleScale = () => {
            const entry = executeMutation("scaleServiceReplicas", {
              serviceId: selectedId,
              deltaReplicas: Number(replicasDelta) || 6,
            });
            setLastAudit(entry);
          };

          const handleCircuit = () => {
            const entry = executeMutation("tripCircuitBreaker", {
              serviceId: selectedId,
            });
            setLastAudit(entry);
          };

          const handleRollback = () => {
            const entry = executeMutation("rollbackDeployment", {
              serviceId: selectedId,
              targetVersion: "v3.8.3-stable",
            });
            setLastAudit(entry);
            dialogRef.current?.close();
          };

          return (
            <div
              className="rounded-lg border border-cyan-500/35 bg-slate-900/80 p-4 space-y-3"
              data-testid="runbook-action-desk"
            >
              <div className="flex items-center justify-between">
                <span className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                  REMEDIATION RUNBOOKS · ACTIVE NODE: {selectedId}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  Guardrailed Execution
                </span>
              </div>

              <h4 className="text-sm font-semibold text-slate-100">{props.heading}</h4>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleCircuit}
                  data-testid="action-trip-circuit-btn"
                  className="rounded border border-indigo-500/50 bg-indigo-500/20 px-3 py-2 text-left font-mono text-xs text-indigo-200 hover:bg-indigo-500/30 transition"
                >
                  <span className="font-semibold block">Trip Circuit Breaker</span>
                  <span className="text-[10px] text-slate-400">
                    Shed upstream ingress traffic
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => dialogRef.current?.showModal()}
                  data-testid="action-rollback-btn"
                  className="rounded border border-rose-500/50 bg-rose-500/20 px-3 py-2 text-left font-mono text-xs text-rose-200 hover:bg-rose-500/30 transition"
                >
                  <span className="font-semibold block">Rollback to v3.8.3</span>
                  <span className="text-[10px] text-slate-400">
                    Revert canary deployment
                  </span>
                </button>
              </div>

              {/* Scale Replicas Control */}
              <div className="space-y-1 text-xs pt-1">
                <label
                  htmlFor={`scale-${hintId}`}
                  className="block font-medium text-slate-200"
                >
                  Scale Pod Replicas (+Delta)
                </label>
                <span id={hintId} className="field-hint">
                  Adds 1 to 20 container replicas to alleviate CPU pressure
                </span>
                <div className="flex gap-2">
                  <input
                    id={`scale-${hintId}`}
                    type="number"
                    min={1}
                    max={20}
                    value={replicasDelta}
                    onChange={(e) => setReplicasDelta(e.target.value)}
                    className="w-24 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleScale}
                    data-testid="action-scale-replicas-btn"
                    className="flex-1 rounded bg-cyan-500 px-3 py-1 font-mono text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition"
                  >
                    Scale Pods (+{replicasDelta})
                  </button>
                </div>
              </div>

              {lastAudit && (
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-200">
                  ✓ Executed: {lastAudit.summary}
                </div>
              )}

              {/* Confirmation Gate Dialog */}
              <dialog
                ref={dialogRef}
                {...({ closedby: "any" } as Record<string, unknown>)}
                onClick={(e) => handleDialogLightDismiss(e, dialogRef.current)}
                className="m-auto max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
              >
                <h5 className="text-sm font-semibold">
                  Confirm Canary Rollback
                </h5>
                <p className="mt-2 text-xs text-slate-300">
                  This action will roll back container pods for{" "}
                  <strong className="font-mono text-cyan-300">{selectedId}</strong> to{" "}
                  <code className="font-mono">v3.8.3-stable</code> and record an
                  immutable Time-Travel snapshot.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => dialogRef.current?.close()}
                    className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRollback}
                    className="rounded bg-rose-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-rose-400"
                  >
                    Confirm Rollback
                  </button>
                </div>
              </dialog>
            </div>
          );
        },

        ClusterMetricsGrid: ({ props }) => {
          const { get } = useStateStore();
          const summary = get("/cluster/summary") as ClusterSummary | undefined;

          return (
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              data-testid="cluster-metrics-grid"
            >
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-[10px] font-mono text-slate-400 block">
                  GLOBAL ERROR RATE
                </span>
                <span
                  className={`font-mono text-xl font-bold ${
                    (summary?.globalErrorRatePercent ?? 0) > 5
                      ? "text-rose-300"
                      : "text-emerald-300"
                  }`}
                >
                  {summary?.globalErrorRatePercent ?? 14.8}%
                </span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-[10px] font-mono text-slate-400 block">
                  TOTAL THROUGHPUT
                </span>
                <span className="font-mono text-xl font-bold text-slate-100">
                  {(summary?.globalRps ?? 68400).toLocaleString()} RPS
                </span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-[10px] font-mono text-slate-400 block">
                  ERROR BUDGET REMAINING
                </span>
                <span className="font-mono text-xl font-bold text-cyan-300">
                  {summary?.errorBudgetRemainingPercent ?? 62.4}%
                </span>
              </div>
            </div>
          );
        },

        SreAuditTrailBanner: ({ props }) => {
          const { get } = useStateStore();
          const auditLog =
            (get("/cluster/auditLog") as SreAuditEntry[] | undefined) ?? [];
          const visible = auditLog.slice(0, props.maxEntries);

          return (
            <div
              className="rounded-lg border border-slate-800/90 bg-slate-950/90 p-3.5 space-y-2"
              data-testid="sre-audit-trail-banner"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
                    {props.title}
                  </h4>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  Total Entries: {auditLog.length} (Time-Travel Undo Ready)
                </span>
              </div>

              <div className="space-y-1.5">
                {visible.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800/80 bg-slate-900/70 px-2.5 py-1.5 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] text-cyan-300">
                        {entry.actionType}
                      </span>
                      <span className="font-sans text-slate-200">
                        {entry.summary}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">
                      {entry.timestamp.slice(11, 19)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        },
      },

      actions: sreActionHandlers,
    }
  );

  const safeRegistry = wrapRegistryWithTelemetry(
    spatialVerifiedCatalog,
    rawComponentRegistry,
    {
      telemetryTracker: telemetry,
      showHealedBadges: true,
    }
  );

  return {
    rawComponentRegistry,
    safeRegistry,
    actionHandlers: sreActionHandlers,
    handlers,
    executeAction,
  };
}
