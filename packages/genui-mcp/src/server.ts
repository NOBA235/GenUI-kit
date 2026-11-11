import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleListCatalogComponents } from "./tools/list-components.js";
import { handleValidateUiSpec } from "./tools/validate-spec.js";
import { handleFuzzTestCatalog } from "./tools/fuzz-test.js";

export interface CreateMcpServerOptions {
  name?: string;
  version?: string;
}

/**
 * Creates and configures the GenUI Studio MCP Server with all 3 core verification tools.
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
    "Inspect available UI/3D components and their Zod schemas in either app (FinOps Command Center or Spatial War-Room).",
    {
      app: z
        .enum(["finops", "spatial", "all"])
        .optional()
        .describe("Target application catalog ('finops', 'spatial', or 'all')"),
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
    "Validate a proposed JSON UI tree against a target catalog and return detailed structural diagnostics or auto-fix suggestions.",
    {
      app: z
        .enum(["finops", "spatial"])
        .describe("Target application catalog ('finops' or 'spatial')"),
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
    "Trigger a quick fast-check property test run on a component schema or the full catalog invariant suite, returning the compliance report.",
    {
      app: z
        .enum(["finops", "spatial"])
        .describe("Target application catalog ('finops' or 'spatial')"),
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

  return server;
}
