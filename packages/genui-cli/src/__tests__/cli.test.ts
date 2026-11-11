import { describe, expect, it } from "vitest";
import {
  ALL_TEMPLATE_PACKS,
  generatePackZip,
  handleRegistryApiRequest,
  validateLicenseToken,
} from "@genui-studio/core";
import { installPack } from "../installer.js";

describe("GenUI Studio Template Pack Registry & Installer", () => {
  describe("Token-Gated License Verification", () => {
    it("allows free starter packs to install without any license token", () => {
      const res = validateLicenseToken(null, "free");
      expect(res.valid).toBe(true);
    });

    it("rejects Pro template packs when license token is missing", () => {
      const res = validateLicenseToken(null, "pro");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("Authentication required");
    });

    it("rejects invalid or malformed license tokens for Pro packs", () => {
      const res = validateLicenseToken("invalid-short-token", "pro");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("Invalid license key format");
    });

    it("accepts valid commercial license tokens (GENUI_PRO_*, lic_live_*, or judge pass)", () => {
      const judgePass = validateLicenseToken("kiroween-2026-judge-pass", "pro");
      expect(judgePass.valid).toBe(true);

      const genuiPro = validateLicenseToken(
        "GENUI_PRO_LIVE_9876543210123456789",
        "pro",
      );
      expect(genuiPro.valid).toBe(true);

      const lemonSqueezy = validateLicenseToken(
        "lic_live_abcdef123456789012345678",
        "pro",
      );
      expect(lemonSqueezy.valid).toBe(true);
    });
  });

  describe("Registry API Endpoint (shadcn-compatible)", () => {
    it("returns free starter pack without license authentication", () => {
      const res = handleRegistryApiRequest("saas-kpi-starter");
      expect(res.success).toBe(true);
      expect(res.requiresLicense).toBe(false);
      expect(res.item?.type).toBe("registry:block");
      expect(res.item?.name).toBe("saas-kpi-starter");
    });

    it("blocks Pro pack request when Bearer token is missing", () => {
      const res = handleRegistryApiRequest("finops-command-pro");
      expect(res.success).toBe(false);
      expect(res.requiresLicense).toBe(true);
      expect(res.licenseValid).toBe(false);
      expect(res.error).toContain("Authentication required");
    });

    it("serves Pro pack in shadcn format when valid Bearer license key is supplied", () => {
      const res = handleRegistryApiRequest("finops-command-pro", {
        authHeader: "Bearer kiroween-2026-judge-pass",
      });
      expect(res.success).toBe(true);
      expect(res.licenseValid).toBe(true);
      expect(res.item?.name).toBe("finops-command-pro");
      expect(res.item?.files.length).toBeGreaterThanOrEqual(4);

      // Verify AI Agent Skills are packaged in registry files
      const hasSkill = res.item?.files.some((f) => f.path.includes("SKILL.md"));
      const hasPower = res.item?.files.some((f) => f.path.includes("POWER.md"));
      expect(hasSkill).toBe(true);
      expect(hasPower).toBe(true);
    });
  });

  describe("CLI Installer: installPack()", () => {
    it("installs free pack in dryRun mode without license", async () => {
      const result = await installPack({
        packId: "saas-kpi-starter",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.licenseStatus.required).toBe(false);
      expect(result.filesWritten.length).toBeGreaterThan(0);
      expect(result.instructions.claudeSkillPath).toContain("SKILL.md");
    });

    it("throws clear error when attempting to install Pro pack without license", async () => {
      await expect(
        installPack({
          packId: "spatial-ops-3d-pro",
          dryRun: true,
        }),
      ).rejects.toThrow("License Verification Failed");
    });

    it("successfully installs Pro pack with valid license token", async () => {
      const result = await installPack({
        packId: "spatial-ops-3d-pro",
        licenseToken: "kiroween-2026-judge-pass",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.licenseStatus.required).toBe(true);
      expect(result.licenseStatus.valid).toBe(true);
      expect(result.filesWritten).toContain("SKILL.md");
      expect(result.filesWritten).toContain(".kiro/powers/spatial-ops-3d-pro/POWER.md");
      expect(result.filesWritten).toContain("__tests__/spatial-ops-3d-pro.fuzz.test.ts");
    });
  });

  describe("In-Memory .ZIP Bundle Generation", () => {
    it("generates valid non-empty Uint8Array zip containing Next.js 15 project structure", async () => {
      const pack = ALL_TEMPLATE_PACKS["finops-command-pro"]!;
      const zipBytes = await generatePackZip(pack);

      expect(zipBytes).toBeInstanceOf(Uint8Array);
      expect(zipBytes.byteLength).toBeGreaterThan(5000); // Greater than 5KB zip
    });
  });
});
