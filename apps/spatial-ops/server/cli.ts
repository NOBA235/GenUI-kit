#!/usr/bin/env node
import {
  getDefaultOtlpStoragePaths,
  startOtlpCollectorServer,
} from "./otlp-collector.js";

function parseCliArgs(argv: string[]): {
  port: number;
  host: string;
  demoMode: boolean;
  dataFile?: string | false;
} {
  let port = Number(process.env.OTLP_PORT ?? 4318);
  let host = process.env.OTLP_HOST ?? "127.0.0.1";
  let demoMode = process.env.SPATIAL_OPS_DEMO === "1";
  let dataFile: string | false | undefined =
    process.env.SPATIAL_OPS_DATA_FILE === "none"
      ? false
      : process.env.SPATIAL_OPS_DATA_FILE;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--demo") {
      demoMode = true;
    } else if (arg === "--in-memory") {
      dataFile = false;
    } else if (arg.startsWith("--port=")) {
      port = Number(arg.slice("--port=".length));
    } else if (arg === "--port" && argv[i + 1]) {
      port = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--host=")) {
      host = arg.slice("--host=".length);
    } else if (arg === "--host" && argv[i + 1]) {
      host = argv[i + 1]!;
      i += 1;
    } else if (arg.startsWith("--data-file=")) {
      const val = arg.slice("--data-file=".length);
      dataFile = val === "none" ? false : val;
    }
  }

  return {
    port: Number.isFinite(port) && port >= 0 ? port : 4318,
    host,
    demoMode,
    dataFile,
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const collector = await startOtlpCollectorServer(args);
  const paths = getDefaultOtlpStoragePaths();

  console.log(
    `[SpatialOps OTLP] Listening on http://localhost:${collector.port}/v1/{traces,logs,metrics} (${collector.demoMode ? "DEMO SEEDED" : "LIVE WAITING"})`
  );
  console.log(
    `[SpatialOps OTLP] Snapshot SSE: http://localhost:${collector.port}/api/events | Storage: ${args.dataFile === false ? "in-memory" : (args.dataFile ?? paths.dataFile)}`
  );

  const shutdown = async () => {
    await collector.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[SpatialOps OTLP] Fatal collector startup error:", err);
  process.exit(1);
});
