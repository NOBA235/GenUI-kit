# `@genui-studio/mcp` · GenUI Studio Model Context Protocol Server

The official Model Context Protocol (MCP) server for **GenUI Studio**. It exposes catalog introspection, Zod prop contract validation, RFC 6902 DAG cycle remediation, and live Property-Based Testing (PBT) fuzzing directly to Kiro IDE, Kiro CLI, Claude Desktop, Cursor, and any MCP-compatible coding agent.

---

## 🛠️ Exposed MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `list_catalog_components` | `app: "finops" \| "spatial" \| "all"`, `componentName?: string` | Introspects available UI/3D components and their full Zod prop schemas across both domain apps. |
| `validate_ui_spec` | `app: "finops" \| "spatial"`, `spec: object \| string`, `autoFix?: boolean` | Validates a proposed Spec DAG or raw RFC 6902 JSONL stream against the target catalog, detecting cycles, dangling pointers, prototype pollution, and out-of-bounds props with auto-fix suggestions. |
| `fuzz_test_catalog` | `app: "finops" \| "spatial"`, `componentName?: string`, `numRuns?: number` | Triggers a live `fast-check` property test run against a specific component or the entire 4-theorem catalog invariant suite. |

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
All 11 unit tests verify schema serialization, cycle severing, prop healing, and PBT execution.
