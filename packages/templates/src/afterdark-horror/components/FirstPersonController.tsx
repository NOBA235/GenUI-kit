import React, { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getAfterdarkSoundscape } from "../audio/soundscape.js";
import {
  buildCircleColliders,
  getWalkableFloorHeight,
  isInsideChapelFloorboards,
  isOnStonePaving,
  PLAYER_EYE_HEIGHT,
  resolvePlayerMovement,
} from "../engine/collision.js";
import {
  LIGHT_MODE_SWITCH_SPEC,
  resolveTransformationStage,
  TOTAL_TRANSFORMATION_DURATION,
} from "../engine/world-data.js";
import { getQualityBudget, useAfterdarkStore } from "../store.js";

// Pre-allocated scratch vectors (zero allocations inside useFrame)
const _forwardVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _wishDir = new THREE.Vector3();

const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.5;
const VELOCITY_ACCEL = 15.0;
const VELOCITY_DAMPING = 10.5;
const GATE_TRANSITION_DURATION = 3.4;

export interface FirstPersonControllerProps {
  readonly touchLookDeltaRef: React.MutableRefObject<{ x: number; y: number }>;
}

export const FirstPersonController: React.FC<FirstPersonControllerProps> = ({
  touchLookDeltaRef,
}) => {
  const { camera, gl } = useThree();

  const keysPressed = useRef<Set<string>>(new Set());
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const velXRef = useRef(0);
  const velZRef = useRef(0);
  const feetYRef = useRef(0);
  const stridePhaseRef = useRef(0);
  const lastStepIndexRef = useRef(0);
  const transitionElapsedRef = useRef(0);
  const restoreElapsedRef = useRef(0);
  const gateCreakPlayedRef = useRef(false);
  const gateSlamPlayedRef = useRef(false);
  const telemetryClockRef = useRef(0);
  const distAccumRef = useRef(0);
  const fpsFramesRef = useRef(0);
  const fpsAccumRef = useRef(0);
  const lastTeleportSeqRef = useRef(0);

  // Build collision circle cache matching active hardware preset
  const quality = useAfterdarkStore((s) => s.quality);
  const circleCollidersRef = useRef(
    buildCircleColliders(
      getQualityBudget(quality).tombstoneCount,
      getQualityBudget(quality).deadTreeCount,
    ),
  );

  useEffect(() => {
    const budget = getQualityBudget(quality);
    circleCollidersRef.current = buildCircleColliders(
      budget.tombstoneCount,
      budget.deadTreeCount,
    );
  }, [quality]);

  // Configure Euler YXZ order for FPS look
  useEffect(() => {
    camera.rotation.order = "YXZ";
    camera.position.set(0, PLAYER_EYE_HEIGHT, 36.2);
    camera.rotation.set(0.04, 0, 0);
  }, [camera]);

  // Keyboard & Pointer Lock listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Allow Alt+G & browser shortcuts through cleanly
      if (e.altKey || e.metaKey || e.ctrlKey) return;

      // Handle [E] Examination, LIGHT MODE Breaker Switch & Reader dismiss
      if (e.code === "KeyE" && !e.repeat) {
        const st = useAfterdarkStore.getState();
        if (st.phase === "exploration") {
          if (st.activeReaderClueId) {
            st.closeClueReader();
            return;
          }
          if (st.activeInteractableId === "light-switch") {
            st.triggerLightModeSequence();
            return;
          }
          if (st.activeInteractableId) {
            st.examineClue(st.activeInteractableId);
            return;
          }
        }
      }

      if (e.code === "Escape") {
        const st = useAfterdarkStore.getState();
        if (st.activeReaderClueId) {
          st.closeClueReader();
          return;
        }
      }

      keysPressed.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    const onBlur = () => {
      keysPressed.current.clear();
    };

    const onMouseMove = (e: MouseEvent) => {
      const state = useAfterdarkStore.getState();
      if (state.phase !== "exploration" || !state.pointerLocked) return;
      const sensitivity = 0.0022;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current = Math.max(
        -1.22,
        Math.min(1.22, pitchRef.current - e.movementY * sensitivity),
      );
    };

    const onPointerLockChange = () => {
      const dom = gl.domElement;
      const locked = document.pointerLockElement === dom;
      useAfterdarkStore.getState().setPointerLocked(locked);
      if (!locked) {
        keysPressed.current.clear();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, [gl]);

  useFrame((_, rawDelta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    const dt = Math.min(rawDelta, 0.05);
    const state = useAfterdarkStore.getState();
    const audio = getAfterdarkSoundscape();

    // 1. Handle pending debug/reset teleports cleanly
    if (
      state.pendingTeleport &&
      state.pendingTeleport.seq !== lastTeleportSeqRef.current
    ) {
      lastTeleportSeqRef.current = state.pendingTeleport.seq;
      const [tx, ty, tz] = state.pendingTeleport.position;
      feetYRef.current = ty - PLAYER_EYE_HEIGHT;
      camera.position.set(tx, ty, tz);
      yawRef.current = state.pendingTeleport.yaw;
      pitchRef.current = 0;
      velXRef.current = 0;
      velZRef.current = 0;
      transitionElapsedRef.current = 0;
      gateCreakPlayedRef.current = false;
      gateSlamPlayedRef.current = false;
    }

    // 2. FPS calculation
    fpsFramesRef.current += 1;
    fpsAccumRef.current += rawDelta;

    // 3. Shutdown & Typography phases: gentle wind-sway look outside locked gate
    if (state.phase === "shutdown" || state.phase === "typography") {
      transitionElapsedRef.current = 0;
      gateCreakPlayedRef.current = false;
      gateSlamPlayedRef.current = false;
      camera.position.set(0, PLAYER_EYE_HEIGHT + Math.sin(performance.now() * 0.0007) * 0.02, 36.2);
      camera.rotation.set(0.03, Math.sin(performance.now() * 0.0003) * 0.015, 0);
      return;
    }

    // 4. Scene 02: Cinematic Gate Swing + Dolly Entry + Gate Lock Behind Player
    if (state.phase === "gate_transition") {
      transitionElapsedRef.current += dt;
      const t = transitionElapsedRef.current;

      if (!gateCreakPlayedRef.current) {
        gateCreakPlayedRef.current = true;
        audio.playGateCreak();
      }

      if (t < 1.0) {
        // Gates swing wide open while camera breathes forward slightly
        const p = Math.min(1, t / 1.0);
        const easedGate = 1 - Math.pow(1 - p, 3);
        state.setGateState(easedGate, false);
        const cz = 36.2 - p * 2.2;
        camera.position.set(0, PLAYER_EYE_HEIGHT + Math.sin(p * Math.PI) * 0.04, cz);
        camera.rotation.set(0.025, 0, 0);
      } else if (t < 2.75) {
        // Dolly straight through the archway onto central avenue
        const p = Math.min(1, (t - 1.0) / 1.75);
        const smooth = p * p * (3 - 2 * p);
        state.setGateState(1, false);
        const cz = 34.0 - smooth * 9.2; // 34.0 -> 24.8 (safely north of gate at 29.0)
        const bob = Math.sin(p * Math.PI * 6) * 0.045;
        camera.position.set(0, PLAYER_EYE_HEIGHT + bob, cz);
        camera.rotation.set(0.01 * Math.cos(p * Math.PI * 3), 0, 0);

        const stepTick = Math.floor(p * 6);
        if (stepTick !== lastStepIndexRef.current) {
          lastStepIndexRef.current = stepTick;
          audio.playFootstep("stone", false);
        }
      } else if (t < GATE_TRANSITION_DURATION) {
        // Gates swing shut & lock behind the player
        const p = Math.min(1, (t - 2.75) / (GATE_TRANSITION_DURATION - 2.75));
        const openProg = Math.max(0, 1 - p * p);
        if (openProg <= 0.15 && !gateSlamPlayedRef.current) {
          gateSlamPlayedRef.current = true;
          audio.playGateSlam();
        }
        state.setGateState(openProg, openProg < 0.35);
        camera.position.set(0, PLAYER_EYE_HEIGHT, 24.8);
        camera.rotation.set(0, 0, 0);
      } else {
        yawRef.current = 0;
        pitchRef.current = 0;
        velXRef.current = 0;
        velZRef.current = 0;
        state.finishGateEntry();
      }
      return;
    }

    // 4b. Phase 6: 10-Stage Cinematic Transformation Choreography
    if (state.phase === "restoring_light") {
      restoreElapsedRef.current += dt;
      const elapsed = restoreElapsedRef.current;
      const stage = resolveTransformationStage(elapsed);
      const leverProgress = Math.max(
        0,
        Math.min(1, (elapsed - 0.35) / 0.65),
      );
      if (
        stage !== state.transformationStage ||
        Math.abs(leverProgress - state.lightSwitchLeverProgress) > 0.02
      ) {
        state.setTransformationProgress(stage, leverProgress);
      }

      if (stage <= 6) {
        // Focus smoothly toward the Zone E cast-iron LIGHT MODE Breaker Box [-4.0, -3.2, -50.22]
        const [sx, sy, sz] = LIGHT_MODE_SWITCH_SPEC.standPoint;
        camera.position.x += (sx - camera.position.x) * Math.min(1, dt * 6);
        camera.position.y += (sy - camera.position.y) * Math.min(1, dt * 6);
        camera.position.z += (sz - camera.position.z) * Math.min(1, dt * 6);
        // Facing +Z (yaw = PI) toward wall z = -50.22, tilted slightly down toward plaque
        yawRef.current = Math.PI;
        pitchRef.current = -0.14;
        camera.rotation.set(pitchRef.current, yawRef.current, 0);
      } else if (stage <= 9) {
        // Stage 7-9: Elevate outward into panoramic view overlooking awakened Gothic Chapel & cemetery
        const panFrac = Math.min(1, (elapsed - 3.4) / 2.2);
        const eased = panFrac * panFrac * (3 - 2 * panFrac);
        camera.position.set(
          -4.0 * (1 - eased),
          -2.8 + eased * 9.0,
          -52.1 + eased * 59.5,
        );
        camera.rotation.set(-0.08 - eased * 0.14, Math.PI * (1 - eased), 0);
      }

      if (elapsed >= TOTAL_TRANSFORMATION_DURATION) {
        restoreElapsedRef.current = 0;
        state.completeLightModeTransition();
      }
      return;
    }
    restoreElapsedRef.current = 0;

    // 5. Scene 03+: Genuine First-Person Exploration + AABB/Circle Collision
    if (state.phase === "exploration") {
      // Freeze translation smoothly while reading an examined Clue Parchment
      if (state.activeReaderClueId) {
        velXRef.current = 0;
        velZRef.current = 0;
        return;
      }

      // Apply virtual touch drag look delta if any
      if (
        touchLookDeltaRef.current.x !== 0 ||
        touchLookDeltaRef.current.y !== 0
      ) {
        yawRef.current -= touchLookDeltaRef.current.x * 0.0045;
        pitchRef.current = Math.max(
          -1.22,
          Math.min(1.22, pitchRef.current - touchLookDeltaRef.current.y * 0.0045),
        );
        touchLookDeltaRef.current.x = 0;
        touchLookDeltaRef.current.y = 0;
      }

      const keys = keysPressed.current;
      let moveForward = 0;
      let moveStrafe = 0;

      if (keys.has("KeyW") || keys.has("ArrowUp")) moveForward += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) moveForward -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) moveStrafe += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) moveStrafe -= 1;

      // Add virtual touch joystick vector
      moveStrafe += state.virtualMove[0];
      moveForward += state.virtualMove[1];

      // Compute camera XZ forward and right vectors with zero allocations
      _forwardVec.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
      _rightVec.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));

      _wishDir.set(0, 0, 0);
      _wishDir.addScaledVector(_forwardVec, moveForward);
      _wishDir.addScaledVector(_rightVec, moveStrafe);
      if (_wishDir.lengthSq() > 1) {
        _wishDir.normalize();
      }

      const isSprinting =
        keys.has("ShiftLeft") ||
        keys.has("ShiftRight") ||
        state.virtualSprint;
      const maxSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;

      if (_wishDir.lengthSq() > 0.001) {
        const accelFactor = 1 - Math.exp(-VELOCITY_ACCEL * dt);
        velXRef.current += (_wishDir.x * maxSpeed - velXRef.current) * accelFactor;
        velZRef.current += (_wishDir.z * maxSpeed - velZRef.current) * accelFactor;
      } else {
        const dampFactor = Math.exp(-VELOCITY_DAMPING * dt);
        velXRef.current *= dampFactor;
        velZRef.current *= dampFactor;
        if (Math.abs(velXRef.current) < 0.01) velXRef.current = 0;
        if (Math.abs(velZRef.current) < 0.01) velZRef.current = 0;
      }

      const speed = Math.hypot(velXRef.current, velZRef.current);
      const curX = camera.position.x;
      const curZ = camera.position.z;
      const desiredX = curX + velXRef.current * dt;
      const desiredZ = curZ + velZRef.current * dt;

      const resolved = resolvePlayerMovement(curX, curZ, desiredX, desiredZ, {
        gateLocked: state.gateLockedBehind,
        playerFeetY: feetYRef.current,
        circleColliders: circleCollidersRef.current,
      });

      const targetFeetY = getWalkableFloorHeight(
        resolved.x,
        resolved.z,
        feetYRef.current,
      );
      feetYRef.current += (targetFeetY - feetYRef.current) * Math.min(1, dt * 14);

      // Zero-out normal component if stopped hard against boundary
      if (dt > 0) {
        const actualSpeedX = (resolved.x - curX) / dt;
        const actualSpeedZ = (resolved.z - curZ) / dt;
        if (Math.abs(actualSpeedX) < Math.abs(velXRef.current) * 0.25) {
          velXRef.current = actualSpeedX;
        }
        if (Math.abs(actualSpeedZ) < Math.abs(velZRef.current) * 0.25) {
          velZRef.current = actualSpeedZ;
        }
      }

      // Sync subtle head-bob & gravel/stone/chapel-wood footsteps with stride speed
      let bobY = 0;
      let bobSway = 0;
      const actualSpeed = Math.hypot(
        (resolved.x - curX) / Math.max(dt, 0.001),
        (resolved.z - curZ) / Math.max(dt, 0.001),
      );

      if (actualSpeed > 0.55) {
        stridePhaseRef.current += dt * (isSprinting ? 11.2 : 7.6);
        bobY = Math.sin(stridePhaseRef.current) * (isSprinting ? 0.068 : 0.048);
        bobSway = Math.cos(stridePhaseRef.current * 0.5) * 0.018;

        const stepIdx = Math.floor(stridePhaseRef.current / Math.PI);
        if (stepIdx !== lastStepIndexRef.current) {
          lastStepIndexRef.current = stepIdx;
          const surface = isInsideChapelFloorboards(
            resolved.x,
            resolved.z,
            feetYRef.current,
          )
            ? "wood"
            : isOnStonePaving(resolved.x, resolved.z, feetYRef.current)
              ? "stone"
              : "gravel";
          audio.playFootstep(surface, isSprinting);
        }
      } else {
        // Gentle idle breathing
        bobY = Math.sin(performance.now() * 0.0018) * 0.009;
      }

      camera.position.set(
        resolved.x,
        feetYRef.current + PLAYER_EYE_HEIGHT + bobY,
        resolved.z,
      );
      camera.rotation.set(pitchRef.current, yawRef.current, bobSway * 0.35);

      distAccumRef.current += Math.hypot(resolved.x - curX, resolved.z - curZ);

      // Throttled store update (~10 Hz) keeps HUD telemetry fresh without re-render jank
      telemetryClockRef.current += dt;
      if (telemetryClockRef.current >= 0.1) {
        telemetryClockRef.current = 0;
        if (distAccumRef.current >= 0.3) {
          state.addDistanceWalked(distAccumRef.current);
          distAccumRef.current = 0;
        }
        const measuredFps =
          fpsAccumRef.current > 0
            ? Math.round(fpsFramesRef.current / fpsAccumRef.current)
            : 60;
        if (fpsAccumRef.current >= 0.5) {
          fpsFramesRef.current = 0;
          fpsAccumRef.current = 0;
        }
        state.setPlayerTelemetry(
          [
            Number(resolved.x.toFixed(2)),
            Number((feetYRef.current + PLAYER_EYE_HEIGHT).toFixed(2)),
            Number(resolved.z.toFixed(2)),
          ],
          Number(yawRef.current.toFixed(2)),
          Number(pitchRef.current.toFixed(2)),
          Number(speed.toFixed(2)),
          measuredFps,
        );
      }
    }
  });

  return null;
};
