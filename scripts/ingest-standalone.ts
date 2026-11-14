#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function ensureTemplatesNodeBuilt() {
  const coreDist = path.join(repoRoot, "packages", "genui-core", "dist", "index.js");
  if (!fs.existsSync(coreDist)) {
    execSync("pnpm --filter @genui-studio/core build", {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }
  const templatesNodeDist = path.join(
    repoRoot,
    "packages",
    "templates",
    "dist",
    "node",
    "index.js",
  );
  if (!fs.existsSync(templatesNodeDist)) {
    execSync("pnpm --filter @genui-studio/templates build", {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }
  return templatesNodeDist;
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const slug = positional[0];

  if ((!slug && !flags.all) || flags.help || flags.h) {
    console.log(`
Usage:
  pnpm ingest:standalone <project-slug> [options]
  pnpm ingest:standalone --all

Options:
  --all                 Ingest all projects in standalone-dropin/
  --title="..."         Override display title
  --tier=free|pro       Pricing tier (default: pro)
  --price=<usd>         Price in USD
  --no-build            Skip rebuilding @genui-studio/templates after ingestion
`);
    process.exit(flags.help || flags.h ? 0 : 1);
  }

  const templatesNodeDist = await ensureTemplatesNodeBuilt();
  const nodeMod = (await import(pathToFileURL(templatesNodeDist).href)) as {
    ingestStandaloneProject: (opts: {
      slug: string;
      repoRoot: string;
      title?: string;
      tier?: "free" | "pro";
      priceUsd?: number;
      overwrite?: boolean;
    }) => {
      slug: string;
      cleanFileCount: number;
      detectedSections: readonly string[];
      detectedPages: readonly string[];
      bridgeDir: string;
      cleanSourceDestDir: string;
    };
    ingestAllDropins: (repoRoot: string) => Array<{
      slug: string;
      cleanFileCount: number;
      detectedSections: readonly string[];
      detectedPages: readonly string[];
    }>;
  };

  if (flags.all) {
    const results = nodeMod.ingestAllDropins(repoRoot);
    if (results.length === 0) {
      console.log("No standalone projects found inside standalone-dropin/. Ready for drop-ins.");
      return;
    }
    if (!flags["no-build"]) {
      execSync("pnpm --filter @genui-studio/templates build", {
        cwd: repoRoot,
        stdio: "inherit",
      });
    }
    for (const res of results) {
      console.log(
        `✔ Ingested Mode B standalone "${res.slug}" (${res.cleanFileCount} clean files, ${res.detectedSections.length} sections, routes: ${res.detectedPages.join(", ")})`,
      );
    }
    return;
  }

  const result = nodeMod.ingestStandaloneProject({
    slug: slug!,
    repoRoot,
    title: typeof flags.title === "string" ? flags.title : undefined,
    tier:
      flags.tier === "free" || flags.tier === "pro" ? flags.tier : undefined,
    priceUsd:
      typeof flags.price === "string" ? Number(flags.price) : undefined,
    overwrite: true,
  });

  if (!flags["no-build"]) {
    execSync("pnpm --filter @genui-studio/templates build", {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }

  console.log(`\n✔ Mode B Standalone Project "${result.slug}" ingested successfully!`);
  console.log(`  Clean source archived: ${result.cleanSourceDestDir} (${result.cleanFileCount} files)`);
  console.log(`  GenUI Bridge created:  ${result.bridgeDir}`);
  console.log(`  Detected sections:     ${result.detectedSections.join(", ") || "PrimaryPage"}`);
  console.log(`  Detected routes:       ${result.detectedPages.join(", ")}`);
  console.log(`  Preview URL:           /preview/${result.slug}\n`);
}

main().catch((err) => {
  console.error("✖ Standalone ingestion failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
