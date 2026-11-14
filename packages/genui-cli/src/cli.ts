#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ALL_TEMPLATE_PACKS, generatePackZip } from "@genui-studio/core";
import {
  generateTemplateZip,
  getAllTemplates,
  getTemplateBySlug,
} from "@genui-studio/templates";
import { installPack } from "./installer.js";
import {
  loadAllowedComponentsFile,
  validateSpecContent,
  validateSpecFile,
} from "./validate.js";

function printBanner() {
  console.log(`
  \x1b[36m██████╗ ███████╗███╗   ██╗██╗   ██╗██╗\x1b[0m
  \x1b[36m██╔════╝ ██╔════╝████╗  ██║██║   ██║██║\x1b[0m
  \x1b[36m██║  ███╗█████╗  ██╔██╗ ██║██║   ██║██║\x1b[0m  \x1b[35mS T U D I O\x1b[0m
  \x1b[36m██║   ██║██╔══╝  ██║╚██╗██║██║   ██║██║\x1b[0m  \x1b[90mAgent-Ready Template Registry v1.0.0\x1b[0m
  \x1b[36m╚██████╔╝███████╗██║ ╚████║╚██████╔╝██║\x1b[0m
  \x1b[90m─────────────────────────────────────────────────────────────\x1b[0m
`);
}

