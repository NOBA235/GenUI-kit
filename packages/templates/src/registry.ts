import type { RegistryApiResponse } from "@genui-studio/core";
import { exportTemplateToShadcnRegistry } from "./exporter.js";
import {
  GENERATED_NATIVE_TEMPLATES,
  GENERATED_STANDALONE_TEMPLATES,
} from "./registry-entries.generated.js";
import { SHOWCASE_PACK_TEMPLATES } from "./showcase-adapters.js";
import type {
  DualModeTemplateEntry,
  TemplateRegistryFilter,
} from "./types.js";

const runtimeRegisteredTemplates = new Map<string, DualModeTemplateEntry>();

/**
 * Registers an in-memory template entry at runtime (useful for tests & dynamic previews).
 */
export function registerRuntimeTemplate(entry: DualModeTemplateEntry): void {
  runtimeRegisteredTemplates.set(entry.manifest.slug, entry);
}

/**
 * Clears any dynamic runtime-registered test entries.
 */
export function clearRuntimeTemplates(): void {
  runtimeRegisteredTemplates.clear();
}

/**
 * Returns all templates in the Unified Dual-Mode Registry:
 * Mode A (Internal Native Websites), Mode B (Ingested Standalone Projects),
 * Runtime overrides, and Baseline Showcase Packs.
 */
export function getAllTemplates(): readonly DualModeTemplateEntry[] {
  const bySlug = new Map<string, DualModeTemplateEntry>();

  for (const entry of SHOWCASE_PACK_TEMPLATES) {
    bySlug.set(entry.manifest.slug, entry);
  }
  for (const entry of GENERATED_NATIVE_TEMPLATES) {
    bySlug.set(entry.manifest.slug, entry);
  }
  for (const entry of GENERATED_STANDALONE_TEMPLATES) {
    bySlug.set(entry.manifest.slug, entry);
  }
  for (const [slug, entry] of runtimeRegisteredTemplates.entries()) {
    bySlug.set(slug, entry);
  }

  return Array.from(bySlug.values());
}

/**
 * Queries the Dual-Mode Template Registry by mode, tag, tier, and search query.
 */
export function listTemplates(
  filter: TemplateRegistryFilter = {},
): readonly DualModeTemplateEntry[] {
  const all = getAllTemplates();
  const modeFilter = filter.mode ?? "all";
  const tagFilter = filter.tag ?? "all";
  const tierFilter = filter.tier ?? "all";
  const q = (filter.searchQuery ?? "").trim().toLowerCase();

  return all.filter((entry) => {
    const m = entry.manifest;
    if (modeFilter !== "all" && m.mode !== modeFilter) {
      return false;
    }
    if (tierFilter !== "all" && m.tier !== tierFilter) {
      return false;
    }
    if (tagFilter !== "all") {
      if (tagFilter === "GenUI Verified") {
        if (!m.verified && !m.tags.includes("GenUI Verified")) return false;
      } else if (tagFilter === "Full-Stack Standalone") {
        if (
          m.mode !== "standalone" &&
          !m.tags.includes("Full-Stack Standalone")
        ) {
          return false;
        }
      } else if (
        !m.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase()) &&
        m.category.toLowerCase() !== tagFilter.toLowerCase()
      ) {
        return false;
      }
    }
    if (q.length > 0) {
      const haystack = [
        m.slug,
        m.title,
        m.description,
        m.category,
        m.mode,
        ...m.tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export function getTemplateBySlug(
  slug: string,
): DualModeTemplateEntry | undefined {
  return getAllTemplates().find((entry) => entry.manifest.slug === slug);
}

export function getTemplateCounts(): {
  total: number;
  native: number;
  standalone: number;
  verified: number;
} {
  const all = getAllTemplates();
  return {
    total: all.length,
    native: all.filter((e) => e.manifest.mode === "native").length,
    standalone: all.filter((e) => e.manifest.mode === "standalone").length,
    verified: all.filter(
      (e) => e.manifest.verified || e.manifest.tags.includes("GenUI Verified"),
    ).length,
  };
}

/**
 * Handles Shadcn-compatible registry requests across both Mode A & Mode B templates.
 */
export function handleDualModeRegistryRequest(
  slug: string,
  options: { authHeader?: string | null; licenseToken?: string | null } = {},
): RegistryApiResponse {
  const entry = getTemplateBySlug(slug);
  if (!entry) {
    return {
      success: false,
      packId: slug,
      tier: "free",
      requiresLicense: false,
      error: `Template "${slug}" not found in Dual-Mode Registry. Available: ${getAllTemplates()
        .map((e) => e.manifest.slug)
        .join(", ")}`,
    };
  }
  return exportTemplateToShadcnRegistry(entry, options);
}
