#!/usr/bin/env node
// Fails when a workspace package is missing one of the scripts CI runs recursively.
// `pnpm -r <script>` skips packages that lack the script and still exits 0, so a
// missing script would otherwise drop that package from CI without any signal.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_SCRIPTS = ["build", "typecheck", "lint", "test"];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const projects = JSON.parse(
  execSync("pnpm ls -r --depth -1 --json", { cwd: repoRoot, encoding: "utf8" }),
).filter((project) => path.resolve(project.path) !== repoRoot);

if (projects.length === 0) {
  console.error("[check-workspace-scripts] pnpm reported no workspace packages.");
  process.exit(1);
}

const failures = [];
for (const project of projects) {
  const manifest = JSON.parse(fs.readFileSync(path.join(project.path, "package.json"), "utf8"));
  const missing = REQUIRED_SCRIPTS.filter((name) => typeof manifest.scripts?.[name] !== "string");
  const rel = path.relative(repoRoot, project.path).replace(/\\/g, "/");
  if (missing.length > 0) failures.push(`${manifest.name} (${rel}): missing ${missing.join(", ")}`);
  else console.log(`[check-workspace-scripts] ok  ${manifest.name} (${rel})`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[check-workspace-scripts] FAIL ${failure}`);
  process.exit(1);
}
console.log(`[check-workspace-scripts] ${projects.length} packages declare: ${REQUIRED_SCRIPTS.join(", ")}`);
