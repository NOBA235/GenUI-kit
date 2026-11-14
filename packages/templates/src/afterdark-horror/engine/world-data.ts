import type {
  ActiveVisualEncounter,
  ClueId,
  ClueRecord,
  EncounterDefinition,
  EncounterId,
  TransformationStage,
} from "../types.js";

export const LIGHT_MODE_SWITCH_SPEC = {
  id: "light-switch" as const,
  switchId: "breaker-01",
  plaqueLabel: "LIGHT MODE",
  promptLabel: "Press [E] to Activate LIGHT MODE",
  position: [-4.0, -3.2, -50.22] as readonly [number, number, number],
  standPoint: [-4.0, -4.5 + 1.7, -52.1] as readonly [number, number, number],
  interactRadius: 4.4,
} as const;

export interface TransformationStageMeta {
  readonly stage: TransformationStage;
  readonly minSeconds: number;
  readonly cueText: string;
}

/** Deterministic 10-Stage Cinematic Transformation Sequence (6.2s total) */
export const TRANSFORMATION_SEQUENCE_STAGES: readonly TransformationStageMeta[] = [
  { stage: 1, minSeconds: 0.0, cueText: "STAGE 01 · FOCUSING CRYPT BREAKER" },
  { stage: 2, minSeconds: 0.4, cueText: "STAGE 02 · THROWING IRON LEVER TO ON" },
  { stage: 3, minSeconds: 0.9, cueText: "STAGE 03 · MECHANICAL CONTACT ENGAGED" },
  { stage: 4, minSeconds: 1.4, cueText: "STAGE 04 · DEEP TRANSFORMER SURGE" },
  { stage: 5, minSeconds: 2.0, cueText: "STAGE 05 · CRYPT & CHAPEL CASCADE" },
  { stage: 6, minSeconds: 2.7, cueText: "STAGE 06 · CEMETERY LANTERN IGNITION" },
  { stage: 7, minSeconds: 3.4, cueText: "STAGE 07 · VOLUMETRIC FOG DISSIPATION" },
  { stage: 8, minSeconds: 4.1, cueText: "STAGE 08 · DAWN SKYBOX TRANSITION" },
  { stage: 9, minSeconds: 4.9, cueText: "STAGE 09 · CEMETERY ARCHITECTURE REVEAL" },
  { stage: 10, minSeconds: 5.7, cueText: "STAGE 10 · RESTORED EDITORIAL CROSSFADE" },
];

export function resolveTransformationStage(
  elapsedSeconds: number,
): TransformationStage {
  let stage: TransformationStage = 1;
  for (const s of TRANSFORMATION_SEQUENCE_STAGES) {
    if (elapsedSeconds >= s.minSeconds) {
      stage = s.stage;
    }
  }
  return stage;
}

export const TOTAL_TRANSFORMATION_DURATION = 6.2;

export const CLUE_RECORDS: readonly ClueRecord[] = [
  {
    id: "clue-01",
    numberLabel: "CLUE 01",
    title: "The Grave Inscription",
    zoneId: "forgotten_graves",
    zoneLabel: "Zone B · Forgotten Graves",
    yearStamped: "1894",
    inscription: "THE LIGHT WAS NEVER LOST. IT WAS HIDDEN.",
    keeperNote:
      "Chiseled unevenly below the mossy crest. As the dust settles, a distant sanctuary lantern North toward the Gothic Chapel flares faintly through the mist.",
    promptLabel: "Press [E] to Examine Weathered Grave Inscription",
    position: [-7.2, 1.12, 12.2],
    examineRadius: 4.1,
  },
  {
    id: "clue-02",
    numberLabel: "CLUE 02",
    title: "The Chapel Altar Message",
    zoneId: "chapel_steps",
    zoneLabel: "Zone D · Abandoned Gothic Chapel",
    yearStamped: "1902",
    inscription: "WHEN THE WORLD WENT DARK, THE KEEPER LEFT A WAY BACK.",
    keeperNote:
      "Deep gouges mark the fractured marble behind the candelabra—not prayer, but an engineer's emergency diagram pointing toward the Dead Garden aqueduct and the steps leading beneath this nave.",
    promptLabel: "Press [E] to Examine Altar Inscription",
    position: [0.0, 1.45, -40.3],
    examineRadius: 4.2,
  },
  {
    id: "clue-03",
    numberLabel: "CLUE 03",
    title: "The Caretaker's Note",
    zoneId: "dead_garden",
    zoneLabel: "Zone C/D Concealed Fountain Passage",
    yearStamped: "OCT 31 · 02:14 AM",
    inscription:
      "If the grid fails again, do not look for switches along the upper nave. Descend the east chapel stairs into Zone E, follow the stone sarcophagi West behind the sealed arch, and trip the concealed LIGHT MODE breaker before the storm floods the vault.",
    keeperNote:
      "Pinned under an iron oil lantern on the stone lectern at the northern exit behind the Dead Garden fountain.",
    promptLabel: "Press [E] to Read Caretaker's Note",
    position: [-11.2, 1.05, -24.5],
    examineRadius: 4.1,
  },
];

