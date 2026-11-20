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
  handleDualModeRegistryRequest,
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
    it("returns free starter packs without license authentication", () => {
      const res = handleRegistryApiRequest("product-landing-starter");
      expect(res.success).toBe(true);
      expect(res.requiresLicense).toBe(false);
      expect(res.item?.type).toBe("registry:block");
      expect(res.item?.name).toBe("product-landing-starter");

      const saasRes = handleRegistryApiRequest("saas-dashboard-starter");
      expect(saasRes.success).toBe(true);
      expect(saasRes.item?.name).toBe("saas-dashboard-starter");
      expect(saasRes.item?.files.length).toBeGreaterThanOrEqual(4);
      expect(saasRes.item?.files.some((f) => f.path.includes("SKILL.md"))).toBe(true);
      expect(saasRes.item?.files.some((f) => f.path.includes("POWER.md"))).toBe(true);
    });

    it("blocks a Pro-tier template request when Bearer token is missing and serves it when valid", () => {
      const base = SHOWCASE_PACK_TEMPLATES[0]!;
      registerRuntimeTemplate({
        ...base,
        manifest: {
          ...base.manifest,
          slug: "custom-pro-fixture",
          id: "custom-pro-fixture",
          name: "custom-pro-fixture",
          title: "Custom Pro Fixture",
          tier: "pro",
          priceUsd: 49,
        },
      });
      try {
        const blocked = handleDualModeRegistryRequest("custom-pro-fixture");
        expect(blocked.success).toBe(false);
        expect(blocked.requiresLicense).toBe(true);
        expect(blocked.licenseValid).toBe(false);
        expect(blocked.error).toContain("Authentication required");

        const allowed = handleDualModeRegistryRequest("custom-pro-fixture", {
          authHeader: "Bearer kiroween-2026-judge-pass",
        });
        expect(allowed.success).toBe(true);
        expect(allowed.licenseValid).toBe(true);
        expect(allowed.item?.name).toBe("custom-pro-fixture");
        expect(allowed.item?.files.some((f) => f.path.includes("SKILL.md"))).toBe(true);
        expect(allowed.item?.files.some((f) => f.path.includes("POWER.md"))).toBe(true);
      } finally {
        clearRuntimeTemplates();
      }
    });
  });

  describe("CLI Installer: installPack()", () => {
    it("installs free starter packs in dryRun mode without license", async () => {
      const result = await installPack({
        packId: "product-landing-starter",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.licenseStatus.required).toBe(false);
      expect(result.filesWritten.length).toBeGreaterThan(0);
      expect(result.instructions.claudeSkillPath).toContain("SKILL.md");
      expect(result.filesWritten).toContain(".kiro/powers/product-landing-starter/POWER.md");
      expect(result.filesWritten).toContain("__tests__/product-landing-starter.fuzz.test.ts");
    });

    it("enforces license verification when installing a Pro-tier custom pack", async () => {
      const base = SHOWCASE_PACK_TEMPLATES[0]!;
      registerRuntimeTemplate({
        ...base,
        manifest: {
          ...base.manifest,
          slug: "pro-gated-fixture",
          id: "pro-gated-fixture",
          name: "pro-gated-fixture",
          title: "Pro Gated Fixture",
          tier: "pro",
          priceUsd: 49,
        },
      });
      try {
        await expect(
          installPack({
            packId: "pro-gated-fixture",
            dryRun: true,
          }),
        ).rejects.toThrow("License Verification Failed");

        const result = await installPack({
          packId: "pro-gated-fixture",
          licenseToken: "kiroween-2026-judge-pass",
          dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.licenseStatus.required).toBe(true);
        expect(result.licenseStatus.valid).toBe(true);
        expect(result.filesWritten).toContain("SKILL.md");
        expect(result.filesWritten).toContain(".kiro/powers/pro-gated-fixture/POWER.md");
        expect(result.filesWritten).toContain("__tests__/pro-gated-fixture.fuzz.test.ts");
      } finally {
        clearRuntimeTemplates();
      }
    });
  });

  describe("In-Memory .ZIP Bundle Generation", () => {
    it("generates valid non-empty Uint8Array zip containing Next.js 15 project structure", async () => {
      const pack = ALL_TEMPLATE_PACKS["saas-dashboard-starter"]!;
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

    it("installs free flagship template ninety9-archive with SKILL.md, POWER.md, and public SVGs", async () => {
      const result = await installPack({
        packId: "ninety9-archive",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.licenseStatus.required).toBe(false);
      expect(result.pack.id).toBe("ninety9-archive");
      expect(result.filesWritten).toContain("SKILL.md");
      expect(result.filesWritten).toContain(".kiro/powers/ninety9-archive/POWER.md");
      expect(result.filesWritten).toContain("public/images/ninety9/entries/nirvana-nevermind.svg");
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
