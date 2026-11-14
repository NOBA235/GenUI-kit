import fs from "node:fs";
import path from "node:path";
import { TemplateManifestSchema } from "../schema.js";
import type { TemplateFileKind, TemplateSourceFile } from "../types.js";

const EXCLUDED_SCAN_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  ".turbo",
  ".vercel",
  ".cache",
  "coverage",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".css",
  ".scss",
  ".md",
  ".mdx",
  ".svg",
  ".html",
  ".txt",
  ".yml",
  ".yaml",
  ".toml",
  ".prisma",
  ".sql",
  ".graphql",
  ".gql",
]);

const TEXT_FILENAMES = new Set([
  ".gitignore",
  ".eslintrc",
  ".prettierrc",
  ".env.example",
  "Dockerfile",
  "Makefile",
  "LICENSE",
  "README",
]);

export function isTextSourceFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (base === ".env" || (base.startsWith(".env.") && base !== ".env.example")) {
    return false;
  }
  if (TEXT_FILENAMES.has(base)) return true;
  const ext = path.extname(base).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

export function walkCleanFiles(
  rootDir: string,
  options: { maxFileSizeBytes?: number } = {},
): Array<{ relativePath: string; absolutePath: string }> {
  if (!fs.existsSync(rootDir)) return [];
  const maxBytes = options.maxFileSizeBytes ?? 512 * 1024;
  const results: Array<{ relativePath: string; absolutePath: string }> = [];

  function visit(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (EXCLUDED_SCAN_DIRS.has(entry.name)) continue;
      const absPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absPath);
      } else if (entry.isFile()) {
        if (
          entry.name === ".env" ||
          (entry.name.startsWith(".env.") && entry.name !== ".env.example")
        ) {
          continue;
        }
        const stat = fs.statSync(absPath);
        if (stat.size <= maxBytes) {
          results.push({
            relativePath: path.relative(rootDir, absPath).replace(/\\/g, "/"),
            absolutePath: absPath,
          });
        }
      }
    }
  }

  visit(rootDir);
  return results;
}

function classifyTemplateFileKind(relPath: string): TemplateFileKind {
  if (relPath === "manifest.json") return "manifest";
  if (relPath === "theme.css") return "theme";
  if (relPath === "steering.md") return "steering";
  if (relPath === "SKILL.md") return "skill";
  if (relPath === "POWER.md") return "power";
  if (relPath === "catalog.ts" || relPath.startsWith("catalog/")) {
    return "catalog";
  }
  if (relPath.startsWith("components/") || relPath.endsWith(".tsx")) {
    return "component";
  }
  return "config";
}

function toSafeIdentifier(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9]/g, "_");
}

function syncSingleTemplateBundle(
  templateDir: string,
  slug: string,
  mode: "native" | "standalone",
  standaloneSourceDir?: string,
): boolean {
  const manifestPath = path.join(templateDir, "manifest.json");
  const catalogPath = path.join(templateDir, "catalog.ts");
  const indexPath = path.join(templateDir, "index.ts");

  if (!fs.existsSync(manifestPath) || !fs.existsSync(catalogPath) || !fs.existsSync(indexPath)) {
    return false;
  }

  const rawManifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8").replace(/^\uFEFF/, ""),
  );
  const manifest = TemplateManifestSchema.parse(rawManifest);

  const themeCssPath = path.join(templateDir, "theme.css");
  const steeringPath = path.join(templateDir, "steering.md");
  const skillPath = path.join(templateDir, "SKILL.md");
  const powerPath = path.join(templateDir, "POWER.md");

  const themeCss = fs.existsSync(themeCssPath)
    ? fs.readFileSync(themeCssPath, "utf-8")
    : "";
  const steeringMd = fs.existsSync(steeringPath)
    ? fs.readFileSync(steeringPath, "utf-8")
    : `# ${manifest.title} Steering Rules\n`;
  const skillMd = fs.existsSync(skillPath)
    ? fs.readFileSync(skillPath, "utf-8")
    : `---\nname: ${manifest.slug}\ndescription: ${manifest.description}\n---\n\n# ${manifest.title} Skill\n\n${steeringMd}`;
  const kiroPowerMd = fs.existsSync(powerPath)
    ? fs.readFileSync(powerPath, "utf-8")
    : `---\nname: "${manifest.slug}"\ndisplayName: "${manifest.title}"\ndescription: "${manifest.description}"\n---\n\n# ${manifest.title} Kiro Power\n\n${steeringMd}`;

  const sourceFiles: TemplateSourceFile[] = [];

  // Collect template bridge/native files (excluding generated TS files)
  const localFiles = walkCleanFiles(templateDir);
  for (const f of localFiles) {
    if (
      f.relativePath.endsWith(".generated.ts") ||
      f.relativePath === "index.ts"
    ) {
      continue;
    }
    if (!isTextSourceFile(f.absolutePath)) continue;
    sourceFiles.push({
      path: f.relativePath,
      content: fs.readFileSync(f.absolutePath, "utf-8"),
      kind: classifyTemplateFileKind(f.relativePath),
    });
  }

  // For Mode B standalone templates, include the clean standalone project source tree
  if (mode === "standalone" && standaloneSourceDir && fs.existsSync(standaloneSourceDir)) {
    const cleanStandalone = walkCleanFiles(standaloneSourceDir);
    for (const f of cleanStandalone) {
      if (!isTextSourceFile(f.absolutePath)) continue;
      sourceFiles.push({
        path: f.relativePath,
        content: fs.readFileSync(f.absolutePath, "utf-8"),
        kind: "source",
      });
    }
  }

  const bundleContent = `// Auto-generated by syncTemplatesRegistry(). Do not edit manually.
import type { TemplateManifest, TemplateSourceFile } from ${mode === "standalone" ? '"../../types.js"' : '"../types.js"'};

export const TEMPLATE_MANIFEST: TemplateManifest = ${JSON.stringify(manifest, null, 2)};

export const TEMPLATE_THEME_CSS: string = ${JSON.stringify(themeCss)};

export const TEMPLATE_STEERING_MD: string = ${JSON.stringify(steeringMd)};

export const TEMPLATE_SKILL_MD: string = ${JSON.stringify(skillMd)};

export const TEMPLATE_KIRO_POWER_MD: string = ${JSON.stringify(kiroPowerMd)};

export const TEMPLATE_SOURCE_FILES: readonly TemplateSourceFile[] = ${JSON.stringify(sourceFiles, null, 2)};
`;

  fs.writeFileSync(
    path.join(templateDir, "bundle.generated.ts"),
    bundleContent,
    "utf-8",
  );
  return true;
}