export const ENCOUNTER_DEFINITIONS: readonly EncounterDefinition[] = [
  {
    id: "enc-01",
    code: "ENC-01",
    name: "The Watcher",
    zoneId: "forgotten_graves",
    triggerCenter: [8.4, 0, 9.2],
    triggerRadius: 13.5,
    cooldownSeconds: 20,
    whisperLine: "Something tall stands motionless between the obelisks.",
  },
  {
    id: "enc-02",
    code: "ENC-02",
    name: "The Moving Shadow",
    zoneId: "dead_garden",
    triggerCenter: [-12.0, 0, -2.5],
    triggerRadius: 6.2,
    cooldownSeconds: 24,
    whisperLine: "Dry leaves snap ahead as a dark figure darts across the fountain path.",
  },
  {
    id: "enc-03",
    code: "ENC-03",
    name: "The Weeping Woman",
    zoneId: "dead_garden",
    triggerCenter: [-17.4, 0, -10.5],
    triggerRadius: 9.5,
    cooldownSeconds: 28,
    whisperLine: "A veiled figure dissolves beside the crumbling fountain, trailing embers northward.",
  },
  {
    id: "enc-04",
    code: "ENC-04",
    name: "The Presence",
    zoneId: "chapel_steps",
    triggerCenter: [0.0, 0, -24.0],
    triggerRadius: 7.5,
    cooldownSeconds: 26,
    whisperLine: "You're looking in the wrong direction.",
  },
  {
    id: "enc-05",
    code: "ENC-05",
    name: "The Final Warning",
    zoneId: "crypt_entrance",
    triggerCenter: [1.5, -4.5, -55.0],
    triggerRadius: 11.5,
    cooldownSeconds: 30,
    whisperLine: "TURN BACK BEFORE THE BREAKER SEALS YOU BELOW.",
  },
];

export function getClueById(id: ClueId): ClueRecord {
  return CLUE_RECORDS.find((c) => c.id === id) ?? CLUE_RECORDS[0]!;
}

export function getEncounterById(id: EncounterId): EncounterDefinition {
  return ENCOUNTER_DEFINITIONS.find((e) => e.id === id) ?? ENCOUNTER_DEFINITIONS[0]!;
}

/**
 * Computes cosine similarity between camera forward look ray and vector toward a world target.
 * Camera yaw = 0 looks straight North (-Z); pitch > 0 looks upward.
 */
export function computeLookDotProduct(
  camPos: readonly [number, number, number],
  yaw: number,
  pitch: number,
  targetPos: readonly [number, number, number],
): number {
  const cosP = Math.cos(pitch);
  const lookX = -Math.sin(yaw) * cosP;
  const lookY = Math.sin(pitch);
  const lookZ = -Math.cos(yaw) * cosP;

  const dx = targetPos[0] - camPos[0];
  const dy = targetPos[1] - camPos[1];
  const dz = targetPos[2] - camPos[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-5) return 1;

  return (lookX * dx + lookY * dy + lookZ * dz) / len;
}

