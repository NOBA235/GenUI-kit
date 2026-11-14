import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { getAfterdarkSoundscape } from "./audio/soundscape.js";
import {
  PLAYER_EYE_HEIGHT,
  resolveZoneAtPosition,
  ZONE_TELEPORT_TARGETS,
} from "./engine/collision.js";
import {
  createVisualEncounterSpec,
  getEncounterById,
} from "./engine/world-data.js";
import type {
  ActiveVisualEncounter,
  AfterdarkPhase,
  CemeteryZoneId,
  ClueId,
  EncounterId,
  QualityBudget,
  QualityPreset,
} from "./types.js";

const AFTERDARK_PROGRESS_STORAGE_KEY = "afterdark-archive-progress-v2";

interface PersistedArchiveProgress {
  readonly discoveredClues: readonly ClueId[];
  readonly triggeredEncounters: readonly EncounterId[];
  readonly weepingGuideActive: boolean;
}

function readPersistedProgress(): PersistedArchiveProgress {
  if (typeof window === "undefined") {
    return {
      discoveredClues: [],
      triggeredEncounters: [],
      weepingGuideActive: false,
    };
  }
  try {
    const raw = window.localStorage.getItem(AFTERDARK_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return {
        discoveredClues: [],
        triggeredEncounters: [],
        weepingGuideActive: false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedArchiveProgress>;
    const validClues: ClueId[] = ["clue-01", "clue-02", "clue-03"];
    const validEncs: EncounterId[] = [
      "enc-01",
      "enc-02",
      "enc-03",
      "enc-04",
      "enc-05",
    ];
    return {
      discoveredClues: Array.isArray(parsed.discoveredClues)
        ? parsed.discoveredClues.filter((c): c is ClueId => validClues.includes(c))
        : [],
      triggeredEncounters: Array.isArray(parsed.triggeredEncounters)
        ? parsed.triggeredEncounters.filter((e): e is EncounterId =>
            validEncs.includes(e),
          )
        : [],
      weepingGuideActive: Boolean(parsed.weepingGuideActive),
    };
  } catch {
    return {
      discoveredClues: [],
      triggeredEncounters: [],
      weepingGuideActive: false,
    };
  }
}

function writePersistedProgress(progress: PersistedArchiveProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AFTERDARK_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    );
  } catch {
    // Ignore storage quota or sandbox restrictions
  }
}

