#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGenUIMcpServer } from "./server.js";

async function main() {
  const server = createGenUIMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting GenUI Studio MCP Server:", err);
  process.exit(1);
});
