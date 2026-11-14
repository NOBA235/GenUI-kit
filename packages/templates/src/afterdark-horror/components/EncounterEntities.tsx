import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getAfterdarkSoundscape } from "../audio/soundscape.js";
import {
  CLUE_RECORDS,
  evaluateEncounterProximity,
  evaluateInteractableFocus,
  evaluateLightSwitchFocus,
  LIGHT_MODE_SWITCH_SPEC,
} from "../engine/world-data.js";
import { useAfterdarkStore } from "../store.js";

const WEEPING_TRAIL_WAYPOINTS: readonly [number, number, number][] = [
  [-17.4, 0.25, -12.0],
  [-16.4, 0.25, -14.8],
  [-15.0, 0.25, -17.6],
  [-13.5, 0.25, -20.2],
  [-12.1, 0.25, -22.6],
  [-11.2, 0.35, -24.5],
];

export interface EncounterEntitiesProps {
  readonly silhouetteGeometry: THREE.BufferGeometry;
}

/**
 * Coordinates the `[E]` raycasted clue focus detector and all 5 stateful,
 * cooldown-governed supernatural encounter apparitions with zero per-frame allocations.
 */
export const EncounterEntities: React.FC<EncounterEntitiesProps> = ({
  silhouetteGeometry,
}) => {
  const activeVisual = useAfterdarkStore((s) => s.activeVisualEncounter);
  const weepingGuideActive = useAfterdarkStore((s) => s.weepingGuideActive);
  const discoveredClues = useAfterdarkStore((s) => s.discoveredClues);
  const activeInteractableId = useAfterdarkStore((s) => s.activeInteractableId);

  const entityRef = useRef<THREE.Mesh>(null);
  const directorClockRef = useRef(0);

  const materials = useMemo(() => {
    const shadowEntity = new THREE.MeshStandardMaterial({
      color: "#050608",
      emissive: "#1f0808",
      emissiveIntensity: 0.45,
      roughness: 0.9,
      metalness: 0.1,
    });
    const spectralEntity = new THREE.MeshStandardMaterial({
      color: "#c7d2fe",
      emissive: "#7dd3fc",
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.56,
      roughness: 0.4,
    });
    const clueGlowMat = new THREE.MeshStandardMaterial({
      color: "#fef3c7",
      emissive: "#f59e0b",
      emissiveIntensity: 1.9,
      roughness: 0.3,
    });
    const trailEmberMat = new THREE.MeshStandardMaterial({
      color: "#bae6fd",
      emissive: "#38bdf8",
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    return { shadowEntity, spectralEntity, clueGlowMat, trailEmberMat };
  }, []);

  useEffect(() => {
    return () => {
      materials.shadowEntity.dispose();
      materials.spectralEntity.dispose();
      materials.clueGlowMat.dispose();
      materials.trailEmberMat.dispose();
    };
  }, [materials]);

  useFrame((_, rawDelta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    const state = useAfterdarkStore.getState();
    if (state.phase !== "exploration" || state.lightModeRestored) return;

    const dt = Math.min(rawDelta, 0.05);
    const nowMs = Date.now();

    // Animate active Moving Shadow / Spectral apparition cleanly at full frame rate
    if (state.activeVisualEncounter && entityRef.current) {
      const enc = state.activeVisualEncounter;
      const progress = Math.max(
        0,
        Math.min(1, (nowMs - enc.startedAtMs) / enc.durationMs),
      );

      if (enc.moveTarget) {
        const lx = enc.position[0] + (enc.moveTarget[0] - enc.position[0]) * progress;
        const ly = enc.position[1] + (enc.moveTarget[1] - enc.position[1]) * progress;
        const lz = enc.position[2] + (enc.moveTarget[2] - enc.position[2]) * progress;
        entityRef.current.position.set(lx, ly, lz);
        entityRef.current.rotation.y = enc.yaw;
      } else {
        const hover = enc.id === "enc-03" ? Math.sin(nowMs * 0.003) * 0.08 : 0;
        entityRef.current.position.set(
          enc.position[0],
          enc.position[1] + hover,
          enc.position[2],
        );
        entityRef.current.rotation.y = enc.yaw;
      }
    }

    // Throttle clue raycast + encounter proximity checks to ~10 Hz (low CPU cost)
    directorClockRef.current += dt;
    if (directorClockRef.current < 0.1) return;
    directorClockRef.current = 0;

    // 1. Raycasted proximity focus check (`Press [E] to Examine` / `Activate LIGHT MODE`)
    const lookingAtSwitch = evaluateLightSwitchFocus(
      state.playerPosition,
      state.playerYaw,
      state.playerPitch,
    );
    const focused = lookingAtSwitch
      ? null
      : evaluateInteractableFocus(
          state.playerPosition,
          state.playerYaw,
          state.playerPitch,
        );
    const nextFocusId = lookingAtSwitch ? "light-switch" : (focused?.id ?? null);
    if (nextFocusId !== state.activeInteractableId) {
      state.setActiveInteractable(nextFocusId);
    }

    // 1b. Subtle metallic breaker hum proportional to proximity in Zone E
    if (state.playerPosition[1] < 0) {
      const sw = LIGHT_MODE_SWITCH_SPEC.position;
      const d = Math.hypot(
        sw[0] - state.playerPosition[0],
        sw[1] - state.playerPosition[1],
        sw[2] - state.playerPosition[2],
      );
      const prox = Math.max(0, Math.min(1, 1 - d / 11.5));
      getAfterdarkSoundscape().setBreakerHumProximity(prox);
    } else {
      getAfterdarkSoundscape().setBreakerHumProximity(0);
    }

    // 2. Supernatural Encounter Director tick (cooldowns + gaze dot check)
    const decision = evaluateEncounterProximity({
      playerPosition: state.playerPosition,
      playerYaw: state.playerYaw,
      playerPitch: state.playerPitch,
      nowMs,
      cooldownUntilById: state.encounterCooldownUntil,
      activeVisual: state.activeVisualEncounter,
    });

    if (decision.cryptIntimidation !== state.cryptIntimidationActive) {
      state.setCryptIntimidation(decision.cryptIntimidation);
    }

    if (decision.vanishActive) {
      state.clearVisualEncounter(decision.illuminateGardenTrail);
    } else if (decision.triggerId) {
      state.triggerEncounter(decision.triggerId, nowMs, false);
    }
  });

  const isSpectral = activeVisual?.id === "enc-03";

  return (
    <group>
      {/* Active Supernatural Encounter 3D Silhouette */}
      {activeVisual && (
        <mesh
          ref={entityRef}
          position={activeVisual.position}
          rotation={[0, activeVisual.yaw, 0]}
          scale={activeVisual.id === "enc-01" ? [1.05, 1.18, 1.05] : [0.95, 1, 0.95]}
          geometry={silhouetteGeometry}
          material={isSpectral ? materials.spectralEntity : materials.shadowEntity}
        />
      )}

      {/* Subtle Clue Anchor Glint Orbs (focused or undiscovered hints without tacky floating UI) */}
      {CLUE_RECORDS.map((clue) => {
        const isDiscovered = discoveredClues.includes(clue.id);
        const isFocused = activeInteractableId === clue.id;
        return (
          <mesh
            key={`clue-beacon-${clue.id}`}
            position={[clue.position[0], clue.position[1] + 0.12, clue.position[2]]}
            scale={isFocused ? 1.4 : isDiscovered ? 0.45 : 0.85}
            material={materials.clueGlowMat}
          >
            <octahedronGeometry args={[0.075, 0]} />
          </mesh>
        );
      })}

      {/* Illuminated Embers along Concealed Dead Garden Trail (revealed after Weeping Woman dissipates) */}
      {weepingGuideActive &&
        WEEPING_TRAIL_WAYPOINTS.map((pos, idx) => (
          <mesh
            key={`garden-trail-${idx}`}
            position={pos}
            material={materials.trailEmberMat}
          >
            <sphereGeometry args={[0.09, 8, 8]} />
          </mesh>
        ))}
    </group>
  );
};
