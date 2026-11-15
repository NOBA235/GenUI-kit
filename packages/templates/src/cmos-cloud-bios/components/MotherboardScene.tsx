import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getCmosStore, getCmosUiStore, type BoardPart } from "./cmos-store.js";

/* ═══════════════════════════ Layout (board units ≈ 1 cm) ═══════════════════════════ */

const BOARD_W = 24.4;
const BOARD_D = 30.5;
const PCB_TOP = 0.08;

export const PART_ANCHORS: Readonly<Record<BoardPart, readonly [number, number, number]>> = {
  overview: [0, 0, 0],
  cpu: [-2.5, 1.2, -8],
  ram: [6.5, 0.8, -8],
  vrm: [-8.5, 0.6, -8],
  nvme: [1.5, 0.3, 2.5],
  cache: [6.5, 0.3, 2.5],
  pcie: [-2, 1.5, 8.5],
  battery: [8.5, 0.3, 9.5],
};

const CAMERA_OFFSETS: Readonly<Record<BoardPart, readonly [number, number, number]>> = {
  overview: [0, 26, 22],
  cpu: [-2, 11, 4],
  ram: [10, 9, -1],
  vrm: [-12, 8, -2],
  nvme: [4, 8, 10],
  cache: [10, 7, 10],
  pcie: [-2, 10, 18],
  battery: [12, 6, 15],
};

// Module-level scratch objects: useFrame never allocates.
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _lookCurrent = new THREE.Vector3();
const _color = new THREE.Color();
const _cool = new THREE.Color("#00AAAA");
const _amber = new THREE.Color("#FFAA00");
const _hot = new THREE.Color("#AA0000");
const _matrix = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* ═══════════════════════════ Shared resources ═══════════════════════════ */

function useBoardResources() {
  const resources = useMemo(() => {
    const geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cap: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
      fin: new THREE.BoxGeometry(0.12, 1, 4.6),
      blade: new THREE.BoxGeometry(1.7, 0.05, 0.5),
      disc: new THREE.CylinderGeometry(1, 1, 0.3, 32),
    };
    const materials = {
      pcb: new THREE.MeshStandardMaterial({ color: "#0b3d2a", roughness: 0.62, metalness: 0.15 }),
      silk: new THREE.MeshStandardMaterial({ color: "#14583d", roughness: 0.8 }),
      obsidian: new THREE.MeshStandardMaterial({ color: "#0b0d12", roughness: 0.4, metalness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: "#a8b0bd", roughness: 0.3, metalness: 0.9 }),
      heatsink: new THREE.MeshStandardMaterial({ color: "#8f9aa8", roughness: 0.35, metalness: 0.85, emissive: "#000000" }),
      cap: new THREE.MeshStandardMaterial({ color: "#1d2433", roughness: 0.5, metalness: 0.4 }),
      choke: new THREE.MeshStandardMaterial({ color: "#2b2f36", roughness: 0.7 }),
      dimm: new THREE.MeshStandardMaterial({ color: "#0f5132", roughness: 0.55, emissive: "#00AAAA", emissiveIntensity: 0.25 }),
      chip: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.45 }),
      nvme: new THREE.MeshStandardMaterial({ color: "#14161c", roughness: 0.35, metalness: 0.5 }),
      led: new THREE.MeshStandardMaterial({ color: "#10B981", emissive: "#10B981", emissiveIntensity: 2 }),
      card: new THREE.MeshStandardMaterial({ color: "#181b24", roughness: 0.4, metalness: 0.5 }),
      cardEdge: new THREE.MeshStandardMaterial({ color: "#c8a14a", roughness: 0.3, metalness: 0.9 }),
      gpuGlow: new THREE.MeshStandardMaterial({ color: "#0000AA", emissive: "#0000AA", emissiveIntensity: 1.2 }),
      battery: new THREE.MeshStandardMaterial({ color: "#c9ced6", roughness: 0.25, metalness: 0.95 }),
      highlight: new THREE.MeshBasicMaterial({ color: "#FFFF55", transparent: true, opacity: 0.18, depthWrite: false }),
    };
    return { geometries, materials };
  }, []);

  useEffect(
    () => () => {
      for (const g of Object.values(resources.geometries)) g.dispose();
      for (const m of Object.values(resources.materials)) m.dispose();
    },
    [resources],
  );
  return resources;
}

