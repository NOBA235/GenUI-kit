import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getAfterdarkSoundscape } from "../audio/soundscape.js";
import { PLAYER_EYE_HEIGHT, WORLD_OUTER_BOUNDS } from "../engine/collision.js";
import {
  createApparitionFaceTexture,
  createApparitionFigureTexture,
} from "../engine/apparition-textures.js";
import { useAfterdarkStore } from "../store.js";

/**
 * Ambient Hauntings: unscripted apparitions that can appear anywhere during exploration.
 * - "figure": a translucent ghost in the distance; drifts closer, vanishes if approached or stared at.
 * - "behind": a whisper behind you; turn around and something is standing there.
 * - "face": a corpse-pale face lunges into view in front of the camera (jump scare).
 * First haunting 9-14s after entering, then every 14-30s; faces at most once per 40s.
 * Faces fade in over 90ms (350ms, no lunge, under prefers-reduced-motion) and never strobe.
 */
export type HauntingKind = "figure" | "behind" | "face";

/** Window event the debug overlay fires to summon a haunting immediately. */
export const SUMMON_HAUNTING_EVENT = "afterdark:summon-haunting";

const FIRST_DELAY_MIN = 9;
const FIRST_DELAY_SPREAD = 5;
const NEXT_DELAY_MIN = 14;
const NEXT_DELAY_SPREAD = 16;
export const FACE_MIN_GAP_SECONDS = 40;

const FIGURE_SCALE_X = 1.25;
const FIGURE_SCALE_Y = 2.85;
const FIGURE_MAX_OPACITY = 0.82;

const KIND_NONE = 0;
const KIND_FIGURE = 1;
const KIND_BEHIND = 2;
const KIND_FACE = 3;

// Module-level scratch (zero allocations inside useFrame)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _look = new THREE.Vector3();

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Pick the next haunting kind from a [0,1) roll and seconds since the last face scare. */
export function pickHauntingKind(roll: number, secondsSinceFace: number): HauntingKind {
  if (secondsSinceFace >= FACE_MIN_GAP_SECONDS && roll < 0.35) return "face";
  if (roll < 0.6) return "behind";
  return "figure";
}

interface HauntState {
  kind: number;
  age: number;
  duration: number;
  fadeOutAt: number;
  x: number;
  y: number;
  z: number;
  offX: number;
  offY: number;
  gazeTime: number;
  seen: boolean;
}

