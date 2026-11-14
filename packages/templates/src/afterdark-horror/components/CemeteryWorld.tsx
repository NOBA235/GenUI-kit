import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getAfterdarkSoundscape } from "../audio/soundscape.js";
import {
  buildCircleColliders,
  DEAD_GARDEN_FOUNTAIN,
  DEAD_TREE_LAYOUT,
  GATE_DOOR_COLLIDER,
  LANTERN_SPECS,
  STATIC_AABB_COLLIDERS,
  TOMBSTONE_LAYOUT,
} from "../engine/collision.js";
import {
  createAfterdarkSharedGeometries,
  disposeAfterdarkSharedGeometries,
} from "../engine/procedural-geometries.js";
import { getQualityBudget, useAfterdarkStore } from "../store.js";
import { EncounterEntities } from "./EncounterEntities.js";
import { FirstPersonController } from "./FirstPersonController.js";

// Module-level reusable scratch instances (ZERO allocations inside useFrame)
const _dummyObj = new THREE.Object3D();
const _darkSkyColor = new THREE.Color("#010205");
const _cryptSkyColor = new THREE.Color("#010103");
const _flashSkyColor = new THREE.Color("#2a3752");
const _lightModeSkyColor = new THREE.Color("#cbd5e1");
const _tempFogColor = new THREE.Color("#010205");
const _warmFlameColor = new THREE.Color("#ff9436");
const _gardenMistColor = new THREE.Color("#7da4d4");
const _breakerStandbyColor = new THREE.Color("#d97706");

const PERIMETER_PICKET_SEGMENTS = (() => {
  const coords: Array<[number, number]> = [];
  // North wall pickets split around Gothic Chapel (-8.6..+8.6)
  for (let x = -35; x <= -9.0; x += 0.9) coords.push([x, -44.0]);
  for (let x = 9.0; x <= 35; x += 0.9) coords.push([x, -44.0]);
  // West & East wall pickets
  for (let z = -43; z <= 28.5; z += 0.95) {
    coords.push([-36.0, z]);
    coords.push([36.0, z]);
  }
  // South boundary pickets outside gate pillars
  for (let x = -35; x <= -4.0; x += 0.9) coords.push([x, 29.0]);
  for (let x = 4.0; x <= 35; x += 0.9) coords.push([x, 29.0]);
  return coords;
})();

interface SharedMaterials {
  readonly stoneMat: THREE.MeshStandardMaterial;
  readonly darkIronMat: THREE.MeshStandardMaterial;
  readonly barkMat: THREE.MeshStandardMaterial;
  readonly pavingMat: THREE.MeshStandardMaterial;
  readonly turfMat: THREE.MeshStandardMaterial;
  readonly woodMat: THREE.MeshStandardMaterial;
  readonly marbleAltarMat: THREE.MeshStandardMaterial;
  readonly lanternGlowMat: THREE.MeshStandardMaterial;
  readonly stainedGlassMat: THREE.MeshStandardMaterial;
  readonly emberWaxMat: THREE.MeshStandardMaterial;
  readonly wireWallMat: THREE.MeshBasicMaterial;
  readonly wireGateLockedMat: THREE.MeshBasicMaterial;
  readonly wireCircleMat: THREE.MeshBasicMaterial;
}

function createSharedMaterials(): SharedMaterials {
  return {
    stoneMat: new THREE.MeshStandardMaterial({
      color: "#3b424c",
      roughness: 0.92,
      metalness: 0.08,
    }),
    darkIronMat: new THREE.MeshStandardMaterial({
      color: "#1a1d24",
      roughness: 0.48,
      metalness: 0.78,
    }),
    barkMat: new THREE.MeshStandardMaterial({
      color: "#221e1c",
      roughness: 0.96,
      metalness: 0.04,
    }),
    pavingMat: new THREE.MeshStandardMaterial({
      color: "#1e222a",
      roughness: 0.88,
      metalness: 0.1,
    }),
    turfMat: new THREE.MeshStandardMaterial({
      color: "#090c11",
      roughness: 0.98,
      metalness: 0.02,
    }),
    woodMat: new THREE.MeshStandardMaterial({
      color: "#281c15",
      roughness: 0.91,
      metalness: 0.05,
    }),
    marbleAltarMat: new THREE.MeshStandardMaterial({
      color: "#525866",
      roughness: 0.65,
      metalness: 0.12,
    }),
    lanternGlowMat: new THREE.MeshStandardMaterial({
      color: "#ffbe76",
      emissive: "#ff7f24",
      emissiveIntensity: 2.8,
      roughness: 0.3,
    }),
    stainedGlassMat: new THREE.MeshStandardMaterial({
      color: "#451a2e",
      emissive: "#9f1239",
      emissiveIntensity: 1.85,
      roughness: 0.25,
    }),
    emberWaxMat: new THREE.MeshStandardMaterial({
      color: "#fde68a",
      emissive: "#f97316",
      emissiveIntensity: 2.2,
      roughness: 0.35,
    }),
    wireWallMat: new THREE.MeshBasicMaterial({
      color: "#22d3ee",
      wireframe: true,
    }),
    wireGateLockedMat: new THREE.MeshBasicMaterial({
      color: "#ef4444",
      wireframe: true,
    }),
    wireCircleMat: new THREE.MeshBasicMaterial({
      color: "#10b981",
      wireframe: true,
    }),
  };
}

function disposeSharedMaterials(mats: SharedMaterials): void {
  mats.stoneMat.dispose();
  mats.darkIronMat.dispose();
  mats.barkMat.dispose();
  mats.pavingMat.dispose();
  mats.turfMat.dispose();
  mats.woodMat.dispose();
  mats.marbleAltarMat.dispose();
  mats.lanternGlowMat.dispose();
  mats.stainedGlassMat.dispose();
  mats.emberWaxMat.dispose();
  mats.wireWallMat.dispose();
  mats.wireGateLockedMat.dispose();
  mats.wireCircleMat.dispose();
}

