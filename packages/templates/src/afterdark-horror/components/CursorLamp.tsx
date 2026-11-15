import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useAfterdarkStore } from "../store.js";
import type { AfterdarkPhase } from "../types.js";

/**
 * Cursor Lamp — the mouse cursor carries a warm hand lamp through the dark.
 *
 * - `CursorLampLight` (inside <Canvas>): one always-mounted THREE.SpotLight that rides with the
 *   camera and aims through the cursor's screen position. Under Pointer Lock the OS cursor is
 *   frozen, so the beam aims through the screen centre (the crosshair) and follows mouse-look.
 * - `CursorLampGlow` (DOM): a compositor-only warm halo that follows the cursor over the
 *   pitch-black opening screens, where no 3D scene is visible to light.
 *
 * The spot light stays mounted with intensity 0 when off: toggling a light in and out of the
 * scene changes the light count and forces every material to recompile mid-session.
 */

const LAMP_COLOR = "#ffd6a0";
const LAMP_INTENSITY = 6;
const LAMP_DISTANCE = 30;
const LAMP_DECAY = 1.5;
const LAMP_ANGLE = 0.48;
const LAMP_PENUMBRA = 0.85;
/** Distance along the cursor ray where the beam target sits. */
const LAMP_AIM_DISTANCE = 14;
/** Lamp is held slightly right of and below the eye so lit surfaces keep some depth. */
const LAMP_HAND_OFFSET_RIGHT = 0.22;
const LAMP_HAND_OFFSET_DOWN = 0.16;
/** Exponential follow rate (1/s) for the beam aim; high enough to track every cursor move. */
const LAMP_AIM_FOLLOW_RATE = 24;
/** Exponential fade rate (1/s) when the narrative phase switches the lamp on or off. */
const LAMP_FADE_RATE = 3.5;

const GLOW_RADIUS_PX = 260;
const GLOW_GRADIENT =
  "radial-gradient(circle closest-side, rgba(255,238,206,0.42) 0%, rgba(255,210,150,0.26) 8%, rgba(255,172,96,0.12) 30%, rgba(255,140,64,0.045) 58%, rgba(255,140,64,0) 100%)";

// Module-level scratch instances (zero allocations inside useFrame)
const _aimPoint = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Lamp brightness (0..1) for the current narrative phase. Off behind the opaque opening
 * overlay and in daylight; fades out as dawn rises during the LIGHT MODE transformation,
 * using the same dawn curve as the atmosphere rig.
 */
export function resolveCursorLampLevel(
  phase: AfterdarkPhase,
  transformationStage: number,
  lightModeRestored: boolean,
): number {
  if (lightModeRestored) return 0;
  switch (phase) {
    case "gate_transition":
    case "exploration":
      return 1;
    case "restoring_light": {
      const progress = clamp(transformationStage / 10, 0, 1);
      const dawnMix = clamp((progress - 0.5) / 0.36, 0, 1);
      return 1 - dawnMix;
    }
    default:
      return 0;
  }
}

