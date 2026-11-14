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
    it("lists all 15 SpatialOps components and actions by default", () => {
      const result = handleListCatalogComponents({ app: "all" });

      expect(result.totalComponents).toBe(15);
      expect(result.catalogs).toHaveLength(1);
      expect(result.catalogs.map((c) => c.app)).toEqual(["spatial"]);
      expect(result.totalActions).toBeGreaterThanOrEqual(4);

      // Spot check a 3D Spatial component
      const canvas3D = result.components.find(
        (c) => c.name === "ClusterTopologyCanvas",
      );
      expect(canvas3D).toBeDefined();
      expect(canvas3D?.app).toBe("spatial");
      expect(canvas3D?.propsSchema.type).toBe("object");
      expect(canvas3D?.slots).toContain("default");
    });

    it("filters components by spatial app", () => {
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
        app: "spatial",
        componentName: "ServiceMeshNode3D",
      });
      expect(result.totalComponents).toBe(1);
      expect(result.components[0]?.name).toBe("ServiceMeshNode3D");
      expect(result.components[0]?.fallbackProps).toHaveProperty("serviceId");
    });
  });

  describe("Tool 2: validate_ui_spec", () => {
    it("validates a healthy acyclic Spatial spec with 100% compliance", () => {
      const validSpec = {
        root: "shell-1",
        elements: {
          "shell-1": {
            type: "AegisWarRoomShell",
            props: {
              incidentTitle: "Payment DB Saturation",
              severity: "SEV-1",
              activeRegion: "US-East",
              hudPosition: "RIGHT_SPLIT",
            },
            slots: {
              spatial: ["canvas-1"],
              hud: [],
            },
            children: [],
          },
          "canvas-1": {
            type: "ClusterTopologyCanvas",
            props: {
              cameraFov: 50,
              enableOrbitControls: true,
              enableGrid: true,
              enableBloom: true,
              ambientIntensity: 0.8,
            },
            children: [],
          },
        },
      };

      const result = handleValidateUiSpec({
        app: "spatial",
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
            type: "AegisWarRoomShell",
            props: {
              incidentTitle: "Cyclic Test A",
              severity: "SEV-1",
              activeRegion: "GLOBAL",
              hudPosition: "RIGHT_SPLIT",
            },
            children: ["node-b"],
          },
          "node-b": {
            type: "AegisWarRoomShell",
            props: {
              incidentTitle: "Cyclic Test B",
              severity: "SEV-1",
              activeRegion: "GLOBAL",
              hudPosition: "RIGHT_SPLIT",
            },
            children: ["node-a"], // Mutual cycle!
          },
        },
      };

      const result = handleValidateUiSpec({
        app: "spatial",
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
        root: "canvas-1",
        elements: {
          "canvas-1": {
            type: "ClusterTopologyCanvas",
            props: {
              cameraFov: 999, // Max allowed is 90!
              enableOrbitControls: true,
              enableGrid: true,
              enableBloom: true,
              ambientIntensity: 0.8,
            },
            children: [],
          },
        },
      };

      const result = handleValidateUiSpec({
        app: "spatial",
        spec: invalidPropSpec,
        autoFix: true,
      });

      expect(result.valid).toBe(false);
      expect(result.healedCount).toBeGreaterThan(0);
      const healedProp = result.diagnostics.find(
        (d) => d.propName === "cameraFov",
      );
      expect(healedProp?.status).toBe("healed");
      expect(healedProp?.resolvedValue).toBe(90); // Clamped to schema max bound (90)

      expect(
        result.autoFixedSpec?.elements["canvas-1"]?.props?.cameraFov,
      ).toBe(90);
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

    it("runs the full 4-theorem PBT invariant suite against SpatialOps catalog", () => {
      const result = handleFuzzTestCatalog({
        app: "spatial",
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