/**
 * Pure deterministic raycast-cone + proximity evaluator returning the best focused ClueRecord.
 */
export function evaluateInteractableFocus(
  playerPos: readonly [number, number, number],
  yaw: number,
  pitch: number,
): ClueRecord | null {
  let bestClue: ClueRecord | null = null;
  let bestScore = -Infinity;

  for (const clue of CLUE_RECORDS) {
    // Reject vertical level mismatch (ground vs deep crypt)
    if (Math.abs(playerPos[1] - clue.position[1]) > 3.0) {
      continue;
    }

    const dx = clue.position[0] - playerPos[0];
    const dy = clue.position[1] - playerPos[1];
    const dz = clue.position[2] - playerPos[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist > clue.examineRadius) {
      continue;
    }

    const dot = computeLookDotProduct(playerPos, yaw, pitch, clue.position);
    // Allow generous examination cone (dot >= 0.62) OR close body proximity (<= 2.2m)
    if (dot >= 0.62 || dist <= 2.2) {
      const score = dot * 2.0 - dist * 0.25;
      if (score > bestScore) {
        bestScore = score;
        bestClue = clue;
      }
    }
  }

  return bestClue;
}

/**
 * Pure deterministic focus evaluator for the physical Zone E LIGHT MODE switch.
 */
export function evaluateLightSwitchFocus(
  playerPos: readonly [number, number, number],
  yaw: number,
  pitch: number,
): boolean {
  if (playerPos[1] > 0.2) return false;
  const swPos = LIGHT_MODE_SWITCH_SPEC.position;
  const dist = Math.hypot(
    swPos[0] - playerPos[0],
    swPos[1] - playerPos[1],
    swPos[2] - playerPos[2],
  );
  if (dist > LIGHT_MODE_SWITCH_SPEC.interactRadius) return false;
  const dot = computeLookDotProduct(playerPos, yaw, pitch, swPos);
  return dot >= 0.52 || dist <= 2.35;
}

export interface EncounterTickInput {
  readonly playerPosition: readonly [number, number, number];
  readonly playerYaw: number;
  readonly playerPitch: number;
  readonly nowMs: number;
  readonly cooldownUntilById: Readonly<Partial<Record<EncounterId, number>>>;
  readonly activeVisual: ActiveVisualEncounter | null;
}

export interface EncounterTickDecision {
  readonly triggerId: EncounterId | null;
  readonly vanishActive: boolean;
  readonly illuminateGardenTrail: boolean;
  readonly cryptIntimidation: boolean;
}

/**
 * Pure stateful cooldown + viewing-angle evaluator for all 5 Supernatural Encounters.
 */
