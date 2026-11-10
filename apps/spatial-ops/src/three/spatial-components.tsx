import React, { useState, useSyncExternalStore } from "react";
import { useStateStore } from "@json-render/react";
import type { ServiceNodeData } from "../data/cluster-seed.js";
import {
  clampVec3,
  createSceneManifestStore,
  getEmptySceneSnapshot,
  safeHexColor,
  SceneManifestContext,
  useRegisterSceneEntity,
  type Vec3,
} from "./scene-manifest.js";
import { SpatialSceneCanvas } from "./SpatialSceneCanvas.js";

/*
 * Catalog renderers for the 6 spatial components.
 * Each 3D element renders a DOM manifest row (where core safety badges/fault cards attach)
 * and registers plain data with the canvas, which draws the actual WebGL meshes.
 */

const STATUS_TONE: Record<string, string> = {
  CRITICAL_OUTAGE: "border-rose-500/60 text-rose-300",
  DEGRADED: "border-amber-500/60 text-amber-300",
  CIRCUIT_OPEN: "border-indigo-500/60 text-indigo-300",
  MAINTENANCE: "border-slate-600 text-slate-400",
  NOMINAL: "border-emerald-500/40 text-emerald-300",
};

export interface ClusterTopologyCanvasViewProps {
  readonly props: {
    cameraFov: number;
    enableOrbitControls: boolean;
    enableGrid: boolean;
    enableBloom: boolean;
    ambientIntensity: number;
  };
  readonly children?: React.ReactNode;
}

export function ClusterTopologyCanvasView({
  props,
  children,
}: ClusterTopologyCanvasViewProps): React.JSX.Element {
  const [manifestStore] = useState(createSceneManifestStore);
  const manifest = useSyncExternalStore(
    manifestStore.subscribe,
    manifestStore.getSnapshot,
    getEmptySceneSnapshot
  );

  const { get, set } = useStateStore();
  const selectedServiceId = get("/cluster/selectedServiceId") as string | undefined;
  const services =
    (get("/cluster/services") as Record<string, ServiceNodeData> | undefined) ?? {};

  // Live statuses: SRE actions mutate the store; nodes recolor without re-streaming the spec.
  const liveStatusById: Record<string, string> = {};
  for (const [id, s] of Object.entries(services)) liveStatusById[id] = s.status;

  return (
    <SceneManifestContext.Provider value={manifestStore}>
      <div className="flex flex-col" data-testid="cluster-topology-canvas">
        <div className="relative h-[460px] w-full overflow-hidden">
          <SpatialSceneCanvas
            manifest={manifest}
            liveStatusById={liveStatusById}
            selectedServiceId={selectedServiceId}
            onSelectService={(id) => set("/cluster/selectedServiceId", id)}
            cameraFov={props.cameraFov}
            enableOrbitControls={props.enableOrbitControls}
            enableGrid={props.enableGrid}
            ambientIntensity={props.ambientIntensity}
          />
          <div className="pointer-events-none absolute left-2 top-2 rounded border border-slate-800 bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            FOV {props.cameraFov}° · {manifest.nodes.length} nodes · {manifest.edges.length} edges
            · drag to orbit, click a node to inspect
          </div>
        </div>

        {/* Scene manifest: one DOM row per spec element. Healed badges and fault cards render here. */}
        <div className="border-t border-slate-800 bg-slate-950/90 p-2">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Scene manifest (streamed spec elements)
          </div>
          <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {children}
          </div>
        </div>
      </div>
    </SceneManifestContext.Provider>
  );
}

export interface ServiceMeshNodeViewProps {
  readonly props: {
    serviceId: string;
    name: string;
    tier: string;
    position: Vec3;
    status: string;
    scale: number;
  };
}

