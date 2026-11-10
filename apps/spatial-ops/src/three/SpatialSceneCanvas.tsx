import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type {
  ManifestBlast,
  ManifestEdge,
  ManifestNode,
  ManifestZone,
  SceneManifestSnapshot,
  Vec3,
} from "./scene-manifest.js";
import { clampVec3, safeHexColor } from "./scene-manifest.js";

/*
 * Rules enforced here (see /.kiro/steering/spatial-3d-rules.md):
 * - Geometries are created once per canvas and shared by every node; disposed on unmount.
 * - Every imperatively created material/geometry has a matching dispose() in an effect cleanup.
 * - useFrame callbacks allocate nothing: they mutate refs and use module-level scratch objects.
 * - The render loop pauses while the tab is hidden; WebGL context loss degrades to a DOM badge.
 */

const STATUS_COLORS: Record<string, string> = {
  NOMINAL: "#10B981",
  DEGRADED: "#F59E0B",
  CRITICAL_OUTAGE: "#EF4444",
  CIRCUIT_OPEN: "#818CF8",
  MAINTENANCE: "#64748B",
};

interface StatusAnimation {
  readonly rate: number;
  readonly amp: number;
  readonly baseEmissive: number;
  readonly emissiveAmp: number;
  readonly jitter: number;
}

const STATUS_ANIMATION: Record<string, StatusAnimation> = {
  NOMINAL: { rate: 1.2, amp: 0.025, baseEmissive: 0.25, emissiveAmp: 0.15, jitter: 0 },
  DEGRADED: { rate: 3.2, amp: 0.05, baseEmissive: 0.35, emissiveAmp: 0.4, jitter: 0.015 },
  CRITICAL_OUTAGE: { rate: 6.5, amp: 0.09, baseEmissive: 0.5, emissiveAmp: 0.9, jitter: 0.04 },
  CIRCUIT_OPEN: { rate: 0.6, amp: 0.01, baseEmissive: 0.2, emissiveAmp: 0.05, jitter: 0 },
  MAINTENANCE: { rate: 0.4, amp: 0.0, baseEmissive: 0.1, emissiveAmp: 0.0, jitter: 0 },
};

const EDGE_COLORS: Record<string, string> = {
  NOMINAL: "#22D3EE",
  DEGRADED: "#F59E0B",
  CONGESTED: "#FB923C",
  SEVERED: "#EF4444",
};

const PARTICLES_PER_EDGE = 4;

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.NOMINAL!;
}

function statusAnimation(status: string): StatusAnimation {
  return STATUS_ANIMATION[status] ?? STATUS_ANIMATION.NOMINAL!;
}

/** Stable per-node phase offset so pulses don't synchronize. */
function phaseFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 628) / 100;
}

interface SharedGeometries {
  readonly sphere: THREE.SphereGeometry;
  readonly box: THREE.BoxGeometry;
  readonly cylinder: THREE.CylinderGeometry;
  readonly octahedron: THREE.OctahedronGeometry;
  readonly torusKnot: THREE.TorusKnotGeometry;
  readonly fractureShell: THREE.IcosahedronGeometry;
  readonly selectionRing: THREE.TorusGeometry;
  readonly particle: THREE.SphereGeometry;
  readonly blast: THREE.SphereGeometry;
}

function createSharedGeometries(): SharedGeometries {
  return {
    sphere: new THREE.SphereGeometry(0.42, 32, 24),
    box: new THREE.BoxGeometry(0.7, 0.7, 0.7),
    cylinder: new THREE.CylinderGeometry(0.4, 0.4, 0.75, 32),
    octahedron: new THREE.OctahedronGeometry(0.5),
    torusKnot: new THREE.TorusKnotGeometry(0.28, 0.09, 64, 8),
    fractureShell: new THREE.IcosahedronGeometry(0.72, 1),
    selectionRing: new THREE.TorusGeometry(0.78, 0.025, 8, 64),
    particle: new THREE.SphereGeometry(0.055, 8, 8),
    blast: new THREE.SphereGeometry(1, 32, 24),
  };
}