function printHelp() {
  printBanner();
  console.log(`  \x1b[1mUSAGE:\x1b[0m
    $ npx genui-studio validate <file|-> [flags]
    $ npx genui-studio add <pack-name> [flags]
    $ npx genui-studio list
    $ npx genui-studio export <pack-name> [flags]

  \x1b[1mCOMMANDS:\x1b[0m
    \x1b[32mvalidate <file>\x1b[0m  Validate .json/.jsonl/.sse UI Specs against DAG & safety invariants
    \x1b[32madd <pack>\x1b[0m       Install template pack components, Zod catalog & AI skills
    \x1b[32mlist\x1b[0m             List all available 2D & 3D template packs and pricing
    \x1b[32mexport <pack>\x1b[0m    Generate a complete, ready-to-run Next.js project .zip

  \x1b[1mFLAGS:\x1b[0m
    --license=<key>    Bearer license token for Pro commercial packs
    --cwd=<path>       Target workspace directory (default: current directory)
    --overwrite        Overwrite existing files
    --dry-run          Preview files to be installed without writing
    --catalog=<file>   JSON catalog file (array or { components }) for allowlist validation
    --allowed=<types>  Comma-separated allowed component types for validate
    --max-depth=<n>    Max allowed tree depth (default: 16)
    --max-elements=<n> Max allowed element count (default: 500)
    --strict           Fail on warnings (healed values, duplicate refs)
    --json             Print machine-readable JSON output (validate command)
    --help, -h         Show help

  \x1b[1mAVAILABLE PACKS:\x1b[0m
    \x1b[36mspatial-ops-3d-pro\x1b[0m   (Pro $79)  - 14-Component Aegis 3D WebGL Incident War-Room
    \x1b[32mspatial-mesh-starter\x1b[0m (Free $0)  - 3D WebGL Microservice Mesh Starter Kit
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  // Parse flags
  const flags: Record<string, string | boolean> = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--license=")) {
      flags.license = arg.slice("--license=".length);
    } else if (arg === "--license" && args[i + 1]) {
      flags.license = args[++i]!;
    } else if (arg.startsWith("--cwd=")) {
      flags.cwd = arg.slice("--cwd=".length);
    } else if (arg === "--cwd" && args[i + 1]) {
      flags.cwd = args[++i]!;
    } else if (arg.startsWith("--catalog=")) {
      flags.catalog = arg.slice("--catalog=".length);
    } else if (arg === "--catalog" && args[i + 1]) {
      flags.catalog = args[++i]!;
    } else if (arg.startsWith("--allowed=")) {
      flags.allowed = arg.slice("--allowed=".length);
    } else if (arg === "--allowed" && args[i + 1]) {
      flags.allowed = args[++i]!;
    } else if (arg.startsWith("--max-depth=")) {
      flags.maxDepth = arg.slice("--max-depth=".length);
    } else if (arg === "--max-depth" && args[i + 1]) {
      flags.maxDepth = args[++i]!;
    } else if (arg.startsWith("--max-elements=")) {
      flags.maxElements = arg.slice("--max-elements=".length);
    } else if (arg === "--max-elements" && args[i + 1]) {
      flags.maxElements = args[++i]!;
    } else if (arg === "--overwrite") {
      flags.overwrite = true;
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--strict") {
      flags.strict = true;
    } else if (arg === "--json") {
      flags.json = true;
    }
  }

  if (command === "validate") {
    const target = args[1];
    if (!target || target.startsWith("--")) {
      console.error(
        "\x1b[31mError: Missing target file or '-' for stdin. Usage: genui-studio validate <file|-> [--strict] [--json]\x1b[0m",
      );
      process.exit(1);
    }

    try {
      const allowedSet = new Set<string>();
      if (typeof flags.catalog === "string") {
        for (const c of loadAllowedComponentsFile(flags.catalog)) {
          allowedSet.add(c);
        }
      }
      if (typeof flags.allowed === "string") {
        for (const c of flags.allowed.split(",")) {
          const trimmed = c.trim();
          if (trimmed) allowedSet.add(trimmed);
        }
      }

      const maxDepth =
        typeof flags.maxDepth === "string" ? Number(flags.maxDepth) : undefined;
      const maxElements =
        typeof flags.maxElements === "string"
          ? Number(flags.maxElements)
          : undefined;

      const validateOptions = {
        allowedComponents: allowedSet.size > 0 ? Array.from(allowedSet) : undefined,
        maxDepth: maxDepth && Number.isFinite(maxDepth) ? maxDepth : undefined,
        maxElements:
          maxElements && Number.isFinite(maxElements) ? maxElements : undefined,
        strict: Boolean(flags.strict),
      };

      const result =
        target === "-"
          ? validateSpecContent(fs.readFileSync(0, "utf-8"), validateOptions)
          : validateSpecFile(target, validateOptions);

      if (flags.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const badge = result.valid
          ? "\x1b[32mPASS\x1b[0m"
          : "\x1b[31mFAIL\x1b[0m";
        console.log(
          `[${badge}] format=${result.format} elements=${result.elementCount} reachable=${result.reachableElementCount} depth=${result.maxObservedDepth} issues=${result.issues.length}`,
        );
        for (const issue of result.issues) {
          const prefix =
            issue.severity === "error"
              ? "\x1b[31mERROR\x1b[0m"
              : "\x1b[33mWARN \x1b[0m";
          console.log(`  ${prefix} [${issue.code}] ${issue.message}`);
        }
      }

      if (!result.valid) {
        process.exit(1);
      }
    } catch (err) {
      if (flags.json) {
        console.log(
          JSON.stringify({
            valid: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      } else {
        console.error(
          `\x1b[31mValidation Error:\x1b[0m ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      process.exit(1);
    }
    return;
  }

  if (command === "list") {
    printBanner();
    console.log("  \x1b[1mAVAILABLE DUAL-MODE TEMPLATE PACKS:\x1b[0m\n");
    const shown = new Set<string>();
    for (const template of getAllTemplates()) {
      const m = template.manifest;
      shown.add(m.slug);
      const modeBadge =
        m.mode === "standalone"
          ? "\x1b[33m[MODE B · STANDALONE]\x1b[0m"
          : "\x1b[36m[MODE A · NATIVE]\x1b[0m";
      const tierBadge =
        m.tier === "pro"
          ? `\x1b[35m[PRO $${m.priceUsd}]\x1b[0m`
          : `\x1b[32m[FREE $0]\x1b[0m`;
      console.log(`  • \x1b[1m${m.slug}\x1b[0m ${modeBadge} ${tierBadge}`);
      console.log(`    ${m.title}`);
      console.log(`    \x1b[90m${m.description.slice(0, 90)}...\x1b[0m`);
      console.log(`    \x1b[36m$ npx genui-studio add ${m.slug}${m.tier === "pro" ? " --license=<key>" : ""}\x1b[0m\n`);
    }
    for (const [id, pack] of Object.entries(ALL_TEMPLATE_PACKS)) {
      if (shown.has(id)) continue;
      const tierBadge =
        pack.tier === "pro"
          ? `\x1b[35m[PRO $${pack.priceUsd}]\x1b[0m`
          : `\x1b[32m[FREE $0]\x1b[0m`;
      console.log(`  • \x1b[1m${id}\x1b[0m ${tierBadge}`);
      console.log(`    ${pack.title}`);
      console.log(`    \x1b[90m${pack.description.slice(0, 90)}...\x1b[0m`);
      console.log(`    \x1b[36m$ npx genui-studio add ${id}${pack.tier === "pro" ? " --license=<key>" : ""}\x1b[0m\n`);
    }
    return;
  }

  if (command === "add") {
    const packId = args[1];
    if (!packId) {
      console.error("\x1b[31mError: Missing pack name. Usage: npx genui-studio add <pack-name>\x1b[0m");
      console.log("Run \x1b[36mnpx genui-studio list\x1b[0m to see available packs.");
      process.exit(1);
    }

    printBanner();
    console.log(`  Installing pack \x1b[36m${packId}\x1b[0m...\n`);

    try {
      const result = await installPack({
        packId,
        cwd: typeof flags.cwd === "string" ? flags.cwd : process.cwd(),
        licenseToken: typeof flags.license === "string" ? flags.license : null,
        overwrite: Boolean(flags.overwrite),
        dryRun: Boolean(flags.dryRun),
      });

      console.log(`  \x1b[32m✔ Pack "${result.pack.title}" successfully ${flags.dryRun ? "verified (dry run)" : "installed"}!\x1b[0m`);
      console.log(`  \x1b[90mTarget: ${result.targetDir}\x1b[0m\n`);

      console.log("  \x1b[1mFILES INSTALLED:\x1b[0m");
      for (const f of result.filesWritten) {
        console.log(`    \x1b[32m+ \x1b[0m${f}`);
      }

      console.log("\n  \x1b[1mAI AGENT READY:\x1b[0m");
      console.log(`    • Claude Code / Cursor Skill: \x1b[36m${result.instructions.claudeSkillPath}\x1b[0m`);
      console.log(`    • Kiro Power:                 \x1b[36m${result.instructions.kiroPowerPath}\x1b[0m`);

      console.log("\n  \x1b[1mNEXT STEPS:\x1b[0m");
      for (const step of result.instructions.nextSteps) {
        console.log(`    \x1b[33m$\x1b[0m ${step}`);
      }
      console.log("");
    } catch (err) {
      console.error(`\x1b[31m✖ Installation Failed:\x1b[0m ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
    return;
  }

  if (command === "export") {
    const packId = args[1];
    const dualModeTemplate = packId ? getTemplateBySlug(packId) : undefined;
    const legacyPack = packId ? ALL_TEMPLATE_PACKS[packId] : undefined;

    if (!packId || (!dualModeTemplate && !legacyPack)) {
      console.error(`\x1b[31mError: Invalid pack name "${packId}". Run 'npx genui-studio list'\x1b[0m`);
      process.exit(1);
    }

    const title = dualModeTemplate?.manifest.title ?? legacyPack!.title;
    printBanner();
    console.log(`  Generating standalone Next.js 15 .zip for \x1b[36m${title}\x1b[0m...`);

    const zipBytes = dualModeTemplate
      ? await generateTemplateZip(dualModeTemplate)
      : await generatePackZip(legacyPack!);
    const outFilename = `${packId}-template.zip`;
    fs.writeFileSync(path.resolve(process.cwd(), outFilename), Buffer.from(zipBytes));

    console.log(`  \x1b[32m✔ Project .zip exported to ${outFilename} (${(zipBytes.byteLength / 1024).toFixed(1)} KB)!\x1b[0m\n`);
    return;
  }

  console.error(`\x1b[31mUnknown command "${command}". Run 'npx genui-studio --help' for usage.\x1b[0m`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
