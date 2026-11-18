#!/usr/bin/env node
// End-to-end check of the built @genui-studio/mcp server through a real MCP client.
//
// Spawns `packages/genui-mcp/dist/cli.js` over stdio with the official
// @modelcontextprotocol/sdk Client, lists its tools and calls every one of them.
//
//   Pass 1 (default OTLP mode): starts the built SpatialOps collector on a free
//   port, posts the `--faulty` sample trace with examples/emit-otlp-sample.mjs,
//   then reads it back through the MCP telemetry tools.
//   Pass 2 (`--demo`): the in-memory seeded telemetry provider.
//
// Both processes get SPATIAL_OPS_OTLP_SNAPSHOT pointing at a temp file, so
// ~/.spatial-ops is never read or written. Requires `pnpm -r build` first.
// Exits 1 if any check fails.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MCP_CLI = path.join(repoRoot, "packages/genui-mcp/dist/cli.js");
const COLLECTOR_CLI = path.join(repoRoot, "apps/spatial-ops/dist-server/server/cli.js");
const EMITTER = path.join(repoRoot, "apps/spatial-ops/examples/emit-otlp-sample.mjs");
const EXPECTED_TOOLS = [
  "execute_remediation",
  "fetch_trace_spans",
  "fuzz_test_catalog",
  "list_catalog_components",
  "query_telemetry_metrics",
  "validate_ui_spec",
];

// Cycle (node-a -> shell), javascript: URI, out-of-range tuple, bad enum, unknown component.
const ADVERSARIAL_SPEC = {
  root: "shell",
  elements: {
    shell: {
      type: "AegisWarRoomShell",
      props: { incidentTitle: "MCP probe", severity: "SEV-1", activeRegion: "GLOBAL", hudPosition: "RIGHT_SPLIT" },
      children: ["node-a"],
    },
    "node-a": {
      type: "ServiceMeshNode3D",
      props: { serviceId: "srv-a", name: "javascript:alert(1)", tier: "SERVICE", position: [0, 99, 0], status: "NOT_A_STATUS", scale: 1 },
      children: ["shell"],
    },
    ghost: { type: "HallucinatedWidget", props: {}, children: [] },
  },
};

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function callJson(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.find((c) => c.type === "text")?.text ?? "";
  if (result.isError) throw new Error(`${name} returned isError: ${text}`);
  return JSON.parse(text);
}

function waitForExit(child) {
  return new Promise((resolve) => child.on("exit", (code) => resolve(code)));
}

async function startCollector(env) {
  const child = spawn(process.execPath, [COLLECTOR_CLI, "--port=0", "--host=127.0.0.1", "--in-memory"], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const port = await new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
      const match = /Listening on http:\/\/localhost:(\d+)/.exec(out);
      if (match) resolve(Number(match[1]));
    });
    child.on("exit", (code) => reject(new Error(`collector exited early (code ${code}): ${out}`)));
  });
  return { child, port };
}

