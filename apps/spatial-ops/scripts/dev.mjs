import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

const tscBin = require.resolve("typescript/bin/tsc");
const viteBin = require.resolve("vite/bin/vite.js");
const forwardArgs = process.argv.slice(2);

const buildResult = spawnSync(
  process.execPath,
  [tscBin, "-p", "tsconfig.server.json"],
  { cwd: appRoot, stdio: "inherit" }
);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const collectorChild = spawn(
  process.execPath,
  [path.join(appRoot, "dist-server", "server", "cli.js"), ...forwardArgs],
  { cwd: appRoot, stdio: "inherit" }
);

const viteChild = spawn(
  process.execPath,
  [viteBin, "--port", "5174"],
  { cwd: appRoot, stdio: "inherit" }
);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!collectorChild.killed) collectorChild.kill();
  if (!viteChild.killed) viteChild.kill();
  process.exit(code);
}

collectorChild.on("exit", (code) => {
  if (!shuttingDown) shutdown(code ?? 0);
});
viteChild.on("exit", (code) => {
  if (!shuttingDown) shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
