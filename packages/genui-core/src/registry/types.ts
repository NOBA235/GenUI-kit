/**
 * Agent-Ready Template Pack Specification & Shadcn-compatible Registry Types.
 */

export type PackTier = "free" | "pro";

export type PackCategory =
  | "finops"
  | "spatial-3d"
  | "analytics"
  | "sre"
  | "dashboard";

export interface PackComponentMetadata {
  readonly name: string;
  readonly description: string;
  readonly slots: readonly string[];
  readonly hasFallbackProps: boolean;
}

export interface PackFileItem {
  readonly path: string;
  readonly type:
    | "registry:ui"
    | "registry:block"
    | "registry:catalog"
    | "registry:skill"
    | "registry:power"
    | "registry:test"
    | "registry:config";
  readonly content: string;
  readonly target?: string;
}

export interface AgentSkillMetadata {
  /** SKILL.md for Claude Code, Cursor, and general agent skills */
  readonly skillMd: string;
  /** POWER.md for Kiro Powers */
  readonly kiroPowerMd: string;
  /** .kiro/steering markdown rules for permanent agent guidance */
  readonly steeringRules: string;
}

export interface PbtSuiteMetadata {
  readonly code: string;
  readonly theorems: readonly string[];
}

export interface AgentReadyPackManifest {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly author: string;
  readonly license: "MIT" | "Commercial-Single" | "Commercial-Team";
  readonly tier: PackTier;
  readonly priceUsd: number;
  readonly category: PackCategory;
  readonly tags: readonly string[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly catalogHash: string;
  readonly components: readonly PackComponentMetadata[];
  readonly files: readonly PackFileItem[];
  readonly agentSkill: AgentSkillMetadata;
  readonly pbtSuite: PbtSuiteMetadata;
}

/**
 * Standard shadcn CLI compatible registry item format.
 */
export interface ShadcnRegistryItem {
  readonly $schema?: string;
  readonly name: string;
  readonly type: "registry:ui" | "registry:block";
  readonly title?: string;
  readonly description?: string;
  readonly dependencies?: readonly string[];
  readonly devDependencies?: readonly string[];
  readonly registryDependencies?: readonly string[];
  readonly files: readonly {
    readonly path: string;
    readonly content: string;
    readonly type: string;
    readonly target?: string;
  }[];
  readonly meta?: Record<string, unknown>;
}

export interface RegistryApiResponse {
  readonly success: boolean;
  readonly packId: string;
  readonly tier: PackTier;
  readonly requiresLicense: boolean;
  readonly licenseValid?: boolean;
  readonly error?: string;
  readonly item?: ShadcnRegistryItem;
  readonly pack?: AgentReadyPackManifest;
}
