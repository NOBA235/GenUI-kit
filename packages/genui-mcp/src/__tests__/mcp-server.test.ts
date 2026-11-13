import { describe, expect, it } from "vitest";
import {
  createGenUIMcpServer,
  handleFuzzTestCatalog,
  handleListCatalogComponents,
  handleValidateUiSpec,
  handleQueryTelemetryMetrics,
  handleFetchTraceSpans,
  handleExecuteRemediation,
} from "../index.js";

describe("GenUI Studio MCP Server & Tool Handlers", () => {
  describe("Tool 1: list_catalog_components", () => {
    it("lists all 30 components and actions across both catalogs by default", () => {
      const result = handleListCatalogComponents({ app: "all" });

      expect(result.totalComponents).toBe(30); // 15 FinOps + 15 Spatial
      expect(result.catalogs).toHaveLength(2);
      expect(result.catalogs.map((c) => c.app)).toEqual(["finops", "spatial"]);
      expect(result.totalActions).toBeGreaterThanOrEqual(8); // 4 in FinOps + 4 in Spatial

      // Spot check a FinOps component
      const kpiCard = result.components.find((c) => c.name === "KpiMetricCard");
      expect(kpiCard).toBeDefined();
      expect(kpiCard?.app).toBe("finops");
      expect(kpiCard?.propsSchema.type).toBe("object");
      expect(kpiCard?.hasFallbackProps).toBe(true);

      // Spot check a 3D Spatial component
      const canvas3D = result.components.find(
        (c) => c.name === "ClusterTopologyCanvas",
      );
      expect(canvas3D).toBeDefined();
      expect(canvas3D?.app).toBe("spatial");
      expect(canvas3D?.propsSchema.type).toBe("object");
      expect(canvas3D?.slots).toContain("default");
    });

    it("filters components by specific app (finops)", () => {
      const result = handleListCatalogComponents({ app: "finops" });
      expect(result.totalComponents).toBe(15);
      expect(result.components.every((c) => c.app === "finops")).toBe(true);
      expect(result.components.map((c) => c.name)).toContain("WorkspaceShell");
      expect(result.components.map((c) => c.name)).toContain("MrrChurnChart");
      expect(result.components.map((c) => c.name)).toContain(
        "PaymentTraceInspector",
      );
    });

    it("filters components by specific app (spatial)", () => {
      const result = handleListCatalogComponents({ app: "spatial" });
      expect(result.totalComponents).toBe(15);
      expect(result.components.every((c) => c.app === "spatial")).toBe(true);
      expect(result.components.map((c) => c.name)).toContain("AegisWarRoomShell");
      expect(result.components.map((c) => c.name)).toContain("ServiceMeshNode3D");
      expect(result.components.map((c) => c.name)).toContain("TrafficFlowEdge3D");
      expect(result.components.map((c) => c.name)).toContain("TraceWaterfallViewer");
    });

    it("filters to a specific component by name", () => {
      const result = handleListCatalogComponents({
        app: "finops",
        componentName: "IssueRefundCard",
      });
      expect(result.totalComponents).toBe(1);
      expect(result.components[0]?.name).toBe("IssueRefundCard");
      expect(result.components[0]?.fallbackProps).toHaveProperty("accountId");
    });
  });

  describe("Tool 2: validate_ui_spec", () => {
    it("validates a healthy acyclic FinOps spec with 100% compliance", () => {
      const validSpec = {
        root: "shell-1",
        elements: {
          "shell-1": {
            type: "WorkspaceShell",
            props: {
              title: "Q4 Revenue Operations",
              subtitle: "Seeded enterprise accounts telemetry",
              playbookTag: "MRR_CHURN_TRIAGE",
              riskLevel: "NOMINAL",
            },
            children: ["kpi-1"],
          },
          "kpi-1": {
            type: "KpiMetricCard",
            props: {
              label: "Net ARR",
              valuePath: "/ledger/metrics/totalMrrCents",
              unit: "USD",
              deltaText: "+12.4% YoY",
              deltaDirection: "UP_GOOD",
              caption: "Audited SaaS ARR",
            },
            children: [],
          },
        },
      };

      const result = handleValidateUiSpec({
        app: "finops",
        spec: validSpec,
      });

      expect(result.valid).toBe(true);
      expect(result.graph.hasCycles).toBe(false);
      expect(result.graph.totalElementCount).toBe(2);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.healedCount).toBe(0);
      expect(result.rejectedCount).toBe(0);
      expect(result.autoFixedSpec).toBeDefined();
    });

    it("detects cyclic references and auto-fixes them into a strict DAG", () => {
      const cyclicSpec = {
        root: "node-a",
        elements: {
          "node-a": {
            type: "WorkspaceShell",
            props: {
              title: "Cyclic Test A",
              subtitle: "Sub A",
              playbookTag: "CHAOS_VERIFICATION",
              riskLevel: "CRITICAL",
            },
            children: ["node-b"],
          },
          "node-b": {
            type: "WorkspaceShell",
            props: {
              title: "Cyclic Test B",
              subtitle: "Sub B",
              playbookTag: "CHAOS_VERIFICATION",
              riskLevel: "CRITICAL",
            },
            children: ["node-a"], // Mutual cycle!
          },
        },
      };

      const result = handleValidateUiSpec({
        app: "finops",
        spec: cyclicSpec,
        autoFix: true,
      });

      expect(result.valid).toBe(false);
      expect(result.graph.hasCycles).toBe(true);
      expect(result.autoFixSuggestions.length).toBeGreaterThan(0);
      expect(
        result.autoFixSuggestions.some((s) => s.includes("Cyclic edge")),
      ).toBe(true);

      // Auto-fixed Spec must be free of cycles
      expect(result.autoFixedSpec).toBeDefined();
      const fixedChildrenB = result.autoFixedSpec?.elements["node-b"]?.children;
      expect(fixedChildrenB).not.toContain("node-a");
    });

    it("detects out-of-bounds props and heals them deterministically with fallbackProps", () => {
      const invalidPropSpec = {
        root: "discount-1",
        elements: {
          "discount-1": {
            type: "RetentionDiscountCard",
            props: {
              accountId: "acct_999",
              discountPercent: 999, // Max allowed is 50!
              durationMonths: 6,
              justification: "Massive illegal discount",
            },
            children: [],
          },
        },
      };

      const result = handleValidateUiSpec({
        app: "finops",
        spec: invalidPropSpec,
        autoFix: true,
      });

      expect(result.valid).toBe(false);
      expect(result.healedCount).toBeGreaterThan(0);
      const healedProp = result.diagnostics.find(
        (d) => d.propName === "discountPercent",
      );
      expect(healedProp?.status).toBe("healed");
      expect(healedProp?.resolvedValue).toBe(50); // Clamped to schema max bound (50)

      expect(
        result.autoFixedSpec?.elements["discount-1"]?.props?.discountPercent,
      ).toBe(50);
    });

    it("parses and validates RFC 6902 JSONL stream text directly", () => {
      const jsonlText = [
        '{"op":"add","path":"/root","value":"warroom-1"}',
        '{"op":"add","path":"/elements/warroom-1","value":{"type":"AegisWarRoomShell","props":{"incidentTitle":"Outage","severity":"SEV-1","activeRegion":"GLOBAL","hudPosition":"RIGHT_SPLIT"},"children":[]}}',
      ].join("\n");

      const result = handleValidateUiSpec({
        app: "spatial",
        spec: jsonlText,
      });

      expect(result.valid).toBe(true);
      expect(result.graph.totalElementCount).toBe(1);
      expect(result.autoFixedSpec?.root).toBe("warroom-1");
    });
  });

  describe("Tool 3: fuzz_test_catalog", () => {
    it("runs property-based fuzz tests on a specific component schema", () => {
      const result = handleFuzzTestCatalog({
        app: "spatial",
        componentName: "ClusterTopologyCanvas",
        numRuns: 20,
      });

      expect(result.allPassed).toBe(true);
      expect(result.mode).toBe("COMPONENT_FUZZ");
      expect(result.componentReport?.passed).toBe(true);
      expect(result.componentReport?.totalRuns).toBeGreaterThanOrEqual(20);
      expect(result.totalDurationMs).toBeGreaterThan(0);
    });

    it("runs the full 4-theorem PBT invariant suite against FinOps catalog", () => {
      const result = handleFuzzTestCatalog({
        app: "finops",
        numRuns: 15,
      });

      expect(result.allPassed).toBe(true);
      expect(result.mode).toBe("FULL_PBT_SUITE");
      expect(result.suiteReport?.theorems).toHaveLength(4);
      expect(result.suiteReport?.theorems.every((t) => t.passed)).toBe(true);
    });
  });

  describe("Tool 4: query_telemetry_metrics", () => {
    it("queries real-time telemetry metrics and detects anomalous services", () => {
      const result = handleQueryTelemetryMetrics();
      expect(result.clusterSummary.activeIncidents).toBeGreaterThanOrEqual(1);
      expect(result.clusterSummary.severity).toBe("SEV-1");
      expect(result.services.length).toBeGreaterThanOrEqual(4);

      // Verify specific anomalous database service
      const dbService = result.services.find((s) => s.serviceId === "srv-payment-db");
      expect(dbService).toBeDefined();
      expect(dbService?.status).toBe("CRITICAL_OUTAGE");
      expect(dbService?.errorRatePercent).toBeGreaterThan(90);
      expect(dbService?.connectionPoolUsagePercent).toBe(100);
    });

    it("filters telemetry by serviceId", () => {
      const result = handleQueryTelemetryMetrics({ serviceId: "srv-payment-db" });
      expect(result.services).toHaveLength(1);
      expect(result.services[0]?.serviceId).toBe("srv-payment-db");
    });
  });

  describe("Tool 5: fetch_trace_spans", () => {
    it("retrieves distributed trace waterfall and identifies root cause hypothesis", () => {
      const result = handleFetchTraceSpans({ onlyAnomalous: true });

      expect(result.hasError).toBe(true);
      expect(result.totalDurationMs).toBeGreaterThan(1800);
      expect(result.bottleneckServiceId).toBe("srv-payment-db");
      expect(result.rootCauseHypothesis).toContain("PostgreSQL primary connection lease saturation");
      expect(result.spans.length).toBeGreaterThanOrEqual(5);

      // Find the offending span
      const dbSpan = result.spans.find((s) => s.serviceId === "srv-payment-db");
      expect(dbSpan).toBeDefined();
      expect(dbSpan?.statusCode).toBe("ERROR");
      expect(dbSpan?.attributes["db.pool.active_connections"]).toBe(100);
    });
  });

  describe("Tool 6: execute_remediation", () => {
    it("executes verified remediation action and verifies recovery", () => {
      const result = handleExecuteRemediation({
        action: "tripCircuitBreaker",
        targetServiceId: "srv-payment-v2",
      });

      expect(result.success).toBe(true);
      expect(result.verificationPassed).toBe(true);
      expect(result.action).toBe("tripCircuitBreaker");
      expect(result.message).toContain("verified");

      // Verify telemetry metrics recovered after remediation
      const metricsAfter = handleQueryTelemetryMetrics();
      expect(metricsAfter.clusterSummary.severity).toBe("NOMINAL");
      expect(metricsAfter.clusterSummary.activeIncidents).toBe(0);
    });
  });

  describe("MCP Server Initialization", () => {
    it("instantiates McpServer with all registered tools", () => {
      const server = createGenUIMcpServer({
        name: "genui-studio-test",
        version: "1.0.0",
      });

      expect(server).toBeDefined();
    });
  });
});
