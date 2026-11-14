export type AfterdarkPhase =
  | "shutdown"
  | "typography"
  | "gate_transition"
  | "exploration"
  | "restoring_light"
  | "restored_light";

export type QualityPreset = "low" | "medium" | "high";

export type CemeteryZoneId =
  | "gatehouse"
  | "central_path"
  | "forgotten_graves"
  | "dead_garden"
  | "weeping_grove"
  | "mausoleum"
  | "chapel_steps"
  | "crypt_entrance";

export type ClueId = "clue-01" | "clue-02" | "clue-03";
export type InteractableId = ClueId | "light-switch";
export type TransformationStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type LightingPreviewPreset = "storm" | "crypt" | "dawn";

export type EncounterId =
  | "enc-01"
  | "enc-02"
  | "enc-03"
  | "enc-04"
  | "enc-05";

export interface ClueRecord {
  readonly id: ClueId;
  readonly numberLabel: string;
  readonly title: string;
  readonly zoneId: CemeteryZoneId;
  readonly zoneLabel: string;
  readonly yearStamped: string;
  readonly inscription: string;
  readonly keeperNote: string;
  readonly promptLabel: string;
  readonly position: readonly [number, number, number];
  readonly examineRadius: number;
}

export interface EncounterDefinition {
  readonly id: EncounterId;
  readonly code: string;
  readonly name: string;
  readonly zoneId: CemeteryZoneId;
  readonly triggerCenter: readonly [number, number, number];
  readonly triggerRadius: number;
  readonly cooldownSeconds: number;
  readonly whisperLine?: string;
}

export interface ActiveVisualEncounter {
  readonly id: EncounterId;
  readonly name: string;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly moveTarget?: readonly [number, number, number];
}

export interface QualityBudget {
  readonly preset: QualityPreset;
  readonly dpr: readonly [number, number];
  readonly maxDynamicPointLights: number;
  readonly tombstoneCount: number;
  readonly celticCrossCount: number;
  readonly deadTreeCount: number;
  readonly picketDensityStep: number;
  readonly baseFogDensity: number;
  readonly shadowsEnabled: boolean;
}

export interface AABBCollider {
  readonly id: string;
  readonly kind:
    | "wall"
    | "pillar"
    | "gate"
    | "mausoleum"
    | "chapel"
    | "approach"
    | "fountain"
    | "bench"
    | "crypt"
    | "sarcophagus";
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly height: number;
  /** Optional vertical span (ground-level defaults ~[-0.8, 12]; crypt colliders use [-6, -0.6]) */
  readonly minY?: number;
  readonly maxY?: number;
}

export interface CircleCollider {
  readonly id: string;
  readonly kind:
    | "tombstone"
    | "tree"
    | "lantern"
    | "monument"
    | "fountain"
    | "statue";
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  readonly minY?: number;
  readonly maxY?: number;
}

export interface TombstoneInstanceSpec {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly rotY: number;
  readonly tiltX: number;
  readonly tiltZ: number;
  readonly scaleY: number;
  readonly variant: "lancet" | "obelisk" | "celtic";
}

export interface DeadTreeInstanceSpec {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly rotY: number;
  readonly scale: number;
}

export interface LanternSpec {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly baseIntensity: number;
  readonly flickerSeed: number;
}

export interface ZoneTeleportTarget {
  readonly zoneId: CemeteryZoneId;
  readonly code: "A" | "B" | "C" | "D" | "E";
  readonly label: string;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
}
