export type AfterdarkPhase =
  | "shutdown"
  | "typography"
  | "gate_transition"
  | "exploration"
  | "restored_light";

export type QualityPreset = "low" | "medium" | "high";

export type CemeteryZoneId =
  | "gatehouse"
  | "central_path"
  | "weeping_grove"
  | "mausoleum"
  | "chapel_steps"
  | "crypt_entrance";

export interface QualityBudget {
  readonly preset: QualityPreset;
  readonly dpr: readonly [number, number];
  readonly maxDynamicPointLights: number;
  readonly tombstoneCount: number;
  readonly deadTreeCount: number;
  readonly picketDensityStep: number;
  readonly baseFogDensity: number;
  readonly shadowsEnabled: boolean;
}

export interface AABBCollider {
  readonly id: string;
  readonly kind: "wall" | "pillar" | "gate" | "mausoleum" | "chapel" | "approach";
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly height: number;
}

export interface CircleCollider {
  readonly id: string;
  readonly kind: "tombstone" | "tree" | "lantern" | "monument";
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
}

export interface TombstoneInstanceSpec {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly rotY: number;
  readonly tiltX: number;
  readonly tiltZ: number;
  readonly scaleY: number;
  readonly variant: "lancet" | "obelisk";
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
  readonly label: string;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
}
