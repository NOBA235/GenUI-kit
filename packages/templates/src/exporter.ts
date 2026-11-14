import JSZip from "jszip";
import {
  packToShadcnRegistryItem,
  validateLicenseToken,
  type AgentReadyPackManifest,
  type PackCategory,
  type PackFileItem,
  type RegistryApiResponse,
  type ShadcnRegistryItem,
} from "@genui-studio/core";
import { mergeTemplateWithNextjsShell } from "./base-shell.js";
import type { DualModeTemplateEntry } from "./types.js";

function mapToCorePackCategory(category: string, tags: readonly string[]): PackCategory {
  const lower = `${category} ${tags.join(" ")}`.toLowerCase();
  if (lower.includes("3d") || lower.includes("webgl")) return "spatial-3d";
  if (lower.includes("analytics") || lower.includes("defi") || lower.includes("web3")) {
    return "analytics";
  }
  if (lower.includes("sre")) return "sre";
  if (lower.includes("analytics")) return "analytics";
  return "dashboard";
}

function mapSourceKindToPackFileType(
  kind: string,
): PackFileItem["type"] {
  switch (kind) {
    case "catalog":
      return "registry:catalog";
    case "component":
      return "registry:ui";
    case "skill":
      return "registry:skill";
    case "power":
    case "steering":
      return "registry:power";
    case "theme":
    case "manifest":
    case "config":
      return "registry:config";
    default:
      return "registry:block";
  }
}

/**
 * Adapts any Mode A (Internal Native) or Mode B (Ingested Standalone) template
 * into an @genui-studio/core `AgentReadyPackManifest` for CLI & Shadcn registry compatibility.
 */
export function templateToAgentReadyPack(
  entry: DualModeTemplateEntry,
): AgentReadyPackManifest {
  const { manifest, catalog, sourceFiles, skillMd, kiroPowerMd, steeringMd } =
    entry;

  const packFiles: PackFileItem[] = sourceFiles.map((file) => ({
    path: file.path,
    type: mapSourceKindToPackFileType(file.kind),
    content: file.content,
    target:
      manifest.mode === "standalone"
        ? file.path
        : `src/templates/${manifest.slug}/${file.path}`,
  }));

  return {
    id: manifest.slug,
    name: manifest.slug,
    title: manifest.title,
    description: manifest.description,
    version: manifest.version,
    author: manifest.author,
    license: manifest.license,
    tier: manifest.tier,
    priceUsd: manifest.priceUsd,
    category: mapToCorePackCategory(manifest.category, manifest.tags),
    tags: [...manifest.tags, `mode:${manifest.mode}`],
    dependencies: manifest.dependencies,
    devDependencies: manifest.devDependencies,
    catalogHash: catalog.metadata.catalogHash,
    components: catalog.metadata.componentNames.map((name) => ({
      name,
      description:
        catalog.metadata.componentDescriptions[name] ||
        `${name} section component`,
      slots: [],
      hasFallbackProps: true,
    })),
    files: packFiles,
    agentSkill: {
      skillMd,
      kiroPowerMd,
      steeringRules: steeringMd,
    },
    pbtSuite: {
      theorems: ["INV-PBT-01", "INV-PBT-02", "INV-PBT-03", "INV-PBT-04"],
      code: `import { describe, expect, it } from "vitest";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { verifiedCatalog } from "../catalog";

describe("${manifest.slug} Invariant Suite", () => {
  it("passes all 4 formal PBT theorems", () => {
    const report = runCatalogInvariantSuite(verifiedCatalog, { numRuns: 25 });
    expect(report.allPassed).toBe(true);
  });
});
`,
    },
  };
}

/**
 * Generates an in-memory Next.js 15 `.zip` archive by merging `base-nextjs-shell`
 * with Mode A template files (or packaging the clean Mode B standalone source tree).
 */
export async function generateTemplateZip(
  entry: DualModeTemplateEntry,
  options: { projectName?: string } = {},
): Promise<Uint8Array> {
  const zip = new JSZip();
  const merged = mergeTemplateWithNextjsShell(entry, {
    projectName: options.projectName ?? `${entry.manifest.slug}-website`,
  });

  for (const [filePath, content] of Object.entries(merged)) {
    zip.file(filePath, content);
  }

  return zip.generateAsync({ type: "uint8array" });
}

/**
 * Converts a Dual-Mode template entry into a standard shadcn CLI registry item,
 * enforcing Bearer license token checks for Pro packs.
 */
export function exportTemplateToShadcnRegistry(
  entry: DualModeTemplateEntry,
  options: { authHeader?: string | null; licenseToken?: string | null } = {},
): RegistryApiResponse & { readonly shadcnItem?: ShadcnRegistryItem } {
  const pack = templateToAgentReadyPack(entry);
  const token = options.licenseToken ?? options.authHeader ?? null;
  const auth = validateLicenseToken(token, pack.tier);

  if (!auth.valid) {
    return {
      success: false,
      packId: pack.id,
      tier: pack.tier,
      requiresLicense: true,
      licenseValid: false,
      error: auth.reason,
    };
  }

  const item = packToShadcnRegistryItem(pack);
  return {
    success: true,
    packId: pack.id,
    tier: pack.tier,
    requiresLicense: pack.tier === "pro",
    licenseValid: true,
    item,
    shadcnItem: item,
    pack,
  };
}

export function buildTemplateCliCommand(
  entry: DualModeTemplateEntry,
  licenseToken = "kiroween-2026-judge-pass",
): string {
  return entry.manifest.tier === "pro"
    ? `npx genui-studio add ${entry.manifest.slug} --license=${licenseToken}`
    : `npx genui-studio add ${entry.manifest.slug}`;
}
