import fs from "node:fs";
import path from "node:path";
import {
  ALL_TEMPLATE_PACKS,
  validateLicenseToken,
  type AgentReadyPackManifest,
} from "@genui-studio/core";
import {
  getAllTemplates,
  getTemplateBySlug,
  templateToAgentReadyPack,
} from "@genui-studio/templates";

export interface InstallPackOptions {
  packId: string;
  cwd?: string;
  licenseToken?: string | null;
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface InstallPackResult {
  success: boolean;
  pack: AgentReadyPackManifest;
  targetDir: string;
  filesWritten: string[];
  dependenciesAdded: Record<string, string>;
  licenseStatus: {
    required: boolean;
    valid: boolean;
    tokenUsed?: string;
  };
  instructions: {
    claudeSkillPath: string;
    kiroPowerPath: string;
    catalogPath: string;
    nextSteps: string[];
  };
}

/**
 * Installs an Agent-Ready Template Pack into a target project workspace.
 */
export async function installPack(
  options: InstallPackOptions,
): Promise<InstallPackResult> {
  const dualModeTemplate = getTemplateBySlug(options.packId);
  const pack =
    ALL_TEMPLATE_PACKS[options.packId] ??
    (dualModeTemplate ? templateToAgentReadyPack(dualModeTemplate) : undefined);

  if (!pack) {
    const available = Array.from(
      new Set([
        ...Object.keys(ALL_TEMPLATE_PACKS),
        ...getAllTemplates().map((t) => t.manifest.slug),
      ]),
    ).join(", ");
    throw new Error(
      `Template pack "${options.packId}" not found. Available packs: ${available}`,
    );
  }

  // 1. License Verification for Pro Packs
  const isPro = pack.tier === "pro";
  const auth = validateLicenseToken(options.licenseToken, pack.tier);
  if (!auth.valid) {
    throw new Error(
      `[GenUI Studio] License Verification Failed for "${pack.name}" (${pack.title}):\n${auth.reason}`,
    );
  }

  const targetDir = path.resolve(options.cwd ?? process.cwd());
  const filesWritten: string[] = [];

  // 2. Prepare all files to write
  const filesToInstall: Array<{ relativePath: string; content: string }> = [];

  // A) Production Component & Catalog Files
  for (const f of pack.files) {
    filesToInstall.push({
      relativePath: f.path,
      content: f.content,
    });
  }

  // B) AI Agent Skills & Kiro Power
  filesToInstall.push({
    relativePath: `SKILL.md`,
    content: pack.agentSkill.skillMd,
  });

  filesToInstall.push({
    relativePath: `.claude/skills/${pack.id}/SKILL.md`,
    content: pack.agentSkill.skillMd,
  });

  filesToInstall.push({
    relativePath: `.kiro/powers/${pack.id}/POWER.md`,
    content: pack.agentSkill.kiroPowerMd,
  });

  filesToInstall.push({
    relativePath: `.kiro/steering/${pack.id}-rules.md`,
    content: pack.agentSkill.steeringRules,
  });

  // C) fast-check Property-Based Test Suite
  filesToInstall.push({
    relativePath: `__tests__/${pack.id}.fuzz.test.ts`,
    content: pack.pbtSuite.code,
  });

  // 3. Write files to target workspace (if not dryRun)
  if (!options.dryRun) {
    for (const item of filesToInstall) {
      const fullPath = path.join(targetDir, item.relativePath);
      const parentDir = path.dirname(fullPath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (fs.existsSync(fullPath) && !options.overwrite) {
        // Skip or overwrite based on flag
        continue;
      }

      fs.writeFileSync(fullPath, item.content, "utf-8");
      filesWritten.push(item.relativePath);
    }

    // 4. Update package.json if it exists in targetDir
    const packageJsonPath = path.join(targetDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const rawPkg = fs.readFileSync(packageJsonPath, "utf-8");
        const parsed = JSON.parse(rawPkg);
        parsed.dependencies = {
          ...(parsed.dependencies ?? {}),
          ...pack.dependencies,
        };
        parsed.devDependencies = {
          ...(parsed.devDependencies ?? {}),
          ...pack.devDependencies,
        };
        fs.writeFileSync(packageJsonPath, JSON.stringify(parsed, null, 2), "utf-8");
      } catch {
        // Ignore package.json parsing issues in non-standard project roots
      }
    }
  } else {
    // Dry run: list all planned files
    for (const item of filesToInstall) {
      filesWritten.push(item.relativePath);
    }
  }

  return {
    success: true,
    pack,
    targetDir,
    filesWritten,
    dependenciesAdded: pack.dependencies,
    licenseStatus: {
      required: isPro,
      valid: auth.valid,
      tokenUsed: options.licenseToken ?? undefined,
    },
    instructions: {
      claudeSkillPath: `.claude/skills/${pack.id}/SKILL.md`,
      kiroPowerPath: `.kiro/powers/${pack.id}/POWER.md`,
      catalogPath: `catalog/${pack.id.split("-")[0]}-catalog.ts`,
      nextSteps: [
        `Install dependencies: pnpm install`,
        `Run formal PBT test: pnpm test __tests__/${pack.id}.fuzz.test.ts`,
        `Prompt Kiro / Claude Code: "Stream the ${pack.title} using the verified catalog"`,
      ],
    },
  };
}