export const CursorLampLight: React.FC = () => {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const lightRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const pointerNdcRef = useRef({ x: 0, y: 0 });
  const aimRef = useRef({ x: 0, y: 0 });
  const levelRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dom = gl.domElement;

    const onPointerMove = (e: PointerEvent) => {
      // Touch drags drive the look pad / joystick, not the lamp; locked cursors report frozen coords.
      if (e.pointerType === "touch" || document.pointerLockElement) return;
      const rect = dom.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdcRef.current.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      pointerNdcRef.current.y = clamp(1 - ((e.clientY - rect.top) / rect.height) * 2, -1, 1);
    };

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motionQuery?.matches ?? false;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    motionQuery?.addEventListener("change", onMotionChange);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      motionQuery?.removeEventListener("change", onMotionChange);
    };
  }, [gl]);

  useFrame((rootState, rawDelta) => {
    if (typeof document === "undefined" || document.hidden) return;
    const light = lightRef.current;
    if (!light) return;
    const dt = Math.min(rawDelta, 0.05);
    const store = useAfterdarkStore.getState();

    // 1. Fade with the narrative phase
    const goalLevel = resolveCursorLampLevel(
      store.phase,
      store.transformationStage,
      store.lightModeRestored,
    );
    levelRef.current += (goalLevel - levelRef.current) * (1 - Math.exp(-LAMP_FADE_RATE * dt));
    if (goalLevel === 0 && levelRef.current < 0.001) levelRef.current = 0;

    // 2. Aim through the cursor, or the crosshair while Pointer Lock is active
    const locked = document.pointerLockElement !== null;
    const goalX = locked ? 0 : pointerNdcRef.current.x;
    const goalY = locked ? 0 : pointerNdcRef.current.y;
    const follow = 1 - Math.exp(-LAMP_AIM_FOLLOW_RATE * dt);
    aimRef.current.x += (goalX - aimRef.current.x) * follow;
    aimRef.current.y += (goalY - aimRef.current.y) * follow;

    // 3. Carry the lamp in the player's hand and point the beam down the cursor ray
    camera.updateMatrixWorld();
    _camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    _camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    light.position
      .copy(camera.position)
      .addScaledVector(_camRight, LAMP_HAND_OFFSET_RIGHT)
      .addScaledVector(_camUp, -LAMP_HAND_OFFSET_DOWN);

    _aimPoint.set(aimRef.current.x, aimRef.current.y, 0.5).unproject(camera);
    _aimDir.subVectors(_aimPoint, camera.position).normalize();
    target.position.copy(camera.position).addScaledVector(_aimDir, LAMP_AIM_DISTANCE);

    // 4. Subtle oil-lamp flicker (< 2 Hz, ±5%), disabled under prefers-reduced-motion
    const elapsed = rootState.clock.elapsedTime;
    const flicker = reducedMotionRef.current
      ? 1
      : 1 + Math.sin(elapsed * 4.3) * 0.035 + Math.sin(elapsed * 11.9 + 1.3) * 0.018;
    light.intensity = LAMP_INTENSITY * levelRef.current * flicker;
  });

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={lightRef}
        target={target}
        color={LAMP_COLOR}
        intensity={0}
        distance={LAMP_DISTANCE}
        decay={LAMP_DECAY}
        angle={LAMP_ANGLE}
        penumbra={LAMP_PENUMBRA}
        castShadow={false}
      />
    </>
  );
};

/**
 * DOM halo for the opaque opening screens. Position updates are written straight to the
 * element's transform from the pointer event (no React re-render, no repaint of the gradient).
 */
export const CursorLampGlow: React.FC = React.memo(() => {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const glow = glowRef.current;
    if (!layer || !glow || typeof window === "undefined") return;

    const hide = () => {
      glow.style.opacity = "0";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || document.pointerLockElement) {
        hide();
        return;
      }
      const rect = layer.getBoundingClientRect();
      const x = e.clientX - rect.left - GLOW_RADIUS_PX;
      const y = e.clientY - rect.top - GLOW_RADIUS_PX;
      glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      glow.style.opacity = "1";
    };

    // relatedTarget === null means the pointer left the browser window
    const onPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget === null) hide();
    };

    const onPointerLockChange = () => {
      if (document.pointerLockElement) hide();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("pointerlockchange", onPointerLockChange);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-testid="afterdark-cursor-lamp-glow"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        ref={glowRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: GLOW_RADIUS_PX * 2,
          height: GLOW_RADIUS_PX * 2,
          borderRadius: "50%",
          background: GLOW_GRADIENT,
          mixBlendMode: "screen",
          opacity: 0,
          transform: "translate3d(-9999px, -9999px, 0)",
          transition: "opacity 280ms ease-out",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
});
CursorLampGlow.displayName = "CursorLampGlow";