export const AmbientHauntings: React.FC = () => {
  const camera = useThree((s) => s.camera);
  const figureRef = useRef<THREE.Sprite>(null);
  const faceRef = useRef<THREE.Sprite>(null);
  const clockRef = useRef(0);
  const nextAtRef = useRef(FIRST_DELAY_MIN + Math.random() * FIRST_DELAY_SPREAD);
  const lastFaceAtRef = useRef(-FACE_MIN_GAP_SECONDS);
  const summonRef = useRef<HauntingKind | null>(null);
  const reducedMotionRef = useRef(false);
  const hauntRef = useRef<HauntState>({
    kind: KIND_NONE, age: 0, duration: 0, fadeOutAt: 0,
    x: 0, y: 0, z: 0, offX: 0, offY: 0, gazeTime: 0, seen: false,
  });

  const assets = useMemo(() => {
    const faces = ([0, 1, 2] as const).map((v) => createApparitionFaceTexture(v));
    const figures = ([0, 1] as const).map((v) => createApparitionFigureTexture(v));
    const figureMat = new THREE.SpriteMaterial({
      map: figures[0] ?? null, color: "#dfe7ee", transparent: true,
      opacity: 0, depthWrite: false, fog: false,
    });
    const faceMat = new THREE.SpriteMaterial({
      map: faces[0] ?? null, color: "#f1ede4", transparent: true,
      opacity: 0, depthWrite: false, depthTest: false, fog: false,
    });
    return { faces, figures, figureMat, faceMat };
  }, []);

  useEffect(
    () => () => {
      for (const t of assets.faces) t?.dispose();
      for (const t of assets.figures) t?.dispose();
      assets.figureMat.dispose();
      assets.faceMat.dispose();
    },
    [assets],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSummon = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: HauntingKind } | undefined>).detail?.kind;
      summonRef.current =
        kind === "face" || kind === "behind" || kind === "figure" ? kind : "figure";
    };
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq?.matches ?? false;
    const onMotion = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    window.addEventListener(SUMMON_HAUNTING_EVENT, onSummon);
    mq?.addEventListener("change", onMotion);
    return () => {
      window.removeEventListener(SUMMON_HAUNTING_EVENT, onSummon);
      mq?.removeEventListener("change", onMotion);
    };
  }, []);

  useFrame((_, rawDelta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    const figure = figureRef.current;
    const face = faceRef.current;
    if (!figure || !face) return;
    const dt = Math.min(rawDelta, 0.05);
    const store = useAfterdarkStore.getState();
    const haunt = hauntRef.current;

    const canHaunt =
      store.phase === "exploration" &&
      !store.lightModeRestored &&
      !store.activeReaderClueId &&
      !store.activeVisualEncounter;
    if (!canHaunt) {
      if (haunt.kind !== KIND_NONE) {
        haunt.kind = KIND_NONE;
        figure.visible = false;
        face.visible = false;
      }
      return;
    }

    clockRef.current += dt;
    camera.getWorldDirection(_look);
    _forward.set(_look.x, 0, _look.z);
    if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1);
    _forward.normalize();
    _right.set(-_forward.z, 0, _forward.x);

    // 1. Spawn when the timer elapses or the debug panel summons one
    if (haunt.kind === KIND_NONE && (summonRef.current || clockRef.current >= nextAtRef.current)) {
      const summoned = summonRef.current;
      summonRef.current = null;
      const kind =
        summoned ?? pickHauntingKind(Math.random(), clockRef.current - lastFaceAtRef.current);
      nextAtRef.current = clockRef.current + NEXT_DELAY_MIN + Math.random() * NEXT_DELAY_SPREAD;
      const feetY = camera.position.y - PLAYER_EYE_HEIGHT;
      const audio = getAfterdarkSoundscape();
      haunt.age = 0;
      haunt.gazeTime = 0;
      haunt.seen = false;

      if (kind === "face") {
        haunt.kind = KIND_FACE;
        haunt.duration = reducedMotionRef.current ? 1.5 : 1.05;
        haunt.fadeOutAt = haunt.duration * 0.62;
        haunt.offX = (Math.random() - 0.5) * 0.5;
        haunt.offY = (Math.random() - 0.5) * 0.18;
        lastFaceAtRef.current = clockRef.current;
        const map = assets.faces[Math.floor(Math.random() * assets.faces.length)] ?? null;
        if (assets.faceMat.map !== map) assets.faceMat.map = map;
        face.visible = true;
        audio.playApparitionStinger("face", clamp(haunt.offX * 2, -1, 1));
      } else {
        const behind = kind === "behind";
        const angle = behind
          ? Math.PI + (Math.random() - 0.5) * 0.5
          : (Math.random() - 0.5) * 1.0;
        const dist = behind
          ? 2.8 + Math.random() * 0.8
          : feetY < -1.0
            ? 4.5 + Math.random() * 2.5
            : 9 + Math.random() * 6;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        haunt.kind = behind ? KIND_BEHIND : KIND_FIGURE;
        haunt.duration = behind ? 4.5 : 6.5;
        haunt.fadeOutAt = haunt.duration - 0.8;
        haunt.x = clamp(
          camera.position.x + (_forward.x * cosA + _right.x * sinA) * dist,
          WORLD_OUTER_BOUNDS.minX + 0.5,
          WORLD_OUTER_BOUNDS.maxX - 0.5,
        );
        haunt.z = clamp(
          camera.position.z + (_forward.z * cosA + _right.z * sinA) * dist,
          WORLD_OUTER_BOUNDS.cryptMinZ + 0.5,
          WORLD_OUTER_BOUNDS.maxZ - 0.5,
        );
        haunt.y = feetY;
        const map = assets.figures[Math.floor(Math.random() * assets.figures.length)] ?? null;
        if (assets.figureMat.map !== map) assets.figureMat.map = map;
        figure.visible = true;
        if (behind) audio.playRearWhisperCue();
        else audio.playApparitionStinger("figure", clamp(sinA * 1.4, -1, 1));
      }
    }

    if (haunt.kind === KIND_NONE) return;
    haunt.age += dt;

    // 2a. Jump-scare face held in front of the camera
    if (haunt.kind === KIND_FACE) {
      const reduced = reducedMotionRef.current;
      const fadeIn = reduced ? 0.35 : 0.09;
      const a = haunt.age;
      const opacity =
        a < fadeIn
          ? a / fadeIn
          : a < haunt.fadeOutAt
            ? 1
            : 1 - (a - haunt.fadeOutAt) / (haunt.duration - haunt.fadeOutAt);
      const lunge = reduced ? 0 : 1 - Math.exp(-a * 5);
      _up.setFromMatrixColumn(camera.matrixWorld, 1);
      face.position
        .copy(camera.position)
        .addScaledVector(_look, 1.35 - lunge * 0.35)
        .addScaledVector(_right, haunt.offX)
        .addScaledVector(_up, haunt.offY);
      const s = reduced ? 0.9 : 0.72 + lunge * 0.3;
      face.scale.set(s, s, 1);
      assets.faceMat.opacity = clamp(opacity, 0, 1);
      if (a >= haunt.duration) {
        haunt.kind = KIND_NONE;
        face.visible = false;
        assets.faceMat.opacity = 0;
      }
      return;
    }

    // 2b. Standing figure (ahead of or behind the player)
    const dx = haunt.x - camera.position.x;
    const dz = haunt.z - camera.position.z;
    const dist = Math.hypot(dx, dz);
    const gaze = dist > 1e-4 ? (dx * _forward.x + dz * _forward.z) / dist : 1;

    if (haunt.kind === KIND_BEHIND) {
      // Once the player turns to face it, it lingers a heartbeat, then is gone
      if (!haunt.seen && gaze > 0.8) {
        haunt.seen = true;
        haunt.fadeOutAt = Math.min(haunt.fadeOutAt, haunt.age + 0.7);
        haunt.duration = haunt.fadeOutAt + 0.35;
        getAfterdarkSoundscape().playApparitionStinger("figure", 0);
      }
    } else {
      // Drift slowly toward the player; vanish when approached or stared down
      if (dist > 3.5) {
        const step = (0.35 * dt) / dist;
        haunt.x -= dx * step;
        haunt.z -= dz * step;
      }
      haunt.gazeTime = gaze > 0.985 ? haunt.gazeTime + dt : Math.max(0, haunt.gazeTime - dt);
      if ((dist < 4.2 || haunt.gazeTime > 1.4) && haunt.fadeOutAt > haunt.age + 0.3) {
        haunt.fadeOutAt = haunt.age;
        haunt.duration = haunt.age + 0.3;
      }
    }

    const fadeInDur = haunt.kind === KIND_BEHIND ? 0.4 : 1.0;
    const fadeOutDur = Math.max(0.05, haunt.duration - haunt.fadeOutAt);
    const level =
      haunt.age < fadeInDur
        ? haunt.age / fadeInDur
        : haunt.age < haunt.fadeOutAt
          ? 1
          : 1 - (haunt.age - haunt.fadeOutAt) / fadeOutDur;
    // Gentle 3 Hz shimmer (±8%), not a flash
    const shimmer = 0.92 + 0.08 * Math.sin(haunt.age * 19);
    assets.figureMat.opacity = clamp(level, 0, 1) * FIGURE_MAX_OPACITY * shimmer;
    const bob = Math.sin(haunt.age * 1.6) * 0.06;
    figure.position.set(haunt.x, haunt.y + FIGURE_SCALE_Y / 2 + 0.05 + bob, haunt.z);
    figure.scale.set(FIGURE_SCALE_X, FIGURE_SCALE_Y, 1);

    if (haunt.age >= haunt.duration) {
      haunt.kind = KIND_NONE;
      figure.visible = false;
      assets.figureMat.opacity = 0;
    }
  });

  return (
    <>
      <sprite ref={figureRef} material={assets.figureMat} visible={false} />
      <sprite ref={faceRef} material={assets.faceMat} visible={false} renderOrder={999} />
    </>
  );
};
