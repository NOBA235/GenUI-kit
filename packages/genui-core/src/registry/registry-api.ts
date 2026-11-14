import { ALL_TEMPLATE_PACKS } from "./pack-definitions.js";
import type {
  AgentReadyPackManifest,
  RegistryApiResponse,
  ShadcnRegistryItem,
} from "./types.js";

export type LicenseVerificationMode =
  | "free-tier"
  | "local-format-demo"
  | "custom-verifier";

export interface LicenseValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly verificationMode: LicenseVerificationMode;
  readonly subjectId?: string;
}

export type LicenseVerifier = (
  token: string,
  context: { readonly tier: "free" | "pro"; readonly packId?: string },
) =>
  | LicenseValidationResult
  | { readonly valid: boolean; readonly reason?: string; readonly subjectId?: string };

export interface ValidateLicenseTokenOptions {
  /** Inject a real backend entitlement verifier (Stripe / Lemon Squeezy / signed JWT) */
  readonly verifier?: LicenseVerifier;
  /** Optional pack identifier passed to custom verifier */
  readonly packId?: string;
  /** Allow built-in local demo/judge tokens when no custom verifier is configured (default: true for local OSS/demo use) */
  readonly allowDemoPasses?: boolean;
}

/**
 * Validates a Bearer license token for commercial Pro template packs.
 *
 * By default (when no `options.verifier` is supplied), this performs **offline key-format
 * and demo-pass validation only** (`verificationMode: "local-format-demo"`). Production SaaS
 * deployments must inject a real server-side `options.verifier` backed by Stripe, Lemon Squeezy,
 * or signed entitlement tokens and set `allowDemoPasses: false`.
 */
export function validateLicenseToken(
  token?: string | null,
  tier: "free" | "pro" = "free",
  options: ValidateLicenseTokenOptions = {},
): LicenseValidationResult {
  if (tier === "free") {
    return { valid: true, verificationMode: "free-tier" };
  }

  if (!token || typeof token !== "string" || token.trim() === "") {
    return {
      valid: false,
      verificationMode: options.verifier ? "custom-verifier" : "local-format-demo",
      reason:
        "Authentication required: Pro template pack requires a valid Bearer license key. Purchase at https://genui.studio/pro or pass --license=<key>.",
    };
  }

  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();

  if (options.verifier) {
    const delegated = options.verifier(cleanToken, {
      tier,
      packId: options.packId,
    });
    return {
      valid: delegated.valid,
      reason: delegated.reason,
      subjectId: delegated.subjectId,
      verificationMode: "custom-verifier",
    };
  }

  const allowDemoPasses = options.allowDemoPasses ?? true;
  const isDemoPass =
    cleanToken === "dev-pro-license" ||
    cleanToken === "kiroween-2026-judge-pass";

  if (isDemoPass && !allowDemoPasses) {
    return {
      valid: false,
      verificationMode: "local-format-demo",
      reason:
        "Invalid license key format: local demo passes are disabled when allowDemoPasses=false.",
    };
  }

  // Offline key-format patterns (does NOT query a remote billing API unless options.verifier is set):
  const isWellFormedKey =
    (allowDemoPasses && isDemoPass) ||
    cleanToken.startsWith("GENUI_PRO_") ||
    cleanToken.startsWith("lic_live_") ||
    cleanToken.startsWith("lic_test_") ||
    cleanToken.startsWith("gs_tok_") ||
    cleanToken.startsWith("gum_") ||
    (cleanToken.length >= 24 && /^[a-zA-Z0-9_-]+$/.test(cleanToken));

  if (!isWellFormedKey) {
    return {
      valid: false,
      verificationMode: "local-format-demo",
      reason: `Invalid license key format "${cleanToken}". Expected prefix 'GENUI_PRO_', 'lic_live_', or configured verifier token.`,
    };
  }

  return {
    valid: true,
    verificationMode: "local-format-demo",
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
    verifier?: LicenseVerifier;
    allowDemoPasses?: boolean;
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
  const auth = validateLicenseToken(token, pack.tier, {
    verifier: options.verifier,
    packId,
    allowDemoPasses: options.allowDemoPasses,
  });

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
