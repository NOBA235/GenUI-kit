import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleListCatalogComponents } from "./tools/list-components.js";
import { handleValidateUiSpec } from "./tools/validate-spec.js";
import { handleFuzzTestCatalog } from "./tools/fuzz-test.js";
import {
  handleQueryTelemetryMetrics,
  handleFetchTraceSpans,
  handleExecuteRemediation,
} from "./tools/telemetry-tools.js";

export interface CreateMcpServerOptions {
  name?: string;
  version?: string;
}

/**
 * Creates and configures the GenUI Studio MCP Server with core verification tools and SpatialOps telemetry tools.
 */
export function createGenUIMcpServer(
  options: CreateMcpServerOptions = {},
): McpServer {
  const server = new McpServer({
    name: options.name ?? "genui-studio",
    version: options.version ?? "1.0.0",
  });

  // Tool 1: list_catalog_components
  server.tool(
    "list_catalog_components",
    "Inspect available SpatialOps UI/3D components and their Zod schemas.",
    {
      app: z
        .enum(["spatial", "all"])
        .optional()
        .describe("Target application catalog ('spatial' or 'all')"),
      componentName: z
        .string()
        .optional()
        .describe("Optional component name to inspect in detail"),
    },
    async (args) => {
      try {
        const result = handleListCatalogComponents(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error inspecting catalog: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
        };
      }
    },
  );

  // Tool 2: validate_ui_spec
  server.tool(
    "validate_ui_spec",
    "Validate a proposed JSON UI tree against the SpatialOps catalog and return detailed structural diagnostics or auto-fix suggestions.",
    {
      app: z
        .enum(["spatial"])
        .optional()
        .describe("Target application catalog ('spatial', default: 'spatial')"),
      spec: z
        .any()
        .describe("The proposed Spec JSON tree or raw RFC 6902 JSONL text"),
      autoFix: z
        .boolean()
        .optional()
        .describe(
          "Whether to produce an auto-fixed, render-safe Spec (default: true)",
        ),
    },
    async (args) => {
      try {
        const result = handleValidateUiSpec(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error validating UI spec: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
        };
      }
    },
  );

  // Tool 3: fuzz_test_catalog
  server.tool(
    "fuzz_test_catalog",
    "Trigger a quick fast-check property test run on a component schema or the full SpatialOps catalog invariant suite, returning the compliance report.",
    {
      app: z
        .enum(["spatial"])
        .optional()
        .describe("Target application catalog ('spatial', default: 'spatial')"),
      componentName: z
        .string()
        .optional()
        .describe("Optional component name to fuzz specifically"),
      numRuns: z
        .number()
        .int()
        .min(10)
        .max(200)
        .optional()
        .describe("Number of randomized iterations (default: 50)"),
    },
    async (args) => {
      try {
        const result = handleFuzzTestCatalog(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error during fuzz testing: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
        };
      }
    },
  );

  // Tool 4: query_telemetry_metrics
  server.tool(
    "query_telemetry_metrics",
    "[Sandbox Demo / Pluggable Provider] Query service mesh telemetry metrics (RPS, error rate, p95 latency, health status) using the configured McpTelemetryProvider (defaults to an in-memory seeded simulation provider).",
    {
      serviceId: z
        .string()
        .optional()
        .describe("Optional service ID to filter (e.g. 'srv-payment-db')"),
      minErrorRate: z
        .number()
        .optional()
        .describe("Optional minimum error rate percent to filter anomalous nodes"),
    },
    async (args) => {
      try {
        const result = handleQueryTelemetryMetrics(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error querying telemetry: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
        };
      }
    },
  );

  // Tool 5: fetch_trace_spans
  server.tool(
    "fetch_trace_spans",
    "[Sandbox Demo / Pluggable Provider] Fetch distributed trace waterfall spans from the configured McpTelemetryProvider (defaults to an in-memory seeded simulation provider).",
    {
      traceId: z
        .string()
        .optional()
        .describe("Optional specific trace ID to inspect"),
      onlyAnomalous: z
        .boolean()
        .optional()
        .describe("Whether to fetch anomalous slow/error traces (default: true)"),
    },
    async (args) => {
      try {
        const result = handleFetchTraceSpans(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error fetching trace spans: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
        };
      }
    },
  );

  // Tool 6: execute_remediation
  server.tool(
    "execute_remediation",
    "[Sandbox Demo / Pluggable Provider] Dispatch an SRE remediation action (tripCircuitBreaker, scaleServiceReplicas, triggerRegionalFailover, rollbackDeployment) through the configured McpTelemetryProvider (defaults to in-memory simulation state).",
    {
      action: z
        .enum([
          "tripCircuitBreaker",
          "scaleServiceReplicas",
          "triggerRegionalFailover",
          "rollbackDeployment",
        ])
        .describe("Target remediation action"),
      targetServiceId: z
        .string()
        .describe("Target service ID (e.g. 'srv-payment-v2')"),
      parameters: z
        .record(z.string(), z.any())
        .optional()
        .describe("Optional action parameters"),
    },
    async (args) => {
      try {
        const result = handleExecuteRemediation(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error executing remediation: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
        };
      }
    },
  );

  return server;
}
