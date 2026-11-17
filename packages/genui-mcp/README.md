# `@genui-studio/mcp` · GenUI Studio Model Context Protocol Server

The Model Context Protocol (MCP) server for **GenUI Studio**. It exposes production UI verification tools (catalog introspection, Zod prop validation/healing, DAG sanitization, and live `fast-check` fuzzing) alongside pluggable OpenTelemetry/service-mesh inspection tools for **SpatialOps**.

---

## 🛠️ Exposed MCP Tools

### Core Spec & Catalog Verification Tools
| Tool | Parameters | Description |
|---|---|---|
| `list_catalog_components` | `app?: "spatial" \| "all"`, `componentName?: string` | Introspects available SpatialOps UI/3D components and their JSON Schema derived from Zod prop contracts. |
| `validate_ui_spec` | `app?: "spatial"`, `spec: object \| string`, `autoFix?: boolean` | Validates a proposed Spec DAG, RFC 6902 JSONL patch stream, or SSE stream against the target catalog, detecting cycles, dangling pointers, prototype pollution, unsafe URIs, and out-of-bounds props. |
| `fuzz_test_catalog` | `app?: "spatial"`, `componentName?: string`, `numRuns?: number` | Runs randomized `fast-check` property checks against a component schema or the catalog invariant suite. |

### SpatialOps Telemetry Tools (Live OTLP Snapshot & Pluggable Providers)
These tools expose telemetry inspection and remediation hooks:
- `query_telemetry_metrics`, `fetch_trace_spans`, `execute_remediation`

**Snapshot location (shared with the SpatialOps OTLP collector):**

| Setting | Value |
|---|---|
| Default path | `~/.spatial-ops/otlp-snapshot.json` |
| Override | `SPATIAL_OPS_OTLP_SNAPSHOT=/abs/path/snapshot.json` (empty values are ignored) |

The collector (`pnpm --filter @genui-studio/spatial-ops collector`, OTLP/HTTP JSON on `:4318`) writes this file atomically. By default `OtlpSnapshotMcpTelemetryProvider` reads it on every tool call. Set `SPATIAL_OPS_OTLP_SNAPSHOT` to the **same value** for both processes. If the file does not exist yet, the tools return empty results (`fetch_trace_spans` includes collector setup instructions); they do **not** substitute synthetic data. Pass `--demo` (or set `SPATIAL_OPS_DEMO=1`) to use the in-memory synthetic `DefaultMcpTelemetryProvider` instead, or call `setMcpTelemetryProvider` to plug in a custom provider.

---

## 🚀 Quickstart & Standalone Execution

### Run as Stdio Server
```bash
# Build the package
pnpm --filter @genui-studio/mcp build

# Start the MCP STDIO server
node ./packages/genui-mcp/dist/cli.js
```

### Kiro IDE / CLI Configuration (`.kiro/settings/mcp.json`)
```json
{
  "mcpServers": {
    "genui-studio": {
      "command": "node",
      "args": ["./packages/genui-mcp/dist/cli.js"],
      "env": {
        "NODE_ENV": "production"
      },
      "disabled": false,
      "autoApprove": [
        "list_catalog_components",
        "validate_ui_spec",
        "fuzz_test_catalog"
      ]
    }
  }
}
```

---

## 🧪 Testing
```bash
pnpm --filter @genui-studio/mcp test
```
Verifies SpatialOps catalog JSON-schema serialization, cycle severing, prop healing, `fast-check` fuzz execution, and pluggable telemetry MCP tool handlers.