export function evaluateEncounterProximity(
  input: EncounterTickInput,
): EncounterTickDecision {
  const {
    playerPosition,
    playerYaw,
    playerPitch,
    nowMs,
    cooldownUntilById,
    activeVisual,
  } = input;

  let vanishActive = false;
  let illuminateGardenTrail = false;

  // Evaluate active entity interaction (e.g. direct gaze / close approach)
  if (activeVisual) {
    const distToEntity = Math.hypot(
      activeVisual.position[0] - playerPosition[0],
      activeVisual.position[2] - playerPosition[2],
    );
    const gazeDot = computeLookDotProduct(
      playerPosition,
      playerYaw,
      playerPitch,
      [
        activeVisual.position[0],
        activeVisual.position[1] + 1.45,
        activeVisual.position[2],
      ],
    );

    if (nowMs - activeVisual.startedAtMs >= activeVisual.durationMs) {
      vanishActive = true;
    } else if (activeVisual.id === "enc-01") {
      // Watcher vanishes after player stares directly (>= 0.45s grace) or gets close
      if (
        (nowMs - activeVisual.startedAtMs > 450 && gazeDot > 0.89) ||
        distToEntity < 5.6
      ) {
        vanishActive = true;
      }
    } else if (activeVisual.id === "enc-03") {
      // Weeping Woman dissipates on close approach and reveals the north trail
      if (distToEntity < 4.4) {
        vanishActive = true;
        illuminateGardenTrail = true;
      }
    } else if (activeVisual.id === "enc-04") {
      // Presence lingers briefly after turning around (0.65s), then snaps away
      if (nowMs - activeVisual.startedAtMs > 650 && gazeDot > 0.72 && distToEntity < 6.5) {
        vanishActive = true;
      }
    }
  }

  // Only trigger a new scripted encounter when none is currently playing
  let triggerId: EncounterId | null = null;
  if (!activeVisual) {
    for (const def of ENCOUNTER_DEFINITIONS) {
      const readyAt = cooldownUntilById[def.id] ?? 0;
      if (nowMs < readyAt) continue;

      // Vertical gating: Enc-05 is subterranean (y < -2.2), surface encounters need y > -1.0
      if (def.id === "enc-05") {
        if (playerPosition[1] > -1.8) continue;
      } else if (playerPosition[1] < -1.0) {
        continue;
      }

      const dist = Math.hypot(
        playerPosition[0] - def.triggerCenter[0],
        playerPosition[2] - def.triggerCenter[2],
      );

      if (dist <= def.triggerRadius) {
        triggerId = def.id;
        break;
      }
    }
  }

  const cryptIntimidation =
    playerPosition[1] < -1.8 && playerPosition[2] < -49.0;

  return {
    triggerId,
    vanishActive,
    illuminateGardenTrail,
    cryptIntimidation,
  };
}

/**
 * Builds visual spawn parameters for any manually or automatically triggered encounter.
 */
export function createVisualEncounterSpec(
  id: EncounterId,
  playerPosition: readonly [number, number, number],
  playerYaw: number,
  nowMs: number,
): ActiveVisualEncounter {
  const def = getEncounterById(id);

  switch (id) {
    case "enc-01": {
      // Stand between graves near [8.4, 0, 9.2], or behind frustum if player is already right beside it
      const distDefault = Math.hypot(
        playerPosition[0] - 8.4,
        playerPosition[2] - 9.2,
      );
      const spawnPos: [number, number, number] =
        distDefault < 7.5
          ? [
              Number((playerPosition[0] + Math.sin(playerYaw) * 8.5).toFixed(2)),
              0,
              Number((playerPosition[2] + Math.cos(playerYaw) * 8.5).toFixed(2)),
            ]
          : [8.4, 0, 9.2];
      return {
        id,
        name: def.name,
        position: spawnPos,
        yaw: Math.atan2(playerPosition[0] - spawnPos[0], playerPosition[2] - spawnPos[2]),
        startedAtMs: nowMs,
        durationMs: 11000,
      };
    }

    case "enc-02":
      return {
        id,
        name: def.name,
        position: [-10.5, 0, -6.5],
        yaw: -Math.PI / 2,
        moveTarget: [-21.5, 0, -9.2],
        startedAtMs: nowMs,
        durationMs: 1550,
      };

    case "enc-03":
      return {
        id,
        name: def.name,
        position: [-17.4, 0, -10.5],
        yaw: 0.65,
        startedAtMs: nowMs,
        durationMs: 16000,
      };

    case "enc-04": {
      // Spawn behind player (camera backward direction is +sin(yaw), +cos(yaw))
      const behindX = playerPosition[0] + Math.sin(playerYaw) * 4.4;
      const behindZ = playerPosition[2] + Math.cos(playerYaw) * 4.4;
      return {
        id,
        name: def.name,
        position: [Number(behindX.toFixed(2)), 0, Number(behindZ.toFixed(2))],
        yaw: Math.atan2(-Math.sin(playerYaw), -Math.cos(playerYaw)),
        startedAtMs: nowMs,
        durationMs: 4200,
      };
    }

    case "enc-05":
      return {
        id,
        name: def.name,
        position: [-4.2, -4.5, -51.4],
        yaw: 0.4,
        startedAtMs: nowMs,
        durationMs: 6500,
      };
  }
}
