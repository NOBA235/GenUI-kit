#!/usr/bin/env node
/**
 * Kiro Hook Script: Auto-PBT Verification Hook
 * Executed automatically via `.kiro/hooks/spec-invariants-test.json` on PostFileSave
 * or manually via `node .kiro/hooks/scripts/run-pbt-suite.mjs`.
 *
 * Runs the `fast-check` Property-Based Testing (PBT) suite in `packages/genui-core`
 * to verify all 4 formal mathematical invariants (`INV-PBT-01` .. `INV-PBT-04`).
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

console.log("[Kiro Auto-PBT Hook] Executing @genui-studio/core fast-check invariant suite...");

try {
  execSync("pnpm --filter @genui-studio/core test:fuzz", {
    cwd: repoRoot,
    stdio: "inherit",
  });
  console.log("[Kiro Auto-PBT Hook] All formal invariants verified (100% PASS).");
} catch (err) {
  console.error("[Kiro Auto-PBT Hook] Property-Based Testing verification FAILED.");
  process.exit(1);
}