const AtmosphereLightningRig: React.FC = () => {
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  const lanternLightRefs = useRef<Array<THREE.PointLight | null>>([]);

  // Deterministic lightning state — capped strictly below 3 flashes/sec (minimum 7.5s cooldown)
  const cooldownRef = useRef(5.5);
  const flashIntensityRef = useRef(0);

  const quality = useAfterdarkStore((s) => s.quality);
  const lightOverride = useAfterdarkStore((s) => s.lightOverride);
  const fogDensity = useAfterdarkStore((s) => s.fogDensity);
  const darknessLevel = useAfterdarkStore((s) => s.darknessLevel);
  const lightningEnabled = useAfterdarkStore((s) => s.lightningEnabled);
  const lightModeRestored = useAfterdarkStore((s) => s.lightModeRestored);
  const externalLightning = useAfterdarkStore((s) => s.lightningIntensity);

  const budget = getQualityBudget(quality);

  useFrame((rootState, rawDelta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    const dt = Math.min(rawDelta, 0.05);
    const store = useAfterdarkStore.getState();
    const phase = store.phase;
    const elapsed = rootState.clock.elapsedTime;
    const [px, py, pz] = store.playerPosition;
    const inCrypt = py < 0.1 || store.currentZone === "crypt_entrance";

    // External trigger from Debug Overlay button
    if (externalLightning > flashIntensityRef.current) {
      flashIntensityRef.current = externalLightning;
      store.setLightningIntensity(0);
    }

    // Periodic atmospheric lightning flash (suppressed visually inside deep subterranean crypt)
    if (
      lightningEnabled &&
      !lightModeRestored &&
      phase !== "shutdown"
    ) {
      cooldownRef.current -= dt;
      if (cooldownRef.current <= 0) {
        cooldownRef.current = 7.5 + (Math.sin(elapsed * 1.7) * 0.5 + 0.5) * 6.0;
        flashIntensityRef.current = inCrypt ? 0.25 : 1.0;
        getAfterdarkSoundscape().playLightningThunder();
      }
    }

    // Smooth single exponential decay
    flashIntensityRef.current = Math.max(0, flashIntensityRef.current - dt * 2.1);

    const flash = flashIntensityRef.current;
    const isShutdownBlack = phase === "shutdown";
    const beaconActive = store.chapelBeaconPulseUntil > Date.now();
    const cryptIntimidation = store.cryptIntimidationActive;

    if (moonRef.current) {
      if (lightModeRestored) {
        moonRef.current.intensity = 1.65;
        moonRef.current.color.set("#fef3c7");
      } else if (lightOverride) {
        moonRef.current.intensity = 1.2;
        moonRef.current.color.set("#b4c6e7");
      } else if (isShutdownBlack) {
        moonRef.current.intensity = 0;
      } else if (inCrypt) {
        // Subterranean depths block moonlight almost completely
        moonRef.current.intensity = 0.06;
      } else {
        moonRef.current.intensity =
          0.34 * (1 - darknessLevel * 0.35) + flash * 3.4;
        moonRef.current.color.set("#8da6d6");
      }
    }

    if (ambientRef.current) {
      if (lightModeRestored) {
        ambientRef.current.intensity = 0.95;
      } else if (lightOverride) {
        ambientRef.current.intensity = 0.72;
      } else if (isShutdownBlack) {
        ambientRef.current.intensity = 0;
      } else if (inCrypt) {
        ambientRef.current.intensity = cryptIntimidation ? 0.035 : 0.055;
      } else {
        ambientRef.current.intensity = 0.075 + flash * 0.42;
      }
    }

    if (fogRef.current) {
      if (lightModeRestored) {
        fogRef.current.density = 0.008;
        fogRef.current.color.copy(_lightModeSkyColor);
      } else if (lightOverride) {
        fogRef.current.density = 0.015;
        fogRef.current.color.copy(_flashSkyColor);
      } else if (inCrypt) {
        fogRef.current.density = fogDensity + (cryptIntimidation ? 0.034 : 0.022);
        fogRef.current.color.copy(_cryptSkyColor);
      } else {
        const gardenBoost = store.currentZone === "dead_garden" ? 0.018 : 0;
        fogRef.current.density = Math.max(
          0.012,
          fogDensity + gardenBoost - flash * 0.022,
        );
        _tempFogColor.lerpColors(_darkSkyColor, _flashSkyColor, flash * 0.85);
        fogRef.current.color.copy(_tempFogColor);
      }
    }

    rootState.scene.background = lightModeRestored
      ? _lightModeSkyColor
      : inCrypt
        ? _cryptSkyColor
        : _tempFogColor;

    // Pooled dynamic point lights re-anchor seamlessly to the player's active zone
    // Strictly obeys hardware cap (1 / 2 / 3 active point lights max) with ZERO allocations
    const count = Math.min(budget.maxDynamicPointLights, 3);
    for (let i = 0; i < count; i++) {
      const l = lanternLightRefs.current[i];
      if (!l) continue;
      if (isShutdownBlack) {
        l.intensity = 0;
        continue;
      }

      if (inCrypt) {
        if (i === 0) l.position.set(3.9, -2.1, -52.5);
        else if (i === 1) l.position.set(-4.2, -2.6, -54.8);
        else l.position.set(-4.0, -3.1, -50.4);
        l.color.copy(i === 2 ? _breakerStandbyColor : _warmFlameColor);
        l.distance = i === 2 ? 11 : 16;
      } else if (pz < -28.0) {
        if (i === 0) l.position.set(0.0, 2.35, -39.6);
        else if (i === 1) l.position.set(3.8, 1.8, -42.5);
        else l.position.set(-11.0, 2.25, -24.2);
        l.color.copy(_warmFlameColor);
        l.distance = 18;
      } else if (pz < 2.0 && px < -7.5) {
        if (i === 0) l.position.set(-12.8, 2.35, -3.8);
        else if (i === 1) l.position.set(-16.0, 2.1, -9.0);
        else l.position.set(-10.0, 2.35, -24.0);
        l.color.copy(i === 1 ? _gardenMistColor : _warmFlameColor);
        l.distance = 16;
      } else {
        const spec = LANTERN_SPECS[i * 2] ?? LANTERN_SPECS[0]!;
        l.position.set(spec.x, 2.35, spec.z);
        l.color.copy(_warmFlameColor);
        l.distance = 17;
      }

      // Safe flicker envelope (< 2.5 Hz primary cycle for crypt intimidation)
      const intimidationMod = cryptIntimidation
        ? 0.45 + 0.55 * (Math.sin(elapsed * 11.5 + i * 1.4) * 0.5 + 0.5)
        : 1.0;
      const beaconBoost = beaconActive && pz < -18 ? 0.85 : 0;
      const wave =
        Math.sin(elapsed * 7.3 + i * 2.1) * 0.14 +
        Math.sin(elapsed * 14.1 + i * 3.7) * 0.07;
      l.intensity = Math.max(0.2, (1.85 + wave + beaconBoost) * intimidationMod);
    }
  });

  const cappedAnchors = [
    LANTERN_SPECS[0]!,
    LANTERN_SPECS[2]!,
    LANTERN_SPECS[5]!,
  ].slice(0, budget.maxDynamicPointLights);

  return (
    <>
      <fogExp2 ref={fogRef} attach="fog" args={["#010205", fogDensity]} />
      <ambientLight ref={ambientRef} intensity={0.07} color="#6d82a8" />
      <directionalLight
        ref={moonRef}
        position={[-18, 32, -24]}
        intensity={0.32}
        color="#8da6d6"
        castShadow={budget.shadowsEnabled}
      />
      {cappedAnchors.map((anchor, idx) => (
        <pointLight
          key={anchor.id}
          ref={(el) => {
            lanternLightRefs.current[idx] = el;
          }}
          position={[anchor.x, 2.35, anchor.z]}
          color="#ff9436"
          intensity={anchor.baseIntensity}
          distance={17}
          decay={1.85}
        />
      ))}
    </>
  );
};