export function ServiceMeshNodeView({
  props,
}: ServiceMeshNodeViewProps): React.JSX.Element {
  const { get, set } = useStateStore();
  const selectedId = get("/cluster/selectedServiceId") as string | undefined;
  const services =
    (get("/cluster/services") as Record<string, ServiceNodeData> | undefined) ?? {};
  const liveStatus = services[props.serviceId]?.status ?? props.status;
  const position = clampVec3(props.position);

  const onCanvas = useRegisterSceneEntity("nodes", {
    key: `node:${props.serviceId}`,
    serviceId: props.serviceId,
    name: props.name,
    tier: props.tier,
    position,
    status: props.status,
    scale: props.scale,
  });

  const isSelected = selectedId === props.serviceId;

  // Keyboard/a11y alternative to raycast selection.
  return (
    <button
      type="button"
      onClick={() => set("/cluster/selectedServiceId", props.serviceId)}
      aria-pressed={isSelected}
      data-testid={`service-node-3d-${props.serviceId}`}
      className={`flex w-full items-center justify-between gap-2 rounded border bg-slate-900/70 px-2 py-1 text-left font-mono text-[10px] transition hover:bg-slate-800 ${
        STATUS_TONE[liveStatus] ?? STATUS_TONE.NOMINAL
      } ${isSelected ? "ring-1 ring-cyan-400" : ""}`}
    >
      <span className="truncate font-sans text-[11px] font-semibold text-slate-100">
        {props.name}
      </span>
      <span className="shrink-0">
        {props.tier} · {liveStatus}
        {onCanvas ? "" : " · (no canvas)"}
      </span>
    </button>
  );
}

export interface TrafficFlowEdgeViewProps {
  readonly props: {
    edgeId: string;
    fromServiceId: string;
    toServiceId: string;
    status: string;
    particleSpeed: number;
  };
}

export function TrafficFlowEdgeView({
  props,
}: TrafficFlowEdgeViewProps): React.JSX.Element {
  useRegisterSceneEntity("edges", {
    key: `edge:${props.edgeId}`,
    edgeId: props.edgeId,
    from: props.fromServiceId,
    to: props.toServiceId,
    status: props.status,
    particleSpeed: props.particleSpeed,
  });

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded border bg-slate-900/60 px-2 py-1 font-mono text-[10px] ${
        props.status === "SEVERED"
          ? "border-rose-500/50 text-rose-300"
          : props.status === "CONGESTED" || props.status === "DEGRADED"
            ? "border-amber-500/50 text-amber-300"
            : "border-cyan-500/30 text-cyan-300"
      }`}
      data-testid={`traffic-edge-${props.edgeId}`}
    >
      <span className="truncate">
        {props.fromServiceId} → {props.toServiceId}
      </span>
      <span className="shrink-0">
        {props.status} · {props.particleSpeed}x
      </span>
    </div>
  );
}

export interface BlastRadiusViewProps {
  readonly props: {
    targetServiceId: string;
    radius: number;
    severity: string;
    pulseRate: number;
  };
}

export function BlastRadiusView({ props }: BlastRadiusViewProps): React.JSX.Element {
  useRegisterSceneEntity("blasts", {
    key: `blast:${props.targetServiceId}`,
    targetServiceId: props.targetServiceId,
    radius: props.radius,
    severity: props.severity,
    pulseRate: props.pulseRate,
  });

  return (
    <div
      className="flex items-center justify-between gap-2 rounded border border-rose-500/40 bg-rose-950/25 px-2 py-1 font-mono text-[10px] text-rose-200"
      data-testid="blast-radius-sphere"
    >
      <span className="truncate">Blast radius · {props.targetServiceId}</span>
      <span className="shrink-0">
        r={props.radius} · {props.pulseRate}Hz · {props.severity}
      </span>
    </div>
  );
}

export interface RegionZoneViewProps {
  readonly props: {
    regionName: string;
    center: Vec3;
    size: Vec3;
    wireframeColor: string;
  };
}

export function RegionZoneView({ props }: RegionZoneViewProps): React.JSX.Element {
  // Size is clamped to a sane positive range so a hostile spec cannot build a giant frame.
  const size = clampVec3(props.size).map((v) => Math.max(0.5, Math.abs(v))) as Vec3;
  const color = safeHexColor(props.wireframeColor);

  useRegisterSceneEntity("zones", {
    key: `zone:${props.regionName}`,
    regionName: props.regionName,
    center: clampVec3(props.center),
    size,
    color,
  });

  return (
    <div
      className="flex items-center justify-between gap-2 rounded border border-dashed border-slate-700 bg-slate-900/40 px-2 py-1 font-mono text-[10px] text-slate-300"
      data-testid="region-boundary"
    >
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
        Zone · {props.regionName}
      </span>
      <span className="shrink-0 text-slate-500">size {size.join("×")}</span>
    </div>
  );
}