/** Instanced field of identical parts (capacitors, chokes, DIMM chips, pins). */
const InstancedParts: React.FC<{
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly transforms: ReadonlyArray<readonly [number, number, number, number, number, number]>;
}> = ({ geometry, material, transforms }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    transforms.forEach(([x, y, z, sx, sy, sz], i) => {
      _pos.set(x, y, z);
      _quat.identity();
      _scale.set(sx, sy, sz);
      _matrix.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms]);
  return <instancedMesh ref={ref} args={[geometry, material, transforms.length]} castShadow={false} receiveShadow={false} />;
};

/* ═══════════════════════════ Scene ═══════════════════════════ */

export const MotherboardScene: React.FC = () => {
  const { geometries: g, materials: m } = useBoardResources();
  const camera = useThree((s) => s.camera);
  const fanRef = useRef<THREE.Group>(null);
  const ledRef = useRef<THREE.Mesh>(null);
  const highlightRef = useRef<THREE.Mesh>(null);
  const cardRefs = useRef<Array<THREE.Group | null>>([]);
  const ledPhase = useRef(0);

  const capacitors = useMemo(() => {
    const list: Array<readonly [number, number, number, number, number, number]> = [];
    for (let i = 0; i < 18; i++) list.push([-9.6 + (i % 6) * 0.75, PCB_TOP + 0.45, -12 + Math.floor(i / 6) * 0.9, 0.55, 0.9, 0.55]);
    for (let i = 0; i < 10; i++) list.push([-6 + pseudo(i) * 14, PCB_TOP + 0.3, -1 + pseudo(i + 40) * 3, 0.42, 0.6, 0.42]);
    return list;
  }, []);
  const chokes = useMemo(() => Array.from({ length: 8 }, (_, i) => [-9 + (i % 4) * 1.2, PCB_TOP + 0.35, -5.6 + Math.floor(i / 4) * 1.3, 1, 0.7, 1] as const), []);
  const fins = useMemo(() => Array.from({ length: 22 }, (_, i) => [-5 + i * 0.27, 1.2, -8, 1, 1.6, 1] as const), []);
  const dimmChips = useMemo(() => {
    const list: Array<readonly [number, number, number, number, number, number]> = [];
    for (let s = 0; s < 4; s++) for (let c = 0; c < 8; c++) list.push([4.8 + s * 1.1, 1.05 + 0.05, -12.6 + c * 1.15, 0.12, 0.9, 0.9]);
    return list;
  }, []);
  const traces = useMemo(
    () => Array.from({ length: 40 }, (_, i) => [-11 + pseudo(i + 7) * 22, PCB_TOP + 0.005, -14 + pseudo(i + 99) * 28, pseudo(i) > 0.5 ? 6 : 0.06, 0.01, pseudo(i) > 0.5 ? 0.06 : 6] as const),
    [],
  );

  useFrame((state, rawDelta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    const dt = Math.min(rawDelta, 0.05);
    const cmos = getCmosStore().getState();
    const ui = getCmosUiStore().getState();
    const { draft, telemetry } = cmos;
    const core = draft.cpu.fsbMhz * draft.cpu.multiplier;

    // CPU fan: clock speed and fan RPM both raise the spin rate.
    if (fanRef.current) fanRef.current.rotation.y += dt * (core / 40) * (draft.health.fanRpm / 3000);

    // Heatsink glow follows die temperature relative to the warning threshold.
    const heat = Math.min(1, Math.max(0, (telemetry.thermalC - 30) / Math.max(1, draft.health.throttleC - 30)));
    if (heat < 0.6) _color.copy(_cool).lerp(_amber, heat / 0.6);
    else _color.copy(_amber).lerp(_hot, (heat - 0.6) / 0.4);
    m.heatsink.emissive.copy(_color);
    m.heatsink.emissiveIntensity = 0.15 + heat * 1.6;

    // NVMe activity LED blinks faster with database load; dark when no drive.
    ledPhase.current += dt * (2 + 18 * Math.min(1, telemetry.peakUtilization));
    if (ledRef.current) ledRef.current.visible = draft.storage.primaryMaster !== "none" && Math.sin(ledPhase.current * Math.PI) > 0;

    // DIMM glow scales with installed memory.
    m.dimm.emissiveIntensity = 0.1 + (draft.memory.systemRamMb / 128) * 0.9;

    // PCIe cards: show only occupied slots; colour by device.
    draft.bus.slots.forEach((slot, i) => {
      const card = cardRefs.current[i];
      if (card) card.visible = slot.device !== "empty";
    });

    // Camera eases toward the focused part (hover wins over menu focus).
    const part: BoardPart = ui.hoverPart ?? ui.focusPart;
    const anchor = PART_ANCHORS[part];
    const offset = CAMERA_OFFSETS[part];
    _camTarget.set(anchor[0] + offset[0], anchor[1] + offset[1], anchor[2] + offset[2]);
    _lookTarget.set(anchor[0], anchor[1], anchor[2]);
    const ease = 1 - Math.exp(-3.5 * dt);
    camera.position.lerp(_camTarget, ease);
    _lookCurrent.lerp(_lookTarget, ease);
    camera.lookAt(_lookCurrent);

    if (highlightRef.current) {
      highlightRef.current.visible = part !== "overview";
      highlightRef.current.position.set(anchor[0], PCB_TOP + 0.02, anchor[2]);
      (highlightRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.08 * Math.sin(state.clock.elapsedTime * 3);
    }
  });

  return (
    <group>
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 24, 12]} intensity={1.6} />
      <pointLight position={[-2.5, 6, -8]} intensity={18} distance={20} color="#FFFF55" />

      {/* PCB */}
      <mesh geometry={g.box} material={m.pcb} scale={[BOARD_W, 0.16, BOARD_D]} />
      <InstancedParts geometry={g.box} material={m.silk} transforms={traces} />

      {/* CPU socket, heatsink and fan */}
      <mesh geometry={g.box} material={m.obsidian} position={[-2.5, PCB_TOP + 0.15, -8]} scale={[6, 0.3, 6]} />
      <InstancedParts geometry={g.fin} material={m.heatsink} transforms={fins} />
      <group ref={fanRef} position={[-2.5, 2.2, -8]}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <mesh key={i} geometry={g.blade} material={m.obsidian} position={[Math.cos((i / 7) * Math.PI * 2) * 1.1, 0, Math.sin((i / 7) * Math.PI * 2) * 1.1]} rotation={[0.35, -(i / 7) * Math.PI * 2, 0]} />
        ))}
        <mesh geometry={g.disc} material={m.metal} scale={[0.55, 0.6, 0.55]} />
      </group>

      {/* VRM chokes and capacitors */}
      <InstancedParts geometry={g.box} material={m.choke} transforms={chokes} />
      <InstancedParts geometry={g.cap} material={m.cap} transforms={capacitors} />

      {/* DDR slots + DIMMs */}
      {[0, 1, 2, 3].map((s) => (
        <mesh key={s} geometry={g.box} material={m.dimm} position={[4.8 + s * 1.1, 0.6, -8.6]} scale={[0.22, 1, 9.6]} />
      ))}
      <InstancedParts geometry={g.box} material={m.chip} transforms={dimmChips} />

      {/* M.2 NVMe + activity LED, and the Redis "cache" module */}
      <mesh geometry={g.box} material={m.nvme} position={[1.5, PCB_TOP + 0.12, 2.5]} scale={[8, 0.12, 2.2]} />
      <mesh ref={ledRef} geometry={g.box} material={m.led} position={[-2.2, PCB_TOP + 0.24, 2.5]} scale={[0.3, 0.12, 0.3]} />
      <mesh geometry={g.box} material={m.nvme} position={[6.5, PCB_TOP + 0.12, 2.5]} scale={[2.2, 0.12, 2.2]} />

      {/* PCIe slots + expansion cards */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <mesh geometry={g.box} material={m.obsidian} position={[-2, PCB_TOP + 0.2, 6 + i * 1.7]} scale={[14, 0.4, 0.35]} />
          <group ref={(el) => { cardRefs.current[i] = el; }} position={[-2, PCB_TOP + 1.7, 6 + i * 1.7]}>
            <mesh geometry={g.box} material={m.card} scale={[13, 2.8, 0.18]} />
            <mesh geometry={g.box} material={m.gpuGlow} position={[0, 1.2, 0.1]} scale={[12, 0.12, 0.05]} />
            <mesh geometry={g.box} material={m.cardEdge} position={[0, -1.45, 0]} scale={[8, 0.12, 0.2]} />
          </group>
        </group>
      ))}

      {/* CMOS battery */}
      <mesh geometry={g.disc} material={m.battery} position={[8.5, PCB_TOP + 0.2, 9.5]} scale={[1.1, 1, 1.1]} />

      {/* Focus highlight ring */}
      <mesh ref={highlightRef} geometry={g.disc} material={m.highlight} scale={[4, 0.05, 4]} />
    </group>
  );
};
