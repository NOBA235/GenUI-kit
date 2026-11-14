import type { Spec } from "@json-render/core";
import type { ComponentRegistry } from "@json-render/react";
import type { VerifiedCatalog } from "@genui-studio/core";

export type TemplateMode = "native" | "standalone";

export const MARKETPLACE_FILTER_TAGS = [
  "3D / WebGL",
  "B2B SaaS",
  "E-Commerce",
  "Web3 / DeFi",
  "Full-Stack Standalone",
  "GenUI Verified",
] as const;

export type MarketplaceFilterTag = (typeof MARKETPLACE_FILTER_TAGS)[number];

export interface TemplateThemeConfig {
  readonly defaultColorScheme: "dark" | "light";
  readonly accentColor: string;
  readonly surfaceBg: string;
  readonly surfaceElevated?: string;
  readonly textColor: string;
  readonly mutedColor?: string;
  readonly displayFont: string;
  readonly bodyFont: string;
  readonly borderRadius: string;
}

export interface TemplatePageDefinition {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly route: string;
  readonly description?: string;
  readonly sections: readonly string[];
}

export interface TemplateRemixPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly prompt: string;
  readonly patchesJsonl?: string;
}

export interface StandaloneProjectMeta {
  readonly sourceDir: string;
  readonly framework: "nextjs-app" | "nextjs-pages" | "react-vite" | "react";
  readonly packageName: string;
  readonly entryFiles: readonly string[];
  readonly detectedPages: readonly string[];
  readonly detectedSections: readonly string[];
  readonly fileCount: number;
  readonly ingestedAt: string;
}

export interface TemplateManifest {
  readonly slug: string;
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly mode: TemplateMode;
  readonly version: string;
  readonly author: string;
  readonly license: "MIT" | "Commercial-Single" | "Commercial-Team";
  readonly tier: "free" | "pro";
  readonly priceUsd: number;
  readonly category: string;
  readonly tags: readonly string[];
  readonly verified: boolean;
  readonly immersiveExperience?: boolean;
  readonly theme: TemplateThemeConfig;
  readonly pages: readonly TemplatePageDefinition[];
  readonly remixPresets?: readonly TemplateRemixPreset[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly standaloneMeta?: StandaloneProjectMeta;
}

export type TemplateFileKind =
  | "catalog"
  | "component"
  | "theme"
  | "manifest"
  | "steering"
  | "skill"
  | "power"
  | "source"
  | "config";

export interface TemplateSourceFile {
  readonly path: string;
  readonly content: string;
  readonly kind: TemplateFileKind;
}

export interface DualModeTemplateEntry {
  readonly manifest: TemplateManifest;
  readonly catalog: VerifiedCatalog<any, any>;
  readonly registry: ComponentRegistry;
  readonly pageSpecs: Readonly<Record<string, Spec>>;
  readonly initialState?: Record<string, unknown>;
  readonly themeCss: string;
  readonly steeringMd: string;
  readonly skillMd: string;
  readonly kiroPowerMd: string;
  readonly sourceFiles: readonly TemplateSourceFile[];
  readonly buildRemixJsonl?: (
    prompt: string,
    currentSpec: Spec | null,
  ) => string;
  readonly buildChaosPackets?: (rootKey: string) => readonly string[];
}

export interface TemplateRegistryFilter {
  readonly mode?: TemplateMode | "all";
  readonly tag?: string | "all";
  readonly tier?: "free" | "pro" | "all";
  readonly searchQuery?: string;
}

export interface ScopedThemeContainerOptions {
  readonly colorSchemeOverride?: "dark" | "light";
  readonly includeBaseReset?: boolean;
}
