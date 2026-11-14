#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGenUIMcpServer } from "./server.js";
import { setMcpTelemetryProvider } from "./tools/telemetry-tools.js";
import { OtlpSnapshotMcpTelemetryProvider } from "./tools/otlp-snapshot-provider.js";

async function main() {
  const isDemoMode =
    process.argv.includes("--demo") || process.env.SPATIAL_OPS_DEMO === "1";
  if (!isDemoMode) {
    setMcpTelemetryProvider(new OtlpSnapshotMcpTelemetryProvider());
  }

  const server = createGenUIMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting GenUI Studio MCP Server:", err);
  process.exit(1);
});
