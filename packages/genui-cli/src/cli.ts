#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ALL_TEMPLATE_PACKS, generatePackZip } from "@genui-studio/core";
import { installPack } from "./installer.js";

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
    $ npx genui-studio add <pack-name> [flags]
    $ npx genui-studio list
    $ npx genui-studio export <pack-name> [flags]

  \x1b[1mCOMMANDS:\x1b[0m
    \x1b[32madd <pack>\x1b[0m       Install template pack components, Zod catalog & AI skills
    \x1b[32mlist\x1b[0m             List all available 2D & 3D template packs and pricing
    \x1b[32mexport <pack>\x1b[0m    Generate a complete, ready-to-run Next.js project .zip

  \x1b[1mFLAGS:\x1b[0m
    --license=<key>    Bearer license token for Pro commercial packs
    --cwd=<path>       Target workspace directory (default: current directory)
    --overwrite        Overwrite existing files
    --dry-run          Preview files to be installed without writing
    --help, -h         Show help

  \x1b[1mAVAILABLE PACKS:\x1b[0m
    \x1b[36mfinops-command-pro\x1b[0m   (Pro $49)  - 14-Component FinOps & RevOps Command Center
    \x1b[36mspatial-ops-3d-pro\x1b[0m   (Pro $79)  - 14-Component Aegis 3D WebGL Incident War-Room
    \x1b[32msaas-kpi-starter\x1b[0m     (Free $0)  - Clean KPI Metric & Refund Starter Kit
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
    } else if (arg === "--overwrite") {
      flags.overwrite = true;
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    }
  }

  if (command === "list") {
    printBanner();
    console.log("  \x1b[1mAVAILABLE AGENT-READY TEMPLATE PACKS:\x1b[0m\n");
    for (const [id, pack] of Object.entries(ALL_TEMPLATE_PACKS)) {
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
      console.log(`    • Kiro Power:                 \x1b[36${result.instructions.kiroPowerPath}\x1b[0m`);

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
    if (!packId || !ALL_TEMPLATE_PACKS[packId]) {
      console.error(`\x1b[31mError: Invalid pack name "${packId}". Run 'npx genui-studio list'\x1b[0m`);
      process.exit(1);
    }

    const pack = ALL_TEMPLATE_PACKS[packId]!;
    printBanner();
    console.log(`  Generating standalone Next.js 15 .zip for \x1b[36m${pack.title}\x1b[0m...`);

    const zipBytes = await generatePackZip(pack);
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
