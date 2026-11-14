import { useSyncExternalStore } from "react";
import { create } from "zustand";
import type {
  AfterdarkPhase,
  CemeteryZoneId,
  QualityBudget,
  QualityPreset,
} from "./types.js";
import {
  PLAYER_EYE_HEIGHT,
  resolveZoneAtPosition,
  ZONE_TELEPORT_TARGETS,
} from "./engine/collision.js";

export const QUALITY_BUDGETS: Readonly<Record<QualityPreset, QualityBudget>> = {
  low: {
    preset: "low",
    dpr: [1, 1],
    maxDynamicPointLights: 1,
    tombstoneCount: 48,
    deadTreeCount: 20,
    picketDensityStep: 2,
    baseFogDensity: 0.068,
    shadowsEnabled: false,
  },
  medium: {
    preset: "medium",
    dpr: [1, 1.5],
    maxDynamicPointLights: 2,
    tombstoneCount: 84,
    deadTreeCount: 36,
    picketDensityStep: 1,
    baseFogDensity: 0.056,
    shadowsEnabled: false,
  },
  high: {
    preset: "high",
    dpr: [1, 2],
    maxDynamicPointLights: 3,
    tombstoneCount: 120,
    deadTreeCount: 52,
    picketDensityStep: 1,
    baseFogDensity: 0.05,
    shadowsEnabled: true,
  },
};

export function getQualityBudget(preset: QualityPreset): QualityBudget {
  return QUALITY_BUDGETS[preset] ?? QUALITY_BUDGETS.medium;
}

export function readDebugQueryParam(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("debug") === "true";
  } catch {
    return false;
  }
}

export interface AfterdarkState {
  readonly phase: AfterdarkPhase;
  /** 0 = initial blackout, 1 = "2:17 AM", 2 = "Why did you come here?", 3 = "Something is waiting.", 4 = "ENTER THE CEMETERY" */
  readonly typographyStep: 0 | 1 | 2 | 3 | 4;
  readonly gateOpenProgress: number;
  readonly gateLockedBehind: boolean;
  readonly quality: QualityPreset;
  readonly audioUnlocked: boolean;
  readonly audioMuted: boolean;
  readonly pointerLocked: boolean;
  readonly debugEnabled: boolean;
  readonly showCollisionWireframes: boolean;
  readonly lightOverride: boolean;
  readonly playerPosition: readonly [number, number, number];
  readonly playerYaw: number;
  readonly playerPitch: number;
  readonly playerSpeed: number;
  readonly currentZone: CemeteryZoneId;
  readonly fps: number;
  readonly lightningIntensity: number;
  readonly fogDensity: number;
  readonly darknessLevel: number;
  readonly windStrength: number;
  readonly lightningEnabled: boolean;
  readonly encounterTension: number;
  readonly lightModeRestored: boolean;
  readonly virtualMove: readonly [number, number];
  readonly virtualSprint: boolean;
  readonly touchControlsForced: boolean;
  readonly pendingTeleport: {
    readonly position: readonly [number, number, number];
    readonly yaw: number;
    readonly seq: number;
  } | null;

  // Actions
  readonly startSequence: () => void;
  readonly setTypographyStep: (step: 0 | 1 | 2 | 3 | 4) => void;
  readonly beginGateTransition: () => void;
  readonly setGateState: (openProgress: number, lockedBehind: boolean) => void;
  readonly finishGateEntry: () => void;
  readonly setPointerLocked: (locked: boolean) => void;
  readonly setQuality: (preset: QualityPreset) => void;
  readonly toggleMute: () => void;
  readonly toggleDebug: (force?: boolean) => void;
  readonly toggleCollisionWireframes: () => void;
  readonly toggleLightOverride: () => void;
  readonly toggleTouchControls: () => void;
  readonly setVirtualMove: (strafe: number, forward: number) => void;
  readonly setVirtualSprint: (sprint: boolean) => void;
  readonly setPlayerTelemetry: (
    position: readonly [number, number, number],
    yaw: number,
    pitch: number,
    speed: number,
    fps: number,
  ) => void;
  readonly teleportToZone: (zoneId: CemeteryZoneId) => void;
  readonly setLightningIntensity: (intensity: number) => void;
  readonly applyDirectorSettings: (patch: {
    fogDensity?: number;
    darknessLevel?: number;
    windStrength?: number;
    lightningEnabled?: boolean;
    qualityPreset?: QualityPreset;
    debugMode?: boolean;
    lightModeRestored?: boolean;
  }) => void;
  readonly restoreLightMode: () => void;
  readonly resetExperience: () => void;
}

const INITIAL_SPAWN_POS: readonly [number, number, number] = [
  0,
  PLAYER_EYE_HEIGHT,
  36.2,
];

let teleportSeq = 0;

