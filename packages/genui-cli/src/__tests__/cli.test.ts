import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_TEMPLATE_PACKS,
  generatePackZip,
  handleRegistryApiRequest,
  validateLicenseToken,
} from "@genui-studio/core";
import {
  clearRuntimeTemplates,
  registerRuntimeTemplate,
  SHOWCASE_PACK_TEMPLATES,
} from "@genui-studio/templates";
import { installPack } from "../installer.js";
import { validateSpecContent, validateSpecFile } from "../validate.js";

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
      expect(lemonSqueezy.verificationMode).toBe("local-format-demo");
    });

    it("supports pluggable custom verifiers and can disable demo passes in strict production mode", () => {
      const rejectedDemo = validateLicenseToken("kiroween-2026-judge-pass", "pro", {
        allowDemoPasses: false,
      });
      expect(rejectedDemo.valid).toBe(false);

      const customVerified = validateLicenseToken("custom-signed-jwt", "pro", {
        verifier: (token) => ({
          valid: token === "custom-signed-jwt",
          subjectId: "org_42",
        }),
      });
      expect(customVerified.valid).toBe(true);
      expect(customVerified.verificationMode).toBe("custom-verifier");
      expect(customVerified.subjectId).toBe("org_42");
    });
  });

  describe("Registry API Endpoint (shadcn-compatible)", () => {
    it("returns free starter pack without license authentication", () => {
      const res = handleRegistryApiRequest("spatial-mesh-starter");
      expect(res.success).toBe(true);
      expect(res.requiresLicense).toBe(false);
      expect(res.item?.type).toBe("registry:block");
      expect(res.item?.name).toBe("spatial-mesh-starter");
    });

    it("blocks Pro pack request when Bearer token is missing", () => {
      const res = handleRegistryApiRequest("spatial-ops-3d-pro");
      expect(res.success).toBe(false);
      expect(res.requiresLicense).toBe(true);
      expect(res.licenseValid).toBe(false);
      expect(res.error).toContain("Authentication required");
    });

    it("serves Pro pack in shadcn format when valid Bearer license key is supplied", () => {
      const res = handleRegistryApiRequest("spatial-ops-3d-pro", {
        authHeader: "Bearer kiroween-2026-judge-pass",
      });
      expect(res.success).toBe(true);
      expect(res.licenseValid).toBe(true);
      expect(res.item?.name).toBe("spatial-ops-3d-pro");
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
        packId: "spatial-mesh-starter",
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
      const pack = ALL_TEMPLATE_PACKS["spatial-ops-3d-pro"]!;
      const zipBytes = await generatePackZip(pack);

      expect(zipBytes).toBeInstanceOf(Uint8Array);
      expect(zipBytes.byteLength).toBeGreaterThan(5000); // Greater than 5KB zip
    });
  });

  describe("Dual-Mode Template Registry CLI Resolution", () => {
    it("installs a Mode B standalone template registered in @genui-studio/templates", async () => {
      const base = SHOWCASE_PACK_TEMPLATES[0]!;
      registerRuntimeTemplate({
        ...base,
        manifest: {
          ...base.manifest,
          slug: "mode-b-cli-check",
          id: "mode-b-cli-check",
          name: "mode-b-cli-check",
          title: "Mode B CLI Check",
          mode: "standalone",
          tier: "free",
          priceUsd: 0,
        },
      });

      try {
        const result = await installPack({
          packId: "mode-b-cli-check",
          dryRun: true,
        });
        expect(result.success).toBe(true);
        expect(result.pack.id).toBe("mode-b-cli-check");
        expect(result.filesWritten).toContain("SKILL.md");
        expect(result.filesWritten).toContain(".kiro/powers/mode-b-cli-check/POWER.md");
      } finally {
        clearRuntimeTemplates();
      }
    });
  });

  describe("CLI Spec & Stream Validator (genui-studio validate)", () => {
    it("validates clean JSON specs, SSE streams, and detects cycles / XSS / unknown components", () => {
      const cleanSpecRes = validateSpecContent(
        JSON.stringify({
          root: "card",
          elements: {
            card: { type: "Card", props: { title: "OK" }, children: ["m"] },
            m: { type: "Metric", props: { value: 99 }, children: [] },
          },
        }),
        { allowedComponents: ["Card", "Metric"] },
      );
      expect(cleanSpecRes.valid).toBe(true);
      expect(cleanSpecRes.format).toBe("spec-json");
      expect(cleanSpecRes.elementCount).toBe(2);

      const sseRes = validateSpecContent(
        [
          ": heartbeat",
          `data: ${JSON.stringify({ op: "add", path: "/root", value: "root" })}`,
          `data: ${JSON.stringify({
            op: "add",
            path: "/elements/root",
            value: { type: "Card", props: {}, children: [] },
          })}`,
          "data: [DONE]",
        ].join("\n"),
        { allowedComponents: ["Card"] },
      );
      expect(sseRes.valid).toBe(true);
      expect(sseRes.format).toBe("sse");

      const cyclicAndUnknown = validateSpecContent(
        JSON.stringify({
          root: "a",
          elements: {
            a: { type: "UnknownWidget", props: {}, children: ["b"] },
            b: { type: "Card", props: {}, children: ["a"] },
          },
        }),
        { allowedComponents: ["Card"] },
      );
      expect(cyclicAndUnknown.valid).toBe(false);
      expect(cyclicAndUnknown.hasCycles).toBe(true);
      expect(
        cyclicAndUnknown.issues.some((i) => i.code === "unknown_component"),
      ).toBe(true);
    });

    it("validates spec files on disk cleanly", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "genui-cli-val-"));
      try {
        const badStreamPath = path.join(tmpDir, "bad.jsonl");
        fs.writeFileSync(
          badStreamPath,
          [
            JSON.stringify({ op: "add", path: "/root", value: "x" }),
            JSON.stringify({
              op: "add",
              path: "/elements/x",
              value: {
                type: "Link",
                props: { href: "javascript:alert(1)" },
                children: [],
              },
            }),
          ].join("\n"),
        );

        const fileRes = validateSpecFile(badStreamPath);
        expect(fileRes.valid).toBe(false);
        expect(fileRes.issues.some((i) => i.code === "blocked_unsafe_uri")).toBe(
          true,
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
