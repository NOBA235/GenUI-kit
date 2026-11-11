import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LiveServiceMeshSimulator } from "../telemetry/live-service-mesh.js";
import { TelemetryBridge } from "../telemetry/telemetry-bridge.js";
import { createTimeTravelStateStore } from "@genui-studio/core";
import { createInitialClusterState } from "../data/cluster-seed.js";

describe("Telemetry & Chaos Target Subsystem", () => {
  let mesh: LiveServiceMeshSimulator;

  beforeEach(() => {
    mesh = new LiveServiceMeshSimulator();
    mesh.stopEmitting(); // manual ticking for deterministic tests
  });

  afterEach(() => {
    mesh.stopEmitting();
  });

  it("emits nominal traces under normal conditions", () => {
    let capturedTrace: any = null;
    mesh.onTrace((t) => {
      capturedTrace = t;
    });

    mesh.tick();

    expect(capturedTrace).not.toBeNull();
    expect(capturedTrace.hasError).toBe(false);
    expect(capturedTrace.spans.length).toBeGreaterThanOrEqual(6);
    expect(capturedTrace.totalDurationMs).toBeLessThan(100);

    const metrics = mesh.computeMetrics();
    expect(metrics["srv-payment-db"]?.status).toBe("NOMINAL");
    expect(metrics["srv-payment-db"]?.errorRatePercent).toBe(0);
  });

  it("injects DB pool starvation chaos and cascades errors up to ingress", () => {
    let capturedTrace: any = null;
    mesh.onTrace((t) => {
      capturedTrace = t;
    });

    mesh.injectChaos({
      targetServiceId: "srv-payment-db",
      faultType: "DB_POOL_STARVATION",
      injectedLatencyMs: 1820,
      errorProbability: 1.0,
      description: "Postgres connection pool saturation",
    });

    expect(capturedTrace).not.toBeNull();
    expect(capturedTrace.hasError).toBe(true);
    expect(capturedTrace.totalDurationMs).toBeGreaterThan(1800);

    // Verify offending DB span
    const dbSpan = capturedTrace.spans.find((s: any) => s.serviceId === "srv-payment-db");
    expect(dbSpan?.statusCode).toBe("ERROR");
    expect(dbSpan?.durationMs).toBe(1820);
    expect(dbSpan?.attributes["db.pool.active_connections"]).toBe(100);

    // Verify metrics reflection
    const metrics = mesh.computeMetrics();
    expect(metrics["srv-payment-db"]?.status).toBe("CRITICAL_OUTAGE");
    expect(metrics["srv-payment-db"]?.connectionPoolUsagePercent).toBe(100);
    expect(metrics["srv-payment-v2"]?.status).toBe("CRITICAL_OUTAGE");
    expect(metrics["srv-api-gateway"]?.status).toBe("DEGRADED");
  });

  it("executes remediation and verifies instant recovery", () => {
    mesh.injectChaos({
      targetServiceId: "srv-payment-db",
      faultType: "DB_POOL_STARVATION",
      injectedLatencyMs: 1820,
      errorProbability: 1.0,
      description: "Postgres connection pool saturation",
    });

    const remResult = mesh.executeRemediation({
      action: "tripCircuitBreaker",
      targetServiceId: "srv-payment-v2",
    });

    expect(remResult.success).toBe(true);
    expect(remResult.verificationPassed).toBe(true);

    let recoveredTrace: any = null;
    mesh.onTrace((t) => {
      recoveredTrace = t;
    });

    mesh.tick();

    expect(recoveredTrace.hasError).toBe(false);
    expect(recoveredTrace.totalDurationMs).toBeLessThan(100);

    const metrics = mesh.computeMetrics();
    expect(metrics["srv-payment-v2"]?.status).toBe("CIRCUIT_OPEN");
    expect(metrics["srv-payment-v2"]?.errorRatePercent).toBe(0);
    expect(metrics["srv-order-service"]?.status).toBe("NOMINAL");
  });

  it("bridges live telemetry to TimeTravelStateStore", () => {
    const store = createTimeTravelStateStore(
      createInitialClusterState() as unknown as Record<string, unknown>
    );
    const bridge = new TelemetryBridge();
    bridge.attachToStore(store);

    bridge.injectDbPoolChaos();

    const summary: any = store.get("/cluster/summary");
    expect(summary.severity).toBe("SEV-1");
    expect(summary.unhealthyNodes).toBeGreaterThanOrEqual(3);

    bridge.detach();
  });
});
