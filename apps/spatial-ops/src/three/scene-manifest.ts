import { createContext, useContext, useEffect } from "react";

/**
 * Scene Manifest Store
 *
 * Why this exists: @genui-studio/core wraps every catalog component with DOM-based safety UI
 * (`<DiagnosticHealedBadge />`, `<ElementFaultCard />`). The R3F reconciler cannot host DOM
 * nodes inside `<Canvas>`, so 3D spec elements cannot be rendered *directly* as Three.js children.
 *
 * Instead, each validated 3D element (already healed by the core) registers a plain-data
 * description here, and renders a compact DOM "manifest row" where its safety badges live.
 * A single `<Canvas>` subscribes to the manifest and draws real WebGL meshes from it.
 * A faulted or hallucinated element never registers, so it can never reach the GPU.
 */

export const SPATIAL_BOUND = 12;

export type Vec3 = [number, number, number];

export interface ManifestNode {
  readonly key: string;
  readonly serviceId: string;
  readonly name: string;
  readonly tier: string;
  readonly position: Vec3;
  readonly status: string;
  readonly scale: number;
}

export interface ManifestEdge {
  readonly key: string;
  readonly edgeId: string;
  readonly from: string;
  readonly to: string;
  readonly status: string;
  readonly particleSpeed: number;
}

export interface ManifestBlast {
  readonly key: string;
  readonly targetServiceId: string;
  readonly radius: number;
  readonly severity: string;
  readonly pulseRate: number;
}

export interface ManifestZone {
  readonly key: string;
  readonly regionName: string;
  readonly center: Vec3;
  readonly size: Vec3;
  readonly color: string;
}

export interface SceneManifestSnapshot {
  readonly version: number;
  readonly nodes: readonly ManifestNode[];
  readonly edges: readonly ManifestEdge[];
  readonly blasts: readonly ManifestBlast[];
  readonly zones: readonly ManifestZone[];
}

type EntityKind = "nodes" | "edges" | "blasts" | "zones";
type EntityByKind = {
  nodes: ManifestNode;
  edges: ManifestEdge;
  blasts: ManifestBlast;
  zones: ManifestZone;
};

export interface SceneManifestStore {
  register<K extends EntityKind>(kind: K, entity: EntityByKind[K]): void;
  unregister(kind: EntityKind, key: string): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SceneManifestSnapshot;
}

const EMPTY_SNAPSHOT: SceneManifestSnapshot = {
  version: 0,
  nodes: [],
  edges: [],
  blasts: [],
  zones: [],
};

export function getEmptySceneSnapshot(): SceneManifestSnapshot {
  return EMPTY_SNAPSHOT;
}

export function createSceneManifestStore(): SceneManifestStore {
  const maps = {
    nodes: new Map<string, ManifestNode>(),
    edges: new Map<string, ManifestEdge>(),
    blasts: new Map<string, ManifestBlast>(),
    zones: new Map<string, ManifestZone>(),
  };
  const listeners = new Set<() => void>();
  let snapshot: SceneManifestSnapshot = EMPTY_SNAPSHOT;

  function rebuild(): void {
    // Snapshot identity changes only on mutation (required by useSyncExternalStore).
    snapshot = {
      version: snapshot.version + 1,
      nodes: [...maps.nodes.values()],
      edges: [...maps.edges.values()],
      blasts: [...maps.blasts.values()],
      zones: [...maps.zones.values()],
    };
    for (const l of listeners) l();
  }

  return {
    register(kind, entity) {
      (maps[kind] as Map<string, typeof entity>).set(entity.key, entity);
      rebuild();
    },
    unregister(kind, key) {
      if (maps[kind].delete(key)) rebuild();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

export const SceneManifestContext = createContext<SceneManifestStore | null>(null);

/**
 * Registers a validated 3D entity with the nearest topology canvas.
 * No-op when rendered outside a `ClusterTopologyCanvas` (e.g. an LLM places a 3D node in the HUD);
 * the element then degrades to its DOM manifest row only.
 */
export function useRegisterSceneEntity<K extends EntityKind>(
  kind: K,
  entity: EntityByKind[K]
): boolean {
  const store = useContext(SceneManifestContext);
  const signature = JSON.stringify(entity);
  useEffect(() => {
    if (!store) return;
    store.register(kind, entity);
    return () => store.unregister(kind, entity.key);
    // `signature` captures every field of `entity`; re-register only on real changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, kind, signature]);
  return store !== null;
}

/** Defense in depth: clamp to the scene bounding box even after Zod healing. */
export function clampCoord(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(-SPATIAL_BOUND, Math.min(SPATIAL_BOUND, n));
}

export function clampVec3(value: unknown): Vec3 {
  const arr = Array.isArray(value) ? value : [];
  return [clampCoord(arr[0]), clampCoord(arr[1]), clampCoord(arr[2])];
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function safeHexColor(value: unknown, fallback = "#38BDF8"): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}