export const QUALITY_BUDGETS: Readonly<Record<QualityPreset, QualityBudget>> = {
  low: {
    preset: "low",
    dpr: [1, 1],
    maxDynamicPointLights: 1,
    tombstoneCount: 48,
    celticCrossCount: 10,
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
    celticCrossCount: 18,
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
    celticCrossCount: 24,
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

  // Milestone 2: Interaction, 3-Clue Chain & 5 Supernatural Encounters
  readonly discoveredClues: readonly ClueId[];
  readonly activeInteractableId: ClueId | null;
  readonly activeReaderClueId: ClueId | null;
  readonly chapelBeaconPulseUntil: number;
  readonly triggeredEncounters: readonly EncounterId[];
  readonly activeVisualEncounter: ActiveVisualEncounter | null;
  readonly encounterCooldownUntil: Readonly<Partial<Record<EncounterId, number>>>;
  readonly encounterSubtitle: string | null;
  readonly weepingGuideActive: boolean;
  readonly cryptIntimidationActive: boolean;

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

  // Milestone 2 Actions
  readonly setActiveInteractable: (id: ClueId | null) => void;
  readonly examineClue: (id: ClueId) => void;
  readonly closeClueReader: () => void;
  readonly revealClue: (id: ClueId) => void;
  readonly resetClues: () => void;
  readonly triggerEncounter: (
    id: EncounterId,
    nowMs?: number,
    manualDebug?: boolean,
  ) => void;
  readonly clearVisualEncounter: (dissipatedGarden?: boolean) => void;
  readonly setCryptIntimidation: (active: boolean) => void;
}

const INITIAL_SPAWN_POS: readonly [number, number, number] = [
  0,
  PLAYER_EYE_HEIGHT,
  36.2,
];

const initialPersisted = readPersistedProgress();
let teleportSeq = 0;

function playEncounterCueAudio(id: EncounterId): void {
  const audio = getAfterdarkSoundscape();
  switch (id) {
    case "enc-01":
      audio.playBranchCreak();
      audio.playRearWhisperCue();
      break;
    case "enc-02":
      audio.playMovingShadowRustle();
      break;
    case "enc-03":
      audio.playWeepingAudio(-0.4);
      break;
    case "enc-04":
      audio.playPresenceWhisperSteps();
      break;
    case "enc-05":
      audio.playCryptWarningSpike();
      audio.setIntimidationLevel(1.0);
      break;
  }
}

const afterdarkBaseStore = create<AfterdarkState>((set, get) => ({
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

  discoveredClues: initialPersisted.discoveredClues,
  activeInteractableId: null,
  activeReaderClueId: null,
  chapelBeaconPulseUntil: 0,
  triggeredEncounters: initialPersisted.triggeredEncounters,
  activeVisualEncounter: null,
  encounterCooldownUntil: {},
  encounterSubtitle: null,
  weepingGuideActive: initialPersisted.weepingGuideActive,
  cryptIntimidationActive: false,

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
      currentZone: resolveZoneAtPosition(
        playerPosition[0],
        playerPosition[2],
        playerPosition[1],
      ),
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
      cryptIntimidationActive: target.zoneId === "crypt_entrance",
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
      activeReaderClueId: null,
      activeVisualEncounter: null,
      encounterSubtitle: null,
      cryptIntimidationActive: false,
    }),

  resetExperience: () => {
    teleportSeq += 1;
    getAfterdarkSoundscape().setIntimidationLevel(0);
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
      activeInteractableId: null,
      activeReaderClueId: null,
      activeVisualEncounter: null,
      encounterCooldownUntil: {},
      encounterSubtitle: null,
      cryptIntimidationActive: false,
      pendingTeleport: {
        position: INITIAL_SPAWN_POS,
        yaw: 0,
        seq: teleportSeq,
      },
    });
  },

  setActiveInteractable: (activeInteractableId) =>
    set((s) =>
      s.activeInteractableId === activeInteractableId
        ? s
        : { activeInteractableId },
    ),

  examineClue: (id) => {
    const s = get();
    const discoveredClues = s.discoveredClues.includes(id)
      ? s.discoveredClues
      : [...s.discoveredClues, id];
    getAfterdarkSoundscape().playClueChime();
    writePersistedProgress({
      discoveredClues,
      triggeredEncounters: [...s.triggeredEncounters],
      weepingGuideActive: s.weepingGuideActive,
    });
    set({
      discoveredClues,
      activeReaderClueId: id,
      chapelBeaconPulseUntil:
        id === "clue-01" ? Date.now() + 9000 : s.chapelBeaconPulseUntil,
    });
  },

  closeClueReader: () => set({ activeReaderClueId: null }),

  revealClue: (id) => {
    const s = get();
    const discoveredClues = s.discoveredClues.includes(id)
      ? s.discoveredClues
      : [...s.discoveredClues, id];
    writePersistedProgress({
      discoveredClues,
      triggeredEncounters: [...s.triggeredEncounters],
      weepingGuideActive: s.weepingGuideActive,
    });
    set({
      discoveredClues,
      activeReaderClueId: id,
      chapelBeaconPulseUntil:
        id === "clue-01" ? Date.now() + 9000 : s.chapelBeaconPulseUntil,
    });
  },

  resetClues: () => {
    writePersistedProgress({
      discoveredClues: [],
      triggeredEncounters: [],
      weepingGuideActive: false,
    });
    set({
      discoveredClues: [],
      triggeredEncounters: [],
      weepingGuideActive: false,
      activeReaderClueId: null,
      activeInteractableId: null,
    });
  },

  triggerEncounter: (id, nowMs = Date.now(), manualDebug = false) => {
    const s = get();
    const def = getEncounterById(id);
    if (!manualDebug) {
      const readyAt = s.encounterCooldownUntil[id] ?? 0;
      if (nowMs < readyAt) return;
    }

    const visual = createVisualEncounterSpec(
      id,
      s.playerPosition,
      s.playerYaw,
      nowMs,
    );
    const triggeredEncounters = s.triggeredEncounters.includes(id)
      ? s.triggeredEncounters
      : [...s.triggeredEncounters, id];

    playEncounterCueAudio(id);
    writePersistedProgress({
      discoveredClues: [...s.discoveredClues],
      triggeredEncounters,
      weepingGuideActive: s.weepingGuideActive || id === "enc-03",
    });

    set({
      activeVisualEncounter: visual,
      triggeredEncounters,
      encounterCooldownUntil: {
        ...s.encounterCooldownUntil,
        [id]: nowMs + def.cooldownSeconds * 1000,
      },
      encounterSubtitle: def.whisperLine ?? null,
      weepingGuideActive: s.weepingGuideActive || id === "enc-03",
      encounterTension: id === "enc-05" ? 0.92 : 0.65,
      cryptIntimidationActive:
        id === "enc-05" ? true : s.cryptIntimidationActive,
    });
  },

  clearVisualEncounter: (dissipatedGarden = false) => {
    const s = get();
    const weepingGuideActive = s.weepingGuideActive || dissipatedGarden;
    if (dissipatedGarden) {
      writePersistedProgress({
        discoveredClues: [...s.discoveredClues],
        triggeredEncounters: [...s.triggeredEncounters],
        weepingGuideActive: true,
      });
    }
    set({
      activeVisualEncounter: null,
      encounterSubtitle: null,
      weepingGuideActive,
      encounterTension: s.cryptIntimidationActive ? 0.65 : 0.18,
    });
  },

  setCryptIntimidation: (cryptIntimidationActive) => {
    const prev = get().cryptIntimidationActive;
    if (prev === cryptIntimidationActive) return;
    getAfterdarkSoundscape().setIntimidationLevel(
      cryptIntimidationActive ? 0.85 : 0,
    );
    set({
      cryptIntimidationActive,
      encounterTension: cryptIntimidationActive ? 0.82 : 0.18,
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