function geometryForTier(tier: string, g: SharedGeometries): THREE.BufferGeometry {
  switch (tier) {
    case "INGRESS":
    case "GATEWAY":
      return g.octahedron;
    case "DATABASE":
      return g.cylinder;
    case "CACHE":
      return g.box;
    case "BROKER":
      return g.torusKnot;
    default:
      return g.sphere;
  }
}

// ---------------------------------------------------------------------------
// Service node
// ---------------------------------------------------------------------------

interface ServiceNodeMeshProps {
  readonly node: ManifestNode;
  readonly geometries: SharedGeometries;
  readonly selectionMaterial: THREE.Material;
  readonly selected: boolean;
  readonly onSelect: (serviceId: string) => void;
}

function ServiceNodeMesh({
  node,
  geometries,
  selectionMaterial,
  selected,
  onSelect,
}: ServiceNodeMeshProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.45 }),
    []
  );
  const shellMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    []
  );

  useEffect(
    () => () => {
      material.dispose();
      shellMaterial.dispose();
    },
    [material, shellMaterial]
  );

  useEffect(() => {
    const c = statusColor(node.status);
    material.color.set(c);
    material.emissive.set(c);
    shellMaterial.color.set(c);
  }, [node.status, material, shellMaterial]);

  const [px, py, pz] = node.position;
  const phase = useMemo(() => phaseFor(node.serviceId), [node.serviceId]);
  const fractured = node.status === "CRITICAL_OUTAGE";

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    const anim = statusAnimation(node.status);
    const wave = Math.sin(t * anim.rate + phase);

    group.scale.setScalar(node.scale * (1 + wave * anim.amp));
    material.emissiveIntensity =
      anim.baseEmissive + Math.max(0, wave) * anim.emissiveAmp;

    if (anim.jitter > 0) {
      group.position.set(
        px + Math.sin(t * 37 + phase) * anim.jitter,
        py + Math.sin(t * 41 + phase * 2) * anim.jitter,
        pz + Math.sin(t * 43 + phase * 3) * anim.jitter
      );
    } else {
      group.position.set(px, py, pz);
    }

    const shell = shellRef.current;
    if (shell) {
      shell.rotation.x = t * 0.9;
      shell.rotation.y = t * 1.3;
    }
    const ring = ringRef.current;
    if (ring) ring.rotation.z = t * 1.5;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(node.serviceId);
  };

  return (
    <>
      <group ref={groupRef} position={node.position}>
        <mesh
          geometry={geometryForTier(node.tier, geometries)}
          material={material}
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        />
        {fractured && (
          <mesh
            ref={shellRef}
            geometry={geometries.fractureShell}
            material={shellMaterial}
          />
        )}
        {selected && (
          <mesh
            ref={ringRef}
            geometry={geometries.selectionRing}
            material={selectionMaterial}
            rotation={[Math.PI / 2, 0, 0]}
          />
        )}
      </group>
      <Html
        position={[px, py + 0.75 * node.scale, pz]}
        center
        distanceFactor={9}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className={`whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] ${
            selected
              ? "border-cyan-400 bg-cyan-950/90 text-cyan-200"
              : "border-slate-700 bg-slate-950/85 text-slate-300"
          }`}
        >
          {node.name}
        </div>
      </Html>
    </>
  );
}

// ---------------------------------------------------------------------------
// Traffic edge with packet particles
// ---------------------------------------------------------------------------

interface TrafficEdgeLineProps {
  readonly edge: ManifestEdge;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly geometries: SharedGeometries;
}

