import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getAfterdarkSoundscape } from "../audio/soundscape.js";
import {
  buildCircleColliders,
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
import { FirstPersonController } from "./FirstPersonController.js";

// Module-level reusable scratch instances (ZERO allocations inside useFrame)
const _dummyObj = new THREE.Object3D();
const _darkSkyColor = new THREE.Color("#010205");
const _flashSkyColor = new THREE.Color("#2a3752");
const _lightModeSkyColor = new THREE.Color("#cbd5e1");
const _tempFogColor = new THREE.Color("#010205");

const PERIMETER_PICKET_SEGMENTS = (() => {
  const coords: Array<[number, number]> = [];
  // North wall pickets
  for (let x = -35; x <= 35; x += 0.9) coords.push([x, -44.0]);
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
  readonly lanternGlowMat: THREE.MeshStandardMaterial;
  readonly stainedGlassMat: THREE.MeshStandardMaterial;
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
  mats.lanternGlowMat.dispose();
  mats.stainedGlassMat.dispose();
  mats.wireWallMat.dispose();
  mats.wireGateLockedMat.dispose();
  mats.wireCircleMat.dispose();
}

const AtmosphereLightningRig: React.FC = () => {
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  const lanternLightRefs = useRef<Array<THREE.PointLight | null>>([]);

  // Deterministic lightning state — capped strictly below 3 flashes/sec (minimum 7s cooldown)
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
    const phase = useAfterdarkStore.getState().phase;
    const elapsed = rootState.clock.elapsedTime;

    // External trigger from Debug Overlay button
    if (externalLightning > flashIntensityRef.current) {
      flashIntensityRef.current = externalLightning;
      useAfterdarkStore.getState().setLightningIntensity(0);
    }

    // Periodic atmospheric lightning flash (minimum 7-13s cooldown => WCAG 2.3.1 compliant)
    if (
      lightningEnabled &&
      !lightModeRestored &&
      phase !== "shutdown"
    ) {
      cooldownRef.current -= dt;
      if (cooldownRef.current <= 0) {
        cooldownRef.current = 7.5 + (Math.sin(elapsed * 1.7) * 0.5 + 0.5) * 6.0;
        flashIntensityRef.current = 1.0;
        getAfterdarkSoundscape().playLightningThunder();
      }
    }

    // Smooth single exponential decay
    flashIntensityRef.current = Math.max(0, flashIntensityRef.current - dt * 2.1);

    const flash = flashIntensityRef.current;
    const isShutdownBlack = phase === "shutdown";

    if (moonRef.current) {
      if (lightModeRestored) {
        moonRef.current.intensity = 1.65;
        moonRef.current.color.set("#fef3c7");
      } else if (lightOverride) {
        moonRef.current.intensity = 1.2;
        moonRef.current.color.set("#b4c6e7");
      } else if (isShutdownBlack) {
        moonRef.current.intensity = 0;
      } else {
        // Eerie cold moonlight rim + dramatic lightning spike
        moonRef.current.intensity = 0.34 * (1 - darknessLevel * 0.35) + flash * 3.4;
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
      } else {
        fogRef.current.density = Math.max(0.012, fogDensity - flash * 0.022);
        _tempFogColor.lerpColors(_darkSkyColor, _flashSkyColor, flash * 0.85);
        fogRef.current.color.copy(_tempFogColor);
      }
    }

    rootState.scene.background = lightModeRestored
      ? _lightModeSkyColor
      : _tempFogColor;

    // Wind-blown flame flicker on capped dynamic point lights
    const count = Math.min(budget.maxDynamicPointLights, 3);
    for (let i = 0; i < count; i++) {
      const l = lanternLightRefs.current[i];
      if (!l) continue;
      if (isShutdownBlack) {
        l.intensity = 0;
      } else {
        const spec = LANTERN_SPECS[i * 2] ?? LANTERN_SPECS[0]!;
        const wave =
          Math.sin(elapsed * 7.3 + spec.flickerSeed) * 0.14 +
          Math.sin(elapsed * 19.1 + spec.flickerSeed * 2) * 0.08;
        l.intensity = Math.max(0.4, spec.baseIntensity + wave);
      }
    }
  });

  // Position capped point lights at key path milestones: Gatehouse, Mid-Path, Chapel Steps
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
  }, [lancetTombstones, obeliskTombstones, visibleTrees, visiblePickets]);

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
      {/* East Mausoleum Courtyard Stone Apron */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[13.5, 0.016, -14.0]}
        material={mats.pavingMat}
      >
        <planeGeometry args={[11, 8.5]} />
      </mesh>

      {/* Perimeter Low Stone Masonry Walls */}
      <mesh position={[0, 0.75, -44.0]} material={mats.stoneMat}>
        <boxGeometry args={[73.0, 1.5, 1.1]} />
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

      {/* Instanced Perimeter Pickets, Tombstones & Dead Trees */}
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
      <instancedMesh
        ref={treesRef}
        args={[sharedGeoms.gnarledTree, mats.barkMat, visibleTrees.length]}
        frustumCulled={false}
      />

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

      {/* East Mausoleum Crypt Portico Architecture (Milestone 2/3 landmark) */}
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

      {/* Distant Glowing Gothic Chapel Silhouette (Primary Horizon Compass) */}
      <group position={[0, 0, -39.5]}>
        <mesh position={[0, 4.8, 0]} material={mats.stoneMat}>
          <boxGeometry args={[14.8, 9.6, 7.2]} />
        </mesh>
        {/* Pitched Roof */}
        <mesh position={[0, 11.2, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.stoneMat}>
          <coneGeometry args={[10.8, 5.2, 4]} />
        </mesh>
        {/* Bell Tower Spire */}
        <mesh position={[0, 14.5, 1.8]} material={mats.stoneMat}>
          <boxGeometry args={[3.4, 9.0, 3.4]} />
        </mesh>
        <mesh position={[0, 21.6, 1.8]} material={mats.stoneMat}>
          <coneGeometry args={[2.5, 6.2, 4]} />
        </mesh>
        {/* Glowing Stained Glass Windows (guides explorer through pitch darkness) */}
        <mesh position={[0, 5.6, 3.65]} material={mats.stainedGlassMat}>
          <boxGeometry args={[2.2, 4.4, 0.14]} />
        </mesh>
        <mesh position={[-4.2, 4.6, 3.65]} material={mats.stainedGlassMat}>
          <boxGeometry args={[1.1, 2.9, 0.14]} />
        </mesh>
        <mesh position={[4.2, 4.6, 3.65]} material={mats.stainedGlassMat}>
          <boxGeometry args={[1.1, 2.9, 0.14]} />
        </mesh>
        {/* Stone Approach Steps */}
        <mesh position={[0, 0.25, 4.6]} material={mats.stoneMat}>
          <boxGeometry args={[6.4, 0.5, 2.2]} />
        </mesh>
      </group>

      {/* Debug Collision Bounds Wireframes (?debug=true toggle) */}
      {debugEnabled && showCollisionWireframes && (
        <group>
          {STATIC_AABB_COLLIDERS.map((box) => (
            <mesh
              key={`dbg-${box.id}`}
              position={[
                (box.minX + box.maxX) / 2,
                box.height / 2,
                (box.minZ + box.maxZ) / 2,
              ]}
              material={mats.wireWallMat}
            >
              <boxGeometry
                args={[
                  box.maxX - box.minX,
                  box.height,
                  box.maxZ - box.minZ,
                ]}
              />
            </mesh>
          ))}
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
