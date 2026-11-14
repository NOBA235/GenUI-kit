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

  if (!slug || flags.help || flags.h) {
    console.log(`
Usage:
  pnpm new:template <slug> [options]

Options:
  --title="..."         Human-readable template title
  --category="..."      Category (e.g. "B2B SaaS", "3D / WebGL", "E-Commerce", "Web3 / DeFi")
  --tier=free|pro       Pricing tier (default: pro)
  --price=<usd>         Price in USD
  --theme=dark|light    Default color scheme (default: dark)
  --overwrite           Overwrite existing template directory
  --no-build            Skip rebuilding @genui-studio/templates after scaffolding
`);
    process.exit(slug ? 0 : 1);
  }

  const templatesNodeDist = await ensureTemplatesNodeBuilt();
  const nodeMod = (await import(pathToFileURL(templatesNodeDist).href)) as {
    scaffoldNativeTemplate: (opts: {
      slug: string;
      repoRoot: string;
      title?: string;
      category?: string;
      tier?: "free" | "pro";
      priceUsd?: number;
      colorScheme?: "dark" | "light";
      overwrite?: boolean;
    }) => {
      slug: string;
      templateDir: string;
      filesCreated: readonly string[];
    };
  };

  const result = nodeMod.scaffoldNativeTemplate({
    slug,
    repoRoot,
    title: typeof flags.title === "string" ? flags.title : undefined,
    category: typeof flags.category === "string" ? flags.category : undefined,
    tier:
      flags.tier === "free" || flags.tier === "pro" ? flags.tier : undefined,
    priceUsd:
      typeof flags.price === "string" ? Number(flags.price) : undefined,
    colorScheme:
      flags.theme === "light" || flags.theme === "dark"
        ? flags.theme
        : undefined,
    overwrite: Boolean(flags.overwrite),
  });

  if (!flags["no-build"]) {
    execSync("pnpm --filter @genui-studio/templates build", {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }

  console.log(`\n✔ Mode A Native Template "${result.slug}" scaffolded at:`);
  console.log(`  ${result.templateDir}`);
  console.log(`  Files created: ${result.filesCreated.join(", ")}`);
  console.log(`  Preview URL: /preview/${result.slug}\n`);
}

main().catch((err) => {
  console.error("✖ Failed to scaffold Mode A template:", err instanceof Error ? err.message : err);
  process.exit(1);
});
