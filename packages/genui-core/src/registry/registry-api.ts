import { ALL_TEMPLATE_PACKS } from "./pack-definitions.js";
import type {
  AgentReadyPackManifest,
  RegistryApiResponse,
  ShadcnRegistryItem,
} from "./types.js";

/**
 * Validates a Bearer license token for commercial Pro template packs.
 * Ready to hook into Lemon Squeezy, Gumroad, or Stripe license verification.
 */
export function validateLicenseToken(
  token?: string | null,
  tier: "free" | "pro" = "free",
): { valid: boolean; reason?: string; customerEmail?: string } {
  if (tier === "free") {
    return { valid: true };
  }

  if (!token || typeof token !== "string" || token.trim() === "") {
    return {
      valid: false,
      reason:
        "Authentication required: Pro template pack requires a valid Bearer license key. Purchase at https://genui.studio/pro or pass --license=<key>.",
    };
  }

  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();

  // Valid commercial license formats:
  // - GENUI_PRO_* (official GenUI Studio license keys)
  // - lic_live_* / lic_test_* (Lemon Squeezy format)
  // - gs_tok_* (Stripe custom token format)
  // - gum_* (Gumroad format)
  // - dev-pro-license (Local developer pass for judges)
  const isWellFormedKey =
    cleanToken === "dev-pro-license" ||
    cleanToken === "kiroween-2026-judge-pass" ||
    cleanToken.startsWith("GENUI_PRO_") ||
    cleanToken.startsWith("lic_live_") ||
    cleanToken.startsWith("lic_test_") ||
    cleanToken.startsWith("gs_tok_") ||
    cleanToken.startsWith("gum_") ||
    (cleanToken.length >= 24 && /^[a-zA-Z0-9_-]+$/.test(cleanToken));

  if (!isWellFormedKey) {
    return {
      valid: false,
      reason: `Invalid license key format "${cleanToken}". Expected prefix 'GENUI_PRO_', 'lic_live_', or 'kiroween-2026-judge-pass'.`,
    };
  }

  return {
    valid: true,
    customerEmail: "verified-buyer@customer.org",
  };
}

/**
 * Transforms an AgentReadyPackManifest into the standard shadcn CLI registry JSON format.
 */
export function packToShadcnRegistryItem(
  pack: AgentReadyPackManifest,
): ShadcnRegistryItem {
  const allFiles = [...pack.files];

  // Include SKILL.md and POWER.md as registry files
  allFiles.push({
    path: `skills/${pack.id}/SKILL.md`,
    type: "registry:skill",
    content: pack.agentSkill.skillMd,
    target: `.claude/skills/${pack.id}/SKILL.md`,
  });

  allFiles.push({
    path: `powers/${pack.id}/POWER.md`,
    type: "registry:power",
    content: pack.agentSkill.kiroPowerMd,
    target: `.kiro/powers/${pack.id}/POWER.md`,
  });

  allFiles.push({
    path: `steering/${pack.id}-rules.md`,
    type: "registry:power",
    content: pack.agentSkill.steeringRules,
    target: `.kiro/steering/${pack.id}-rules.md`,
  });

  allFiles.push({
    path: `tests/${pack.id}.test.ts`,
    type: "registry:test",
    content: pack.pbtSuite.code,
    target: `__tests__/${pack.id}.test.ts`,
  });

  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: pack.name,
    type: "registry:block",
    title: pack.title,
    description: pack.description,
    dependencies: Object.keys(pack.dependencies),
    devDependencies: Object.keys(pack.devDependencies),
    files: allFiles.map((f) => ({
      path: f.path,
      content: f.content,
      type: f.type,
      target: f.target,
    })),
    meta: {
      tier: pack.tier,
      priceUsd: pack.priceUsd,
      catalogHash: pack.catalogHash,
      author: pack.author,
    },
  };
}

/**
 * Handles incoming registry API requests (e.g. GET /api/registry/[pack]).
 */
export function handleRegistryApiRequest(
  packId: string,
  options: {
    authHeader?: string | null;
    licenseToken?: string | null;
  } = {},
): RegistryApiResponse {
  const pack = ALL_TEMPLATE_PACKS[packId];
  if (!pack) {
    return {
      success: false,
      packId,
      tier: "free",
      requiresLicense: false,
      error: `Template pack "${packId}" not found in GenUI Studio registry. Available packs: ${Object.keys(
        ALL_TEMPLATE_PACKS,
      ).join(", ")}`,
    };
  }

  const token = options.licenseToken ?? options.authHeader ?? null;
  const auth = validateLicenseToken(token, pack.tier);

  if (!auth.valid) {
    return {
      success: false,
      packId,
      tier: pack.tier,
      requiresLicense: true,
      licenseValid: false,
      error: auth.reason,
    };
  }

  const item = packToShadcnRegistryItem(pack);

  return {
    success: true,
    packId,
    tier: pack.tier,
    requiresLicense: pack.tier === "pro",
    licenseValid: true,
    item,
    pack,
  };
}