function TrafficEdgeLine({
  edge,
  from,
  to,
  geometries,
}: TrafficEdgeLineProps): React.JSX.Element {
  const endpointsKey = `${from.join(",")}|${to.join(",")}`;

  const curve = useMemo(() => {
    const a = new THREE.Vector3(from[0], from[1], from[2]);
    const b = new THREE.Vector3(to[0], to[1], to[2]);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += a.distanceTo(b) * 0.22;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointsKey]);

  const lineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true }),
    []
  );
  const particleMaterial = useMemo(() => new THREE.MeshBasicMaterial(), []);
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    return new THREE.Line(geometry, lineMaterial);
  }, [curve, lineMaterial]);

  useEffect(() => () => line.geometry.dispose(), [line]);
  useEffect(
    () => () => {
      lineMaterial.dispose();
      particleMaterial.dispose();
    },
    [lineMaterial, particleMaterial]
  );

  useEffect(() => {
    const c = EDGE_COLORS[edge.status] ?? EDGE_COLORS.NOMINAL!;
    lineMaterial.color.set(c);
    lineMaterial.opacity = edge.status === "SEVERED" ? 0.3 : 0.75;
    particleMaterial.color.set(c);
  }, [edge.status, lineMaterial, particleMaterial]);

  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const severed = edge.status === "SEVERED";

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PARTICLES_PER_EDGE; i++) {
      const mesh = particleRefs.current[i];
      if (!mesh) continue;
      mesh.visible = !severed;
      if (severed) continue;
      const progress = (t * edge.particleSpeed * 0.22 + i / PARTICLES_PER_EDGE) % 1;
      curve.getPoint(progress, mesh.position); // writes into existing vector: no allocation
    }
  });

  return (
    <>
      <primitive object={line} />
      {Array.from({ length: PARTICLES_PER_EDGE }, (_, i) => (
        <mesh
          key={i}
          ref={(m: THREE.Mesh | null) => {
            particleRefs.current[i] = m;
          }}
          geometry={geometries.particle}
          material={particleMaterial}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Blast radius & region zone
// ---------------------------------------------------------------------------

function BlastRadiusVolume({
  blast,
  center,
  geometries,
}: {
  readonly blast: ManifestBlast;
  readonly center: Vec3;
  readonly geometries: SharedGeometries;
}): React.JSX.Element {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.color.set(
      blast.severity === "CRITICAL"
        ? "#EF4444"
        : blast.severity === "HIGH"
          ? "#F97316"
          : "#F59E0B"
    );
  }, [blast.severity, material]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const wave = Math.sin(state.clock.elapsedTime * blast.pulseRate * Math.PI);
    mesh.scale.setScalar(blast.radius * (1 + wave * 0.06));
    material.opacity = 0.09 + (wave + 1) * 0.04;
  });

  return (
    <mesh ref={ref} position={center} geometry={geometries.blast} material={material} />
  );
}

function RegionZoneFrame({ zone }: { readonly zone: ManifestZone }): React.JSX.Element {
  const sizeKey = zone.size.join(",");
  const segments = useMemo(() => {
    const box = new THREE.BoxGeometry(zone.size[0], zone.size[1], zone.size[2]);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeKey]);

  useEffect(
    () => () => {
      segments.geometry.dispose();
      (segments.material as THREE.Material).dispose();
    },
    [segments]
  );
  useEffect(() => {
    (segments.material as THREE.LineBasicMaterial).color.set(zone.color);
  }, [zone.color, segments]);

  return <primitive object={segments} position={zone.center} />;
}

// ---------------------------------------------------------------------------
// FPS probe: writes to a DOM node directly (no React re-render per frame)
// ---------------------------------------------------------------------------

function FpsProbe({
  target,
}: {
  readonly target: React.RefObject<HTMLSpanElement | null>;
}): null {
  const acc = useRef({ frames: 0, time: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.time += delta;
    if (a.time >= 0.5) {
      const el = target.current;
      if (el) el.textContent = `${(a.frames / a.time).toFixed(1)} FPS`;
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export interface SpatialSceneCanvasProps {
  readonly manifest: SceneManifestSnapshot;
  /** Live service statuses from the state store: remediation actions recolor nodes instantly. */
  readonly liveStatusById: Readonly<Record<string, string>>;
  readonly selectedServiceId: string | undefined;
  readonly onSelectService: (serviceId: string) => void;
  readonly cameraFov: number;
  readonly enableOrbitControls: boolean;
  readonly enableGrid: boolean;
  readonly ambientIntensity: number;
}

function SceneContents({
  manifest,
  liveStatusById,
  selectedServiceId,
  onSelectService,
  enableOrbitControls,
  enableGrid,
  ambientIntensity,
  fpsTarget,
}: Omit<SpatialSceneCanvasProps, "cameraFov"> & {
  readonly fpsTarget: React.RefObject<HTMLSpanElement | null>;
}): React.JSX.Element {
  const geometries = useMemo(createSharedGeometries, []);
  const selectionMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#22D3EE" }),
    []
  );
  useEffect(
    () => () => {
      for (const g of Object.values(geometries)) g.dispose();
      selectionMaterial.dispose();
    },
    [geometries, selectionMaterial]
  );

  const nodes = useMemo(
    () =>
      manifest.nodes.map((n) => ({
        ...n,
        position: clampVec3(n.position),
        status: liveStatusById[n.serviceId] ?? n.status,
      })),
    [manifest.nodes, liveStatusById]
  );
  const positionById = useMemo(() => {
    const map = new Map<string, Vec3>();
    for (const n of nodes) map.set(n.serviceId, n.position);
    return map;
  }, [nodes]);

  return (
    <>
      <color attach="background" args={["#04060E"]} />
      <fog attach="fog" args={["#04060E", 12, 30]} />
      <ambientLight intensity={ambientIntensity} />
      <pointLight position={[6, 8, 6]} intensity={60} />
      <directionalLight position={[-6, 4, -4]} intensity={0.6} />
      {enableGrid && (
        <gridHelper args={[24, 24, "#1E293B", "#0F172A"]} position={[0, -3, 0]} />
      )}

      {manifest.zones.map((z) => (
        <RegionZoneFrame
          key={z.key}
          zone={{ ...z, center: clampVec3(z.center), color: safeHexColor(z.color) }}
        />
      ))}
      {manifest.blasts.map((b) => (
        <BlastRadiusVolume
          key={b.key}
          blast={b}
          center={positionById.get(b.targetServiceId) ?? [0, 0, 0]}
          geometries={geometries}
        />
      ))}
      {manifest.edges.map((e) => {
        const from = positionById.get(e.from);
        const to = positionById.get(e.to);
        // Edges whose endpoints are not on the canvas are skipped rather than drawn to the origin.
        if (!from || !to) return null;
        return (
          <TrafficEdgeLine key={e.key} edge={e} from={from} to={to} geometries={geometries} />
        );
      })}
      {nodes.map((n) => (
        <ServiceNodeMesh
          key={n.key}
          node={n}
          geometries={geometries}
          selectionMaterial={selectionMaterial}
          selected={n.serviceId === selectedServiceId}
          onSelect={onSelectService}
        />
      ))}

      {enableOrbitControls && (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={22}
        />
      )}
      <FpsProbe target={fpsTarget} />
    </>
  );
}

export function SpatialSceneCanvas(props: SpatialSceneCanvasProps): React.JSX.Element {
  const fpsRef = useRef<HTMLSpanElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden
  );
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    el.addEventListener("webglcontextlost", onLost);
    el.addEventListener("webglcontextrestored", onRestored);
    return () => {
      el.removeEventListener("webglcontextlost", onLost);
      el.removeEventListener("webglcontextrestored", onRestored);
    };
  });

  const { cameraFov, ...sceneProps } = props;

  return (
    <div className="absolute inset-0" data-testid="spatial-webgl-viewport">
      <Canvas
        frameloop={hidden ? "never" : "always"}
        dpr={[1, 1.75]}
        camera={{ position: [7, 5, 9], fov: cameraFov, near: 0.1, far: 80 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          canvasElRef.current = gl.domElement;
        }}
        onPointerMissed={() => {
          document.body.style.cursor = "";
        }}
      >
        <SceneContents {...sceneProps} fpsTarget={fpsRef} />
      </Canvas>

      <span
        ref={fpsRef}
        data-testid="spatial-fps-meter"
        className="pointer-events-none absolute bottom-2 right-2 rounded border border-slate-800 bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] text-emerald-300"
      >
        {hidden ? "PAUSED (tab hidden)" : "— FPS"}
      </span>

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85">
          <div className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-3 font-mono text-xs text-amber-200">
            WebGL context lost: 3D viewport suspended. The 2D HUD and state store remain live.
          </div>
        </div>
      )}
    </div>
  );
}