const afterdarkBaseStore = create<AfterdarkState>((set) => ({
  phase: "shutdown",
  typographyStep: 0,
  gateOpenProgress: 0,
  gateLockedBehind: false,
  quality: "medium",
  audioUnlocked: false,
  audioMuted: false,
  pointerLocked: false,
  debugEnabled: readDebugQueryParam(),
  showCollisionWireframes: false,
  lightOverride: false,
  playerPosition: INITIAL_SPAWN_POS,
  playerYaw: 0,
  playerPitch: 0,
  playerSpeed: 0,
  currentZone: "gatehouse",
  fps: 60,
  lightningIntensity: 0,
  fogDensity: QUALITY_BUDGETS.medium.baseFogDensity,
  darknessLevel: 0.94,
  windStrength: 0.65,
  lightningEnabled: true,
  encounterTension: 0.15,
  lightModeRestored: false,
  virtualMove: [0, 0],
  virtualSprint: false,
  touchControlsForced: false,
  pendingTeleport: null,

  startSequence: () =>
    set((s) => ({
      audioUnlocked: true,
      phase: s.phase === "shutdown" ? "typography" : s.phase,
      typographyStep: s.typographyStep === 0 ? 1 : s.typographyStep,
    })),

  setTypographyStep: (step) => set({ typographyStep: step }),

  beginGateTransition: () =>
    set({
      audioUnlocked: true,
      phase: "gate_transition",
      typographyStep: 4,
      gateOpenProgress: 0,
      gateLockedBehind: false,
      playerPosition: INITIAL_SPAWN_POS,
      playerYaw: 0,
      playerPitch: 0.02,
    }),

  setGateState: (gateOpenProgress, gateLockedBehind) =>
    set({ gateOpenProgress, gateLockedBehind }),

  finishGateEntry: () =>
    set({
      phase: "exploration",
      gateOpenProgress: 0,
      gateLockedBehind: true,
      playerPosition: [0, PLAYER_EYE_HEIGHT, 24.8],
      playerYaw: 0,
      playerPitch: 0,
      currentZone: "gatehouse",
    }),

  setPointerLocked: (pointerLocked) => set({ pointerLocked }),

  setQuality: (quality) =>
    set({
      quality,
      fogDensity: getQualityBudget(quality).baseFogDensity,
    }),

  toggleMute: () => set((s) => ({ audioMuted: !s.audioMuted })),

  toggleDebug: (force) =>
    set((s) => ({
      debugEnabled: force !== undefined ? force : !s.debugEnabled,
    })),

  toggleCollisionWireframes: () =>
    set((s) => ({ showCollisionWireframes: !s.showCollisionWireframes })),

  toggleLightOverride: () =>
    set((s) => ({ lightOverride: !s.lightOverride })),

  toggleTouchControls: () =>
    set((s) => ({ touchControlsForced: !s.touchControlsForced })),

  setVirtualMove: (strafe, forward) =>
    set({ virtualMove: [strafe, forward] }),

  setVirtualSprint: (virtualSprint) => set({ virtualSprint }),

  setPlayerTelemetry: (playerPosition, playerYaw, playerPitch, playerSpeed, fps) =>
    set({
      playerPosition,
      playerYaw,
      playerPitch,
      playerSpeed,
      fps,
      currentZone: resolveZoneAtPosition(playerPosition[0], playerPosition[2]),
    }),

  teleportToZone: (zoneId) => {
    const target = ZONE_TELEPORT_TARGETS.find((t) => t.zoneId === zoneId);
    if (!target) return;
    teleportSeq += 1;
    set({
      phase: "exploration",
      gateLockedBehind: true,
      gateOpenProgress: 0,
      playerPosition: target.position,
      playerYaw: target.yaw,
      playerPitch: 0,
      currentZone: target.zoneId,
      pendingTeleport: {
        position: target.position,
        yaw: target.yaw,
        seq: teleportSeq,
      },
    });
  },

  setLightningIntensity: (lightningIntensity) => set({ lightningIntensity }),

  applyDirectorSettings: (patch) =>
    set((s) => ({
      fogDensity: patch.fogDensity ?? s.fogDensity,
      darknessLevel: patch.darknessLevel ?? s.darknessLevel,
      windStrength: patch.windStrength ?? s.windStrength,
      lightningEnabled: patch.lightningEnabled ?? s.lightningEnabled,
      quality: patch.qualityPreset ?? s.quality,
      debugEnabled: patch.debugMode ?? s.debugEnabled,
      lightModeRestored: patch.lightModeRestored ?? s.lightModeRestored,
      phase: patch.lightModeRestored ? "restored_light" : s.phase,
    })),

  restoreLightMode: () =>
    set({
      lightModeRestored: true,
      phase: "restored_light",
      pointerLocked: false,
      darknessLevel: 0.05,
    }),

  resetExperience: () => {
    teleportSeq += 1;
    set({
      phase: "shutdown",
      typographyStep: 0,
      gateOpenProgress: 0,
      gateLockedBehind: false,
      pointerLocked: false,
      lightModeRestored: false,
      darknessLevel: 0.94,
      lightningIntensity: 0,
      playerPosition: INITIAL_SPAWN_POS,
      playerYaw: 0,
      playerPitch: 0,
      playerSpeed: 0,
      currentZone: "gatehouse",
      pendingTeleport: {
        position: INITIAL_SPAWN_POS,
        yaw: 0,
        seq: teleportSeq,
      },
    });
  },
}));

/**
 * React 19 SSR-consistent store hook so `renderToStaticMarkup` and client renders
 * read the same live state snapshot without Zustand's `getInitialState()` mismatch.
 */
export function useAfterdarkStore(): AfterdarkState;
export function useAfterdarkStore<T>(selector: (state: AfterdarkState) => T): T;
export function useAfterdarkStore<T>(
  selector?: (state: AfterdarkState) => T,
): AfterdarkState | T {
  const select = selector ?? ((s: AfterdarkState) => s as unknown as T);
  return useSyncExternalStore(
    afterdarkBaseStore.subscribe,
    () => select(afterdarkBaseStore.getState()),
    () => select(afterdarkBaseStore.getState()),
  );
}

useAfterdarkStore.getState = afterdarkBaseStore.getState;
useAfterdarkStore.setState = afterdarkBaseStore.setState;
useAfterdarkStore.subscribe = afterdarkBaseStore.subscribe;
useAfterdarkStore.getInitialState = afterdarkBaseStore.getInitialState;
