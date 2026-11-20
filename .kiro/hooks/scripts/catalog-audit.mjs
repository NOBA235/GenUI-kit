#!/usr/bin/env node
/**
 * Kiro Hook Script: Catalog Sync & Audit Hook
 * Executed via `.kiro/hooks/catalog-schema-sync.json` (PostFileSave), by CI,
 * or manually via `node .kiro/hooks/scripts/catalog-audit.mjs`.
 *
 * Scans `packages/genui-core/src`, `packages/templates/src`, and `apps/studio-hub/src` and:
 * 1. Fails on `dangerouslySetInnerHTML` or `eval(` in non-test sources (Invariant 1).
 * 2. Counts files that define catalogs (`defineCatalog` / `createVerifiedCatalog`) and files that use
 *    the safe boundary (`wrapRegistryWithTelemetry` / `SafeGenUIRenderer`). These counts are reported, not enforced.
 * 3. Fails if a required core skeleton file is missing.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function collectTypeScriptFiles(dirPath, collected = []) {
  if (!fs.existsSync(dirPath)) return collected;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectTypeScriptFiles(fullPath, collected);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".generated.ts")) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function runAudit() {
  const startTime = performance.now();
  const scanRoots = [
    path.join(repoRoot, "packages", "genui-core", "src"),
    path.join(repoRoot, "packages", "templates", "src"),
    path.join(repoRoot, "apps", "studio-hub", "src"),
    path.join(repoRoot, "apps", "ninety9-archive", "src"),
    path.join(repoRoot, "apps", "cmos-cloud-bios", "src"),
  ];

  const allFiles = [];
  for (const root of scanRoots) {
    collectTypeScriptFiles(root, allFiles);
  }

  const violations = [];
  let catalogDefinitionsFound = 0;
  let safeBoundaryWrappersFound = 0;

  for (const filePath of allFiles) {
    const relPath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf-8");

    // Invariant 1 check: No raw dangerouslySetInnerHTML or eval() in source files
    if (!relPath.includes("__tests__")) {
      if (content.includes("dangerouslySetInnerHTML")) {
        violations.push(`[INV-01] ${relPath}: Forbidden usage of dangerouslySetInnerHTML.`);
      }
      if (/\beval\s*\(/.test(content)) {
        violations.push(`[INV-01] ${relPath}: Forbidden usage of eval().`);
      }
    }

    // Track catalog & safe boundary usage
    if (content.includes("createVerifiedCatalog") || content.includes("defineCatalog")) {
      catalogDefinitionsFound += 1;
    }
    if (content.includes("wrapRegistryWithTelemetry") || content.includes("SafeGenUIRenderer")) {
      safeBoundaryWrappersFound += 1;
    }
  }

  // Verify core skeleton required files exist
  const requiredCoreFiles = [
    "packages/genui-core/src/catalog/verified-catalog.ts",
    "packages/genui-core/src/stream/dag-sanitizer.ts",
    "packages/genui-core/src/stream/stream-compiler.ts",
    "packages/genui-core/src/state/time-travel-store.ts",
    "packages/genui-core/src/boundary/safe-renderer.tsx",
    "packages/genui-core/src/testing/index.ts",
    ".kiro/specs/core-skeleton/correctness.md",
  ];

  for (const reqFile of requiredCoreFiles) {
    const abs = path.join(repoRoot, reqFile);
    if (!fs.existsSync(abs)) {
      violations.push(`[MISSING-CORE] Required skeleton file missing: ${reqFile}`);
    }
  }

  const elapsedMs = (performance.now() - startTime).toFixed(2);
  const report = {
    hook: "catalog-schema-sync",
    status: violations.length === 0 ? "PASS" : "FAIL",
    filesScanned: allFiles.length,
    catalogDefinitionsFound,
    safeBoundaryWrappersFound,
    violations,
    elapsedMs: Number(elapsedMs),
  };

  console.log(JSON.stringify(report, null, 2));

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

runAudit();
