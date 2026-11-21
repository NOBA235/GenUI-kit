#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ALL_TEMPLATE_PACKS, generatePackZip } from "@genui-studio/core";
import {
  generateTemplateZip,
  getAllTemplates,
  getTemplateBySlug,
} from "@genui-studio/templates";
import {
  exportSkillPack,
  fuzzBehavioralSpec,
  loadBehavioralSpecFile,
  parseRequiredOutcomes,
} from "./behavior.js";
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
    $ npx genui-studio export-skill <slug|spec.json> [--out=<zip>] [--template=<slug>]
    $ npx genui-studio fuzz <spec.json> [--runs=100] [--seed=42] [--require-outcome=win]

  \x1b[1mCOMMANDS:\x1b[0m
    \x1b[32mvalidate <file>\x1b[0m  Validate .json/.jsonl/.sse UI Specs against DAG & safety invariants
    \x1b[32madd <pack>\x1b[0m       Install template pack components, Zod catalog & AI skills
    \x1b[32mlist\x1b[0m             List all available 2D & 3D template packs and pricing
    \x1b[32mexport <pack>\x1b[0m    Generate a complete, ready-to-run Next.js project .zip
    \x1b[32mexport-skill\x1b[0m     Export an Agent Skill & Contract Pack (.zip) for Kiro, Cursor, Claude Code, Codex
    \x1b[32mfuzz <spec>\x1b[0m      Playtest a behavioral spec's rules; exits 1 on crashes or unreachable outcomes

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
    --json             Print machine-readable JSON output (validate, fuzz, export-skill)
    --out=<file>       Output .zip path (export-skill; default: <slug>-skill-pack.zip)
    --template=<slug>  Catalog used to validate a spec file (export-skill; default: showcase catalog)
    --runs=<n>         Fuzzed sessions (fuzz, export-skill; default: 100)
    --seed=<n>         Fuzzer seed (fuzz, export-skill; default: 42)
    --max-steps=<n>    Max events per fuzzed session (fuzz, export-skill; default: 24)
    --require-outcome=<list>  Comma-separated outcomes fuzz must reach (win,lose,complete)
    --help, -h         Show help

  \x1b[1mAVAILABLE STARTERS & APPS (ALL MIT):\x1b[0m
    \x1b[36msaas-dashboard-starter\x1b[0m   (Free MIT) - Dark SaaS Dashboard Wireframe Starter
    \x1b[32mproduct-landing-starter\x1b[0m  (Free MIT) - Light Product Landing Wireframe Starter
    \x1b[36mafterdark-horror\x1b[0m         (Free MIT) - AFTERDARK 2.0 3D WebGL Exploration + Editorial Site
    \x1b[32mninety9-archive\x1b[0m          (Free MIT) - NINETY9 Monochrome 1990s Archive + 1-Bit Arcade
    \x1b[36mcmos-cloud-bios\x1b[0m          (Free MIT) - BIOS // NECROMANCER CMOS Utility + 3D PCB IaC Compiler
    \x1b[32mneuro-chimera-synth\x1b[0m      (Free MIT) - CHIMERA // LAB Physarum Bio-SQL Optimizer Lab
`);
}

/** Flags that take a value (`--flag=value` or `--flag value`), mapped to their key in `flags`. */
const VALUE_FLAGS: Readonly<Record<string, string>> = {
  "--out": "out",
  "--template": "template",
  "--runs": "runs",
  "--seed": "seed",
  "--max-steps": "maxSteps",
  "--require-outcome": "requireOutcome",
};

function readIntFlag(value: string | boolean | undefined, name: string): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`--${name} must be an integer (got "${value}").`);
  }
  return parsed;
}

function printError(json: boolean, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    console.log(JSON.stringify({ ok: false, error: message }));
  } else {
    console.error(`\x1b[31mError:\x1b[0m ${message}`);
  }
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
    } else if (VALUE_FLAGS[arg.split("=")[0]!]) {
      const name = VALUE_FLAGS[arg.split("=")[0]!]!;
      if (arg.includes("=")) {
        flags[name] = arg.slice(arg.indexOf("=") + 1);
      } else if (args[i + 1] !== undefined) {
        flags[name] = args[++i]!;
      }
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

  if (command === "fuzz") {
    const target = args[1];
    const json = Boolean(flags.json);
    if (!target || target.startsWith("--")) {
      printError(json, "Missing spec file. Usage: genui-studio fuzz <spec.json> [--runs=100] [--seed=42] [--require-outcome=win]");
      process.exit(1);
    }
    try {
      const requireOutcomes = parseRequiredOutcomes(
        typeof flags.requireOutcome === "string" ? flags.requireOutcome : undefined,
      );
      const { report, ruleCount, droppedRules } = fuzzBehavioralSpec(
        loadBehavioralSpecFile(target),
        {
          numRuns: readIntFlag(flags.runs, "runs"),
          seed: readIntFlag(flags.seed, "seed"),
          maxStepsPerRun: readIntFlag(flags.maxSteps, "max-steps"),
          requireOutcomes,
        },
      );
      const unreachable = requireOutcomes.filter((o) => report.outcomesReached[o] === 0);

      if (json) {
        console.log(JSON.stringify({ ok: report.passed, requireOutcomes, unreachable, ruleCount, droppedRules, report }, null, 2));
      } else {
        const badge = report.passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
        const reached = Object.entries(report.outcomesReached)
          .map(([o, n]) => `${o}=${n}`)
          .join(" ");
        console.log(
          `[${badge}] rules=${ruleCount} runs=${report.totalRuns} events=${report.totalEventsDispatched} exceptions=${report.unhandledExceptions} breakerTrips=${report.circuitBreakerTrips}`,
        );
        console.log(`  outcomes: ${reached}`);
        for (const outcome of ["win", "lose", "complete"] as const) {
          const trace = report.shortestTraces[outcome];
          if (trace) console.log(`  shortest ${outcome}: ${trace.length} events`);
        }
        if (droppedRules > 0) {
          console.log(`  \x1b[33mWARN \x1b[0m ${droppedRules} rule(s) dropped by the sanitizer`);
        }
        for (const dead of report.deadRules) {
          console.log(`  \x1b[33mWARN \x1b[0m rule never fired: ${dead.id} (${dead.label})${dead.sourceSection ? ` from ${dead.sourceSection}` : ""}`);
        }
        for (const outcome of unreachable) {
          console.log(`  \x1b[31mERROR\x1b[0m required outcome "${outcome}" was not reached`);
        }
      }
      if (!report.passed) process.exit(1);
    } catch (err) {
      printError(json, err);
      process.exit(1);
    }
    return;
  }

  if (command === "export-skill") {
    const target = args[1];
    const json = Boolean(flags.json);
    if (!target || target.startsWith("--")) {
      printError(json, "Missing target. Usage: genui-studio export-skill <slug|spec.json> [--out=<zip>] [--template=<slug>]");
      process.exit(1);
    }
    try {
      const fuzz = {
        numRuns: readIntFlag(flags.runs, "runs"),
        seed: readIntFlag(flags.seed, "seed"),
        maxStepsPerRun: readIntFlag(flags.maxSteps, "max-steps"),
      };
      const { pack, outPath, byteLength } = await exportSkillPack(target, {
        ...(typeof flags.out === "string" ? { out: flags.out } : {}),
        ...(typeof flags.template === "string" ? { templateSlug: flags.template } : {}),
        fuzz,
      });
      const outcomes = pack.verifiedTraces.map((t) => t.outcome);
      if (json) {
        console.log(
          JSON.stringify(
            {
              ok: true,
              slug: pack.slug,
              out: outPath,
              bytes: byteLength,
              files: Object.keys(pack.files).sort(),
              verifiedOutcomes: outcomes,
              deadRules: pack.fuzzReport.deadRules,
              unknownComponentTypes: pack.unknownComponentTypes,
              issues: pack.issues,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(`\x1b[32m✔ Skill Pack "${pack.slug}" written to ${outPath} (${(byteLength / 1024).toFixed(1)} KB)\x1b[0m`);
        console.log(`  files: ${Object.keys(pack.files).length}`);
        console.log(`  verified outcomes: ${outcomes.length > 0 ? outcomes.join(", ") : "none"}`);
        for (const dead of pack.fuzzReport.deadRules) {
          console.log(`  \x1b[33mWARN \x1b[0m rule never fired: ${dead.id} (${dead.label})`);
        }
        for (const type of pack.unknownComponentTypes) {
          console.log(`  \x1b[33mWARN \x1b[0m element type not in catalog: ${type}`);
        }
        if (pack.issues.length > 0) {
          console.log(`  ${pack.issues.length} sanitizer issue(s); rerun with --json for details`);
        }
        console.log("  next: extract at your repo root, then run `npx vitest run contracts/invariants.pbt.test.ts`");
      }
    } catch (err) {
      printError(json, err);
      process.exit(1);
    }
    return;
  }

  console.error(`\x1b[31mUnknown command "${command}". Run 'npx genui-studio --help' for usage.\x1b[0m`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