async function connect(args, env) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [MCP_CLI, ...args], env, stderr: "inherit" });
  const client = new Client({ name: "genui-verify-mcp", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

async function checkCatalogTools(client) {
  const listed = await callJson(client, "list_catalog_components", { app: "spatial" });
  check("list_catalog_components returns the 15-component, 4-action spatial catalog",
    listed.components.length === 15 && listed.actions.length === 4,
    `${listed.components.length} components, ${listed.actions.length} actions, hash ${listed.catalogs[0]?.catalogHash.slice(0, 12)}`);

  const validated = await callJson(client, "validate_ui_spec", { app: "spatial", spec: ADVERSARIAL_SPEC, autoFix: true });
  const fixed = validated.autoFixedSpec;
  const rejected = validated.diagnostics.filter((d) => d.status === "rejected").map((d) => `${d.elementKey}.${d.propName}`);
  check("validate_ui_spec reports the cycle and severs it in autoFixedSpec",
    validated.valid === false && validated.graph.issues.some((i) => i.code === "cyclic_reference") && fixed.elements["node-a"].children.length === 0);
  check("validate_ui_spec neutralizes the javascript: URI and heals the bad enum",
    fixed.elements["node-a"].props.name === "#blocked-unsafe-uri" && fixed.elements["node-a"].props.status === "NOMINAL");
  check("validate_ui_spec rejects the out-of-range position and the unknown component",
    rejected.includes("node-a.position") && rejected.includes("ghost.$component"), rejected.join(", "));

  const fuzz = await callJson(client, "fuzz_test_catalog", { app: "spatial", numRuns: 20 });
  check("fuzz_test_catalog passes INV-PBT-01..04",
    fuzz.allPassed === true && fuzz.suiteReport.theorems.length === 4,
    `${fuzz.totalRuns} runs in ${fuzz.totalDurationMs} ms`);
}

async function checkTelemetryTools(client, mode) {
  const metrics = await callJson(client, "query_telemetry_metrics", {});
  check(`[${mode}] query_telemetry_metrics returns services`, metrics.services.length > 0,
    `${metrics.services.length} services, ${metrics.clusterSummary.unhealthyNodes} unhealthy`);

  const trace = await callJson(client, "fetch_trace_spans", { onlyAnomalous: true });
  check(`[${mode}] fetch_trace_spans returns an error trace`, trace.spans.length > 0 && trace.hasError === true,
    `${trace.spans.length} spans, root "${trace.rootSpanName}"`);

  const target = metrics.services[0]?.serviceId ?? "srv-missing";
  const remediation = await callJson(client, "execute_remediation", { action: "tripCircuitBreaker", targetServiceId: target });
  check(`[${mode}] execute_remediation acknowledges a known service`,
    remediation.success === true && remediation.verificationPassed !== false, `${target}: ${remediation.message}`);
}

async function main() {
  for (const file of [MCP_CLI, COLLECTOR_CLI]) {
    if (!fs.existsSync(file)) throw new Error(`${path.relative(repoRoot, file)} is missing; run pnpm -r build first.`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "genui-verify-mcp-"));
  const snapshotFile = path.join(tempDir, "otlp-snapshot.json");
  const env = { ...process.env, SPATIAL_OPS_OTLP_SNAPSHOT: snapshotFile };
  delete env.SPATIAL_OPS_DEMO;
  const homeSnapshot = path.join(os.homedir(), ".spatial-ops", "otlp-snapshot.json");
  const homeMtimeBefore = fs.existsSync(homeSnapshot) ? fs.statSync(homeSnapshot).mtimeMs : null;

  const { child: collector, port } = await startCollector(env);
  const clients = [];
  try {
    const emitter = spawn(process.execPath, [EMITTER, "--faulty"], {
      env: { ...env, OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}` },
      stdio: ["ignore", "ignore", "inherit"],
    });
    check("collector ingests the --faulty OTLP sample", (await waitForExit(emitter)) === 0 && fs.existsSync(snapshotFile), `port ${port}`);

    console.log("\n# Pass 1: genui-mcp (OTLP snapshot mode)");
    const otlpClient = await connect([], env);
    clients.push(otlpClient);
    const server = otlpClient.getServerVersion();
    const tools = (await otlpClient.listTools()).tools.map((t) => t.name).sort();
    check("server identifies as genui-studio", server?.name === "genui-studio", `${server?.name}@${server?.version}`);
    check("server lists the 6 expected tools", JSON.stringify(tools) === JSON.stringify(EXPECTED_TOOLS), tools.join(", "));
    await checkCatalogTools(otlpClient);
    await checkTelemetryTools(otlpClient, "otlp");

    console.log("\n# Pass 2: genui-mcp --demo (in-memory provider)");
    const demoClient = await connect(["--demo"], env);
    clients.push(demoClient);
    await checkTelemetryTools(demoClient, "demo");
  } finally {
    await Promise.allSettled(clients.map((c) => c.close()));
    collector.kill();
    await waitForExit(collector);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const homeMtimeAfter = fs.existsSync(homeSnapshot) ? fs.statSync(homeSnapshot).mtimeMs : null;
  check("~/.spatial-ops/otlp-snapshot.json was not touched", homeMtimeBefore === homeMtimeAfter);

  console.log(`\n${failures === 0 ? "All MCP checks passed." : `${failures} MCP check(s) failed.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

const timeout = setTimeout(() => {
  console.error("verify-mcp timed out after 60 s");
  process.exit(1);
}, 60_000);
timeout.unref();

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