export interface SyncTemplatesResult {
  readonly nativeSlugs: readonly string[];
  readonly standaloneSlugs: readonly string[];
  readonly registryFilePath: string;
}

/**
 * Scans `packages/templates/src/<slug>/` (Mode A) and
 * `packages/templates/src/standalone/<slug>/` (Mode B), generates per-template
 * `bundle.generated.ts` metadata modules, and updates `registry-entries.generated.ts`.
 */
export function syncTemplatesRegistry(
  repoRoot = process.cwd(),
): SyncTemplatesResult {
  const templatesPkgDir = path.join(repoRoot, "packages", "templates");
  const templatesSrcDir = path.join(templatesPkgDir, "src");
  const standaloneBridgeRoot = path.join(templatesSrcDir, "standalone");
  const standaloneSourceRoot = path.join(templatesPkgDir, "standalone-sources");

  const reservedDirs = new Set(["node", "standalone", "__tests__", "dist"]);
  const nativeSlugs: string[] = [];
  const standaloneSlugs: string[] = [];

  if (fs.existsSync(templatesSrcDir)) {
    const entries = fs
      .readdirSync(templatesSrcDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!entry.isDirectory() || reservedDirs.has(entry.name)) continue;
      const dir = path.join(templatesSrcDir, entry.name);
      if (syncSingleTemplateBundle(dir, entry.name, "native")) {
        nativeSlugs.push(entry.name);
      }
    }
  }

  if (fs.existsSync(standaloneBridgeRoot)) {
    const entries = fs
      .readdirSync(standaloneBridgeRoot, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(standaloneBridgeRoot, entry.name);
      const srcDir = path.join(standaloneSourceRoot, entry.name);
      if (syncSingleTemplateBundle(dir, entry.name, "standalone", srcDir)) {
        standaloneSlugs.push(entry.name);
      }
    }
  }

  const imports: string[] = [];
  const nativeVars: string[] = [];
  const standaloneVars: string[] = [];

  for (const slug of nativeSlugs) {
    const varName = `native_${toSafeIdentifier(slug)}`;
    imports.push(
      `import { templateEntry as ${varName} } from "./${slug}/index.js";`,
    );
    nativeVars.push(varName);
  }

  for (const slug of standaloneSlugs) {
    const varName = `standalone_${toSafeIdentifier(slug)}`;
    imports.push(
      `import { templateEntry as ${varName} } from "./standalone/${slug}/index.js";`,
    );
    standaloneVars.push(varName);
  }

  const generatedRegistry = `// This file is auto-generated by scripts/sync-templates.ts.
// Do not edit manually; run \`pnpm sync:templates\` after adding Mode A or Mode B templates.
import type { DualModeTemplateEntry } from "./types.js";
${imports.length > 0 ? imports.join("\n") + "\n" : ""}
export const GENERATED_NATIVE_TEMPLATES: readonly DualModeTemplateEntry[] = [
${nativeVars.map((v) => `  ${v},`).join("\n")}
];

export const GENERATED_STANDALONE_TEMPLATES: readonly DualModeTemplateEntry[] = [
${standaloneVars.map((v) => `  ${v},`).join("\n")}
];
`;

  const registryFilePath = path.join(
    templatesSrcDir,
    "registry-entries.generated.ts",
  );
  fs.writeFileSync(registryFilePath, generatedRegistry, "utf-8");

  return {
    nativeSlugs,
    standaloneSlugs,
    registryFilePath,
  };
}