interface CemeteryGeometryProps {
  readonly touchLookDeltaRef: React.MutableRefObject<{ x: number; y: number }>;
}

const CemeterySceneContents: React.FC<CemeteryGeometryProps> = ({
  touchLookDeltaRef,
}) => {
  const quality = useAfterdarkStore((s) => s.quality);
  const gateOpenProgress = useAfterdarkStore((s) => s.gateOpenProgress);
  const gateLockedBehind = useAfterdarkStore((s) => s.gateLockedBehind);
  const debugEnabled = useAfterdarkStore((s) => s.debugEnabled);
  const showCollisionWireframes = useAfterdarkStore(
    (s) => s.showCollisionWireframes,
  );

  const budget = getQualityBudget(quality);
  const sharedGeoms = useMemo(() => createAfterdarkSharedGeometries(), []);
  const mats = useMemo(() => createSharedMaterials(), []);

  useEffect(() => {
    return () => {
      disposeAfterdarkSharedGeometries(sharedGeoms);
      disposeSharedMaterials(mats);
    };
  }, [sharedGeoms, mats]);

  // Pre-build unit wireframe cylinder for debug circle collider viz & dispose cleanly
  const debugCylinderGeo = useMemo(
    () => new THREE.CylinderGeometry(1, 1, 1, 10),
    [],
  );
  useEffect(() => () => debugCylinderGeo.dispose(), [debugCylinderGeo]);

  // Split instanced tombstones by geometry variant
  const lancetTombstones = useMemo(
    () =>
      TOMBSTONE_LAYOUT.slice(0, budget.tombstoneCount).filter(
        (t) => t.variant === "lancet",
      ),
    [budget.tombstoneCount],
  );
  const obeliskTombstones = useMemo(
    () =>
      TOMBSTONE_LAYOUT.slice(0, budget.tombstoneCount).filter(
        (t) => t.variant === "obelisk",
      ),
    [budget.tombstoneCount],
  );
  const celticTombstones = useMemo(
    () =>
      TOMBSTONE_LAYOUT.slice(0, budget.tombstoneCount)
        .filter((t) => t.variant === "celtic")
        .slice(0, budget.celticCrossCount),
    [budget.tombstoneCount, budget.celticCrossCount],
  );
  const visibleTrees = useMemo(
    () => DEAD_TREE_LAYOUT.slice(0, budget.deadTreeCount),
    [budget.deadTreeCount],
  );
  const visiblePickets = useMemo(
    () =>
      PERIMETER_PICKET_SEGMENTS.filter(
        (_, i) => i % budget.picketDensityStep === 0,
      ),
    [budget.picketDensityStep],
  );
  const debugCircleColliders = useMemo(
    () =>
      debugEnabled && showCollisionWireframes
        ? buildCircleColliders(budget.tombstoneCount, budget.deadTreeCount)
        : [],
    [debugEnabled, showCollisionWireframes, budget.tombstoneCount, budget.deadTreeCount],
  );

  const lancetRef = useRef<THREE.InstancedMesh>(null);
  const obeliskRef = useRef<THREE.InstancedMesh>(null);
  const celticRef = useRef<THREE.InstancedMesh>(null);
  const treesRef = useRef<THREE.InstancedMesh>(null);
  const picketsRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (lancetRef.current) {
      lancetTombstones.forEach((t, i) => {
        _dummyObj.position.set(t.x, 0, t.z);
        _dummyObj.rotation.set(t.tiltX, t.rotY, t.tiltZ);
        _dummyObj.scale.set(1, t.scaleY, 1);
        _dummyObj.updateMatrix();
        lancetRef.current!.setMatrixAt(i, _dummyObj.matrix);
      });
      lancetRef.current.instanceMatrix.needsUpdate = true;
    }

    if (obeliskRef.current) {
      obeliskTombstones.forEach((t, i) => {
        _dummyObj.position.set(t.x, 0, t.z);
        _dummyObj.rotation.set(t.tiltX * 0.6, t.rotY, t.tiltZ * 0.6);
        _dummyObj.scale.set(1, t.scaleY, 1);
        _dummyObj.updateMatrix();
        obeliskRef.current!.setMatrixAt(i, _dummyObj.matrix);
      });
      obeliskRef.current.instanceMatrix.needsUpdate = true;
    }

    if (celticRef.current) {
      celticTombstones.forEach((t, i) => {
        _dummyObj.position.set(t.x, 0, t.z);
        _dummyObj.rotation.set(t.tiltX * 0.45, t.rotY, t.tiltZ * 0.45);
        _dummyObj.scale.set(1, t.scaleY, 1);
        _dummyObj.updateMatrix();
        celticRef.current!.setMatrixAt(i, _dummyObj.matrix);
      });
      celticRef.current.instanceMatrix.needsUpdate = true;
    }

    if (treesRef.current) {
      visibleTrees.forEach((tr, i) => {
        _dummyObj.position.set(tr.x, 0, tr.z);
        _dummyObj.rotation.set(0, tr.rotY, 0);
        _dummyObj.scale.set(tr.scale, tr.scale, tr.scale);
        _dummyObj.updateMatrix();
        treesRef.current!.setMatrixAt(i, _dummyObj.matrix);
      });
      treesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (picketsRef.current) {
      visiblePickets.forEach(([px, pz], i) => {
        _dummyObj.position.set(px, 1.35, pz);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(1, 0.78, 1);
        _dummyObj.updateMatrix();
        picketsRef.current!.setMatrixAt(i, _dummyObj.matrix);
      });
      picketsRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [
    lancetTombstones,
    obeliskTombstones,
    celticTombstones,
    visibleTrees,
    visiblePickets,
  ]);

  const leftGateRef = useRef<THREE.Group>(null);
  const rightGateRef = useRef<THREE.Group>(null);

  // Smooth hinge rotation aligned with Zustand gateOpenProgress
  useFrame(() => {
    const angle = gateOpenProgress * 1.42;
    if (leftGateRef.current) {
      leftGateRef.current.rotation.y = angle;
    }
    if (rightGateRef.current) {
      rightGateRef.current.rotation.y = -angle;
    }
  });

  return (
    <>
      <AtmosphereLightningRig />
      <FirstPersonController touchLookDeltaRef={touchLookDeltaRef} />
      <EncounterEntities silhouetteGeometry={sharedGeoms.apparitionSilhouette} />

      {/* Ground Terrain & Central Flagstone Path */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -4]}
        material={mats.turfMat}
        receiveShadow={budget.shadowsEnabled}
      >
        <planeGeometry args={[120, 120]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 2]}
        material={mats.pavingMat}
        receiveShadow={budget.shadowsEnabled}
      >
        <planeGeometry args={[4.6, 76]} />
      </mesh>
      {/* Zone C Dead Garden Flagstone Connector & Concealed North Path */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-9.5, 0.016, -2.5]}
        material={mats.pavingMat}
      >
        <planeGeometry args={[14.5, 3.2]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-16.0, 0.017, -9.0]}
        material={mats.pavingMat}
      >
        <circleGeometry args={[6.4, 24]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-13.5, 0.016, -18.5]}
        rotation-z={-0.28}
        material={mats.pavingMat}
      >
        <planeGeometry args={[2.6, 15.0]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-5.5, 0.016, -24.5]}
        material={mats.pavingMat}
      >
        <planeGeometry args={[12.0, 2.4]} />
      </mesh>
      {/* East Mausoleum Courtyard Stone Apron */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[13.5, 0.016, -14.0]}
        material={mats.pavingMat}
      >
        <planeGeometry args={[11, 8.5]} />
      </mesh>

      {/* Perimeter Low Stone Masonry Walls (North split around Chapel & Crypt Vault) */}
      <mesh position={[-22.3, 0.75, -44.0]} material={mats.stoneMat}>
        <boxGeometry args={[28.4, 1.5, 1.1]} />
      </mesh>
      <mesh position={[22.3, 0.75, -44.0]} material={mats.stoneMat}>
        <boxGeometry args={[28.4, 1.5, 1.1]} />
      </mesh>
      <mesh position={[-36.0, 0.75, -7.2]} material={mats.stoneMat}>
        <boxGeometry args={[1.1, 1.5, 74.0]} />
      </mesh>
      <mesh position={[36.0, 0.75, -7.2]} material={mats.stoneMat}>
        <boxGeometry args={[1.1, 1.5, 74.0]} />
      </mesh>
      <mesh position={[-19.8, 0.75, 29.0]} material={mats.stoneMat}>
        <boxGeometry args={[33.0, 1.5, 1.1]} />
      </mesh>
      <mesh position={[19.8, 0.75, 29.0]} material={mats.stoneMat}>
        <boxGeometry args={[33.0, 1.5, 1.1]} />
      </mesh>

      {/* Scene 02 Gatehouse Stone Pillars & Overhead Arch */}
      {([-3.0, 3.0] as const).map((px) => (
        <group key={`pillar-${px}`} position={[px, 0, 29.0]}>
          <mesh position={[0, 2.1, 0]} material={mats.stoneMat}>
            <boxGeometry args={[1.15, 4.2, 1.4]} />
          </mesh>
          <mesh position={[0, 4.45, 0]} material={mats.stoneMat}>
            <coneGeometry args={[0.85, 0.9, 4]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 4.35, 29.0]} material={mats.darkIronMat}>
        <boxGeometry args={[6.4, 0.28, 0.45]} />
      </mesh>

      {/* Articulated Wrought-Iron Entrance Gate Leaves */}
      <group ref={leftGateRef} position={[-2.42, 0, 29.0]}>
        <mesh position={[1.2, 1.7, 0]} material={mats.darkIronMat}>
          <boxGeometry args={[2.38, 0.12, 0.12]} />
        </mesh>
        <mesh position={[1.2, 0.45, 0]} material={mats.darkIronMat}>
          <boxGeometry args={[2.38, 0.12, 0.12]} />
        </mesh>
        <mesh position={[1.2, 2.95, 0]} material={mats.darkIronMat}>
          <boxGeometry args={[2.38, 0.12, 0.12]} />
        </mesh>
        {[0.25, 0.65, 1.05, 1.45, 1.85, 2.22].map((bx) => (
          <mesh
            key={`lbar-${bx}`}
            position={[bx, 0.35, 0]}
            geometry={sharedGeoms.fencePicket}
            material={mats.darkIronMat}
          />
        ))}
      </group>

      <group ref={rightGateRef} position={[2.42, 0, 29.0]}>
        <mesh position={[-1.2, 1.7, 0]} material={mats.darkIronMat}>
          <boxGeometry args={[2.38, 0.12, 0.12]} />
        </mesh>
        <mesh position={[-1.2, 0.45, 0]} material={mats.darkIronMat}>
          <boxGeometry args={[2.38, 0.12, 0.12]} />
        </mesh>
        <mesh position={[-1.2, 2.95, 0]} material={mats.darkIronMat}>
          <boxGeometry args={[2.38, 0.12, 0.12]} />
        </mesh>
        {[-0.25, -0.65, -1.05, -1.45, -1.85, -2.22].map((bx) => (
          <mesh
            key={`rbar-${bx}`}
            position={[bx, 0.35, 0]}
            geometry={sharedGeoms.fencePicket}
            material={mats.darkIronMat}
          />
        ))}
      </group>

      {/* Instanced Perimeter Pickets, Tombstones (Lancet / Obelisk / Celtic Crosses) & Dead Trees */}
      <instancedMesh
        ref={picketsRef}
        args={[sharedGeoms.fencePicket, mats.darkIronMat, visiblePickets.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={lancetRef}
        args={[sharedGeoms.lancetTombstone, mats.stoneMat, lancetTombstones.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={obeliskRef}
        args={[sharedGeoms.obeliskTombstone, mats.stoneMat, obeliskTombstones.length]}
        frustumCulled={false}
      />
      {celticTombstones.length > 0 && (
        <instancedMesh
          ref={celticRef}
          args={[sharedGeoms.celticCross, mats.stoneMat, celticTombstones.length]}
          frustumCulled={false}
        />
      )}
      <instancedMesh
        ref={treesRef}
        args={[sharedGeoms.gnarledTree, mats.barkMat, visibleTrees.length]}
        frustumCulled={false}
      />

      {/* Zone B Clue 01 Monument: Engraved Weathered Tombstone [-7.2, 0, 12.2] */}
      <group position={[-7.2, 0, 12.2]} rotation={[0.04, 0.28, -0.02]}>
        <mesh position={[0, 0.25, 0]} material={mats.stoneMat}>
          <boxGeometry args={[1.15, 0.5, 0.9]} />
        </mesh>
        <mesh position={[0, 1.15, 0]} material={mats.marbleAltarMat}>
          <boxGeometry args={[0.88, 1.45, 0.28]} />
        </mesh>
        <mesh position={[0, 1.25, 0.15]} material={mats.emberWaxMat}>
          <boxGeometry args={[0.46, 0.18, 0.03]} />
        </mesh>
      </group>

      {/* Zone C Dead Garden: Crumbling Fountain, Benches, Weeping Statues & Concealed Lectern */}
      <group position={[DEAD_GARDEN_FOUNTAIN.x, 0, DEAD_GARDEN_FOUNTAIN.z]}>
        <mesh
          position={[0, 0.02, 0]}
          geometry={sharedGeoms.fountainBasin}
          material={mats.stoneMat}
        />
        <mesh position={[0, 1.9, 0]} material={mats.marbleAltarMat}>
          <cylinderGeometry args={[0.24, 0.34, 1.15, 10]} />
        </mesh>
        {/* Two Weeping Statues flanking the fountain */}
        {([-4.6, 4.6] as const).map((sx) => (
          <group key={`weeping-${sx}`} position={[sx, 0, -4.4]}>
            <mesh position={[0, 0.45, 0]} material={mats.stoneMat}>
              <boxGeometry args={[0.85, 0.9, 0.85]} />
            </mesh>
            <mesh
              position={[0, 0.9, 0]}
              scale={[0.85, 0.9, 0.85]}
              geometry={sharedGeoms.apparitionSilhouette}
              material={mats.marbleAltarMat}
            />
          </group>
        ))}
      </group>
      {/* Dead Garden Stone Benches */}
      <mesh position={[-16.0, 0.38, -13.2]} material={mats.stoneMat}>
        <boxGeometry args={[2.5, 0.72, 0.88]} />
      </mesh>
      <mesh position={[-16.0, 0.38, -4.8]} material={mats.stoneMat}>
        <boxGeometry args={[2.5, 0.72, 0.88]} />
      </mesh>
      <mesh position={[-20.3, 0.38, -9.0]} material={mats.stoneMat}>
        <boxGeometry args={[0.88, 0.72, 2.5]} />
      </mesh>
      {/* Ruined Garden Low Parapets */}
      <mesh position={[-24.65, 0.75, -9.75]} material={mats.stoneMat}>
        <boxGeometry args={[1.0, 1.5, 13.5]} />
      </mesh>
      <mesh position={[-21.0, 0.75, -16.95]} material={mats.stoneMat}>
        <boxGeometry args={[7.0, 1.5, 1.0]} />
      </mesh>

      {/* Clue 03 Caretaker's Lectern in Concealed Passage [-11.2, 0, -24.5] */}
      <group position={[-11.2, 0, -24.5]} rotation={[0, 0.35, 0]}>
        <mesh position={[0, 0.52, 0]} material={mats.stoneMat}>
          <boxGeometry args={[0.92, 1.04, 0.82]} />
        </mesh>
        <mesh position={[0, 1.08, 0.08]} rotation={[-0.28, 0, 0]} material={mats.woodMat}>
          <boxGeometry args={[0.68, 0.08, 0.5]} />
        </mesh>
        <mesh position={[0, 1.15, 0.08]} rotation={[-0.28, 0, 0]} material={mats.emberWaxMat}>
          <boxGeometry args={[0.42, 0.03, 0.3]} />
        </mesh>
      </group>

      {/* Antique Iron Path Lantern Posts */}
      {LANTERN_SPECS.map((l) => (
        <group key={l.id} position={[l.x, 0, l.z]}>
          <mesh position={[0, 1.15, 0]} material={mats.darkIronMat}>
            <cylinderGeometry args={[0.06, 0.12, 2.3, 8]} />
          </mesh>
          <mesh position={[0, 2.38, 0]} material={mats.lanternGlowMat}>
            <boxGeometry args={[0.24, 0.34, 0.24]} />
          </mesh>
          <mesh position={[0, 2.65, 0]} material={mats.darkIronMat}>
            <coneGeometry args={[0.28, 0.24, 4]} />
          </mesh>
        </group>
      ))}

      {/* East Mausoleum Crypt Portico Architecture */}
      <group position={[17.5, 0, -14.0]}>
        <mesh position={[0, 2.3, -3.2]} material={mats.stoneMat}>
          <boxGeometry args={[8.8, 4.6, 2.0]} />
        </mesh>
        <mesh position={[0, 2.3, 3.2]} material={mats.stoneMat}>
          <boxGeometry args={[8.8, 4.6, 2.0]} />
        </mesh>
        <mesh position={[3.6, 2.3, 0]} material={mats.stoneMat}>
          <boxGeometry args={[1.6, 4.6, 8.8]} />
        </mesh>
        <mesh position={[0, 4.9, 0]} material={mats.stoneMat}>
          <boxGeometry args={[9.4, 0.7, 9.2]} />
        </mesh>
        <mesh position={[-3.8, 2.1, -1.9]} material={mats.stoneMat}>
          <cylinderGeometry args={[0.32, 0.38, 4.2, 10]} />
        </mesh>
        <mesh position={[-3.8, 2.1, 1.9]} material={mats.stoneMat}>
          <cylinderGeometry args={[0.32, 0.38, 4.2, 10]} />
        </mesh>
      </group>

      {/* Zone D — Enterable Abandoned Gothic Chapel (x in [-8.2..8.2], z in [-44.3..-33.7]) */}
      <group>
        {/* Approach Steps & Timber Sanctuary Floorboards */}
        <mesh position={[0, 0.14, -32.8]} material={mats.stoneMat}>
          <boxGeometry args={[6.4, 0.28, 2.4]} />
        </mesh>
        <mesh position={[0, 0.15, -39.0]} material={mats.woodMat}>
          <boxGeometry args={[14.4, 0.3, 9.6]} />
        </mesh>

        {/* Split Front Facade with Open Double Doorway (x in [-1.75..1.75], z = -34.2) */}
        <mesh position={[-4.98, 4.8, -34.2]} material={mats.stoneMat}>
          <boxGeometry args={[6.45, 9.6, 1.0]} />
        </mesh>
        <mesh position={[4.98, 4.8, -34.2]} material={mats.stoneMat}>
          <boxGeometry args={[6.45, 9.6, 1.0]} />
        </mesh>
        <mesh position={[0, 6.9, -34.2]} material={mats.stoneMat}>
          <boxGeometry args={[3.6, 5.4, 1.0]} />
        </mesh>
        {/* Heavy Ajar Oak Doors */}
        <mesh position={[-2.05, 1.95, -34.9]} rotation={[0, 1.05, 0]} material={mats.woodMat}>
          <boxGeometry args={[1.65, 3.6, 0.14]} />
        </mesh>
        <mesh position={[2.05, 1.95, -34.9]} rotation={[0, -0.92, 0]} material={mats.woodMat}>
          <boxGeometry args={[1.65, 3.6, 0.14]} />
        </mesh>

        {/* West & East Chapel Side Walls + Broken Lancet Stained-Glass Windows */}
        <mesh position={[-7.65, 4.8, -39.0]} material={mats.stoneMat}>
          <boxGeometry args={[1.1, 9.6, 10.6]} />
        </mesh>
        <mesh position={[7.65, 4.8, -39.0]} material={mats.stoneMat}>
          <boxGeometry args={[1.1, 9.6, 10.6]} />
        </mesh>
        {([-36.8, -41.2] as const).map((wz) => (
          <React.Fragment key={`win-${wz}`}>
            <mesh position={[-7.08, 3.5, wz]} material={mats.stainedGlassMat}>
              <boxGeometry args={[0.1, 2.7, 1.1]} />
            </mesh>
            <mesh position={[7.08, 3.5, wz]} material={mats.stainedGlassMat}>
              <boxGeometry args={[0.1, 2.7, 1.1]} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Split Back Sanctuary Wall Leaving Open East Stairwell Aperture (x in [2.45..5.55]) */}
        <mesh position={[-2.85, 4.8, -43.75]} material={mats.stoneMat}>
          <boxGeometry args={[10.7, 9.6, 1.1]} />
        </mesh>
        <mesh position={[6.9, 4.8, -43.75]} material={mats.stoneMat}>
          <boxGeometry args={[2.6, 9.6, 1.1]} />
        </mesh>
        <mesh position={[4.0, 6.9, -43.75]} material={mats.stoneMat}>
          <boxGeometry args={[3.2, 5.4, 1.1]} />
        </mesh>

        {/* Roof Canopy & Bell Tower Spire (Guides explorer from Spawn across horizon) */}
        <mesh position={[0, 9.9, -39.0]} material={mats.stoneMat}>
          <boxGeometry args={[16.8, 0.7, 10.8]} />
        </mesh>
        <mesh position={[0, 12.2, -39.0]} rotation={[0, Math.PI / 4, 0]} material={mats.stoneMat}>
          <coneGeometry args={[11.6, 5.0, 4]} />
        </mesh>
        <mesh position={[0, 14.5, -36.5]} material={mats.stoneMat}>
          <boxGeometry args={[3.4, 8.8, 3.4]} />
        </mesh>
        <mesh position={[0, 21.4, -36.5]} material={mats.stoneMat}>
          <coneGeometry args={[2.5, 6.2, 4]} />
        </mesh>

        {/* Glowing Front Stained Glass Rose & Lancet Trio (Visible from Zone A) */}
        <mesh position={[0, 6.2, -33.65]} material={mats.stainedGlassMat}>
          <boxGeometry args={[2.1, 3.9, 0.14]} />
        </mesh>
        <mesh position={[-4.8, 4.8, -33.65]} material={mats.stainedGlassMat}>
          <boxGeometry args={[1.0, 2.8, 0.14]} />
        </mesh>
        <mesh position={[4.8, 4.8, -33.65]} material={mats.stainedGlassMat}>
          <boxGeometry args={[1.0, 2.8, 0.14]} />
        </mesh>

        {/* Interior Timber Pews & Clue 02 Marble Altar */}
        <mesh position={[-3.95, 0.72, -38.75]} material={mats.woodMat}>
          <boxGeometry args={[3.2, 0.85, 0.8]} />
        </mesh>
        <mesh position={[-3.95, 0.72, -36.75]} material={mats.woodMat}>
          <boxGeometry args={[3.2, 0.85, 0.8]} />
        </mesh>
        <group position={[0, 0.3, -41.5]}>
          <mesh position={[0, 0.55, 0]} material={mats.marbleAltarMat}>
            <boxGeometry args={[3.2, 1.1, 1.4]} />
          </mesh>
          <mesh position={[0, 1.15, 0.15]} material={mats.emberWaxMat}>
            <boxGeometry args={[0.55, 0.08, 0.38]} />
          </mesh>
          <mesh position={[-1.0, 1.32, -0.25]} material={mats.emberWaxMat}>
            <cylinderGeometry args={[0.05, 0.06, 0.42, 8]} />
          </mesh>
          <mesh position={[1.0, 1.32, -0.25]} material={mats.emberWaxMat}>
            <cylinderGeometry args={[0.05, 0.06, 0.42, 8]} />
          </mesh>
        </group>

        {/* East Chapel Stairwell Enclosing Chute & 16 Stone Steps Descending to Zone E (y: 0.3 -> -4.5) */}
        <mesh position={[2.2, -1.6, -46.2]} material={mats.stoneMat}>
          <boxGeometry args={[0.55, 6.4, 10.6]} />
        </mesh>
        <mesh position={[5.9, -1.6, -49.5]} material={mats.stoneMat}>
          <boxGeometry args={[0.75, 6.4, 17.6]} />
        </mesh>
        {Array.from({ length: 16 }, (_, stepIdx) => {
          const t = (stepIdx + 0.5) / 16;
          const sz = -41.1 - t * 10.0;
          const sy = 0.25 - t * 4.75;
          return (
            <mesh
              key={`crypt-step-${stepIdx}`}
              position={[3.95, sy - 0.18, sz]}
              material={mats.pavingMat}
            >
              <boxGeometry args={[3.1, 0.36, 0.68]} />
            </mesh>
          );
        })}
      </group>

      {/* Zone E — Underground Crypt Vault (y = -4.5, sub-surface corridors & Breaker Alcove) */}
      <group>
        {/* Subterranean Flagstone Floor & Stone Ceiling */}
        <mesh position={[-0.6, -4.65, -54.2]} material={mats.pavingMat}>
          <boxGeometry args={[14.2, 0.3, 10.4]} />
        </mesh>
        <mesh position={[-0.6, -0.55, -54.2]} material={mats.stoneMat}>
          <boxGeometry args={[14.2, 0.4, 10.4]} />
        </mesh>
        {/* North, West, Divider, and Concealed Alcove Walls */}
        <mesh position={[-0.6, -2.6, -58.65]} material={mats.stoneMat}>
          <boxGeometry args={[14.0, 4.1, 1.0]} />
        </mesh>
        <mesh position={[-7.05, -2.6, -54.1]} material={mats.stoneMat}>
          <boxGeometry args={[0.9, 4.1, 10.2]} />
        </mesh>
        <mesh position={[0.55, -2.6, -53.5]} material={mats.stoneMat}>
          <boxGeometry args={[3.9, 4.1, 1.3]} />
        </mesh>
        <mesh position={[-3.95, -2.6, -49.6]} material={mats.stoneMat}>
          <boxGeometry args={[7.0, 4.1, 1.1]} />
        </mesh>
        <mesh position={[-0.85, -2.6, -51.6]} material={mats.stoneMat}>
          <boxGeometry args={[0.9, 4.1, 5.2]} />
        </mesh>

        {/* Stone Arched Ceiling Ribs */}
        {([-52.0, -55.2, -57.6] as const).map((rz) => (
          <mesh key={`crypt-rib-${rz}`} position={[-2.2, -1.05, rz]} material={mats.stoneMat}>
            <boxGeometry args={[9.6, 0.55, 0.55]} />
          </mesh>
        ))}

        {/* Two Carved Stone Sarcophagi */}
        {([
          [-4.2, -4.5, -55.4],
          [0.85, -4.5, -57.2],
        ] as const).map(([sx, sy, sz], sIdx) => (
          <group key={`sarcophagus-${sIdx}`} position={[sx, sy, sz]}>
            <mesh position={[0, 0.52, 0]} material={mats.stoneMat}>
              <boxGeometry args={[2.1, 1.04, 1.25]} />
            </mesh>
            <mesh position={[0, 1.12, 0]} material={mats.marbleAltarMat}>
              <boxGeometry args={[1.95, 0.16, 1.12]} />
            </mesh>
          </group>
        ))}

        {/* Flickering Crypt Altar Candles & Carved Inscription Tablets */}
        {([
          [-6.4, -3.2, -55.4],
          [-6.4, -3.2, -51.8],
          [1.6, -3.2, -58.0],
          [5.1, -3.2, -55.0],
        ] as const).map(([cx, cy, cz], cIdx) => (
          <group key={`crypt-candle-${cIdx}`} position={[cx, cy, cz]}>
            <mesh position={[0, 0, 0]} material={mats.darkIronMat}>
              <boxGeometry args={[0.24, 0.12, 0.24]} />
            </mesh>
            <mesh position={[0, 0.18, 0]} material={mats.emberWaxMat}>
              <cylinderGeometry args={[0.04, 0.05, 0.28, 6]} />
            </mesh>
          </group>
        ))}

        {/* Dormant Milestone 3 Objective: Concealed LIGHT MODE Breaker Box Alcove [-4.0, -4.5, -50.2] */}
        <group position={[-4.0, -3.2, -50.22]}>
          <mesh position={[0, 0, 0]} material={mats.darkIronMat}>
            <boxGeometry args={[1.05, 1.35, 0.24]} />
          </mesh>
          <mesh position={[0, -0.1, 0.15]} material={mats.stoneMat}>
            <boxGeometry args={[0.16, 0.55, 0.16]} />
          </mesh>
          <mesh position={[0.28, 0.42, 0.14]} material={mats.emberWaxMat}>
            <boxGeometry args={[0.14, 0.14, 0.05]} />
          </mesh>
        </group>
      </group>

      {/* Debug Collision Bounds Wireframes (?debug=true toggle) */}
      {debugEnabled && showCollisionWireframes && (
        <group>
          {STATIC_AABB_COLLIDERS.map((box) => {
            const clampedH = Math.min(box.height, 4.2);
            const baseY = box.minY !== undefined && box.minY < -1.0 ? -4.5 : 0;
            return (
              <mesh
                key={`dbg-${box.id}`}
                position={[
                  (box.minX + box.maxX) / 2,
                  baseY + clampedH / 2,
                  (box.minZ + box.maxZ) / 2,
                ]}
                material={mats.wireWallMat}
              >
                <boxGeometry
                  args={[
                    box.maxX - box.minX,
                    clampedH,
                    box.maxZ - box.minZ,
                  ]}
                />
              </mesh>
            );
          })}
          {gateLockedBehind && (
            <mesh
              position={[
                (GATE_DOOR_COLLIDER.minX + GATE_DOOR_COLLIDER.maxX) / 2,
                GATE_DOOR_COLLIDER.height / 2,
                (GATE_DOOR_COLLIDER.minZ + GATE_DOOR_COLLIDER.maxZ) / 2,
              ]}
              material={mats.wireGateLockedMat}
            >
              <boxGeometry
                args={[
                  GATE_DOOR_COLLIDER.maxX - GATE_DOOR_COLLIDER.minX,
                  GATE_DOOR_COLLIDER.height,
                  GATE_DOOR_COLLIDER.maxZ - GATE_DOOR_COLLIDER.minZ,
                ]}
              />
            </mesh>
          )}
          {debugCircleColliders.map((c) => (
            <mesh
              key={`dbg-c-${c.id}`}
              position={[c.x, c.height / 2, c.z]}
              scale={[c.radius, c.height, c.radius]}
              geometry={debugCylinderGeo}
              material={mats.wireCircleMat}
            />
          ))}
        </group>
      )}
    </>
  );
};

export interface AfterdarkCanvasProps {
  readonly touchLookDeltaRef: React.MutableRefObject<{ x: number; y: number }>;
  readonly onContextLost?: () => void;
}

export const CemeteryWorldCanvas: React.FC<AfterdarkCanvasProps> = ({
  touchLookDeltaRef,
  onContextLost,
}) => {
  const quality = useAfterdarkStore((s) => s.quality);
  const phase = useAfterdarkStore((s) => s.phase);
  const pointerLocked = useAfterdarkStore((s) => s.pointerLocked);
  const budget = getQualityBudget(quality);
  const canvasDomRef = useRef<HTMLCanvasElement | null>(null);

  const handleCanvasClick = () => {
    const dom = canvasDomRef.current;
    if (!dom || phase !== "exploration" || pointerLocked) return;
    try {
      const maybePromise = dom.requestPointerLock?.() as
        | Promise<void>
        | undefined;
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore browser pointer lock denial
    }
  };

  return (
    <div
      className="afterdark-touch-surface relative w-full h-full bg-[#000000]"
      onClick={handleCanvasClick}
      data-testid="afterdark-canvas-stage"
    >
      <Canvas
        dpr={[budget.dpr[0], budget.dpr[1]]}
        shadows={budget.shadowsEnabled}
        camera={{ fov: 64, near: 0.12, far: 140, position: [0, 1.7, 36.2] }}
        gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          canvasDomRef.current = gl.domElement;
          gl.domElement.addEventListener("webglcontextlost", (ev) => {
            ev.preventDefault();
            onContextLost?.();
          });
        }}
      >
        <CemeterySceneContents touchLookDeltaRef={touchLookDeltaRef} />
      </Canvas>
    </div>
  );
};
