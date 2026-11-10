import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSONUIProvider } from "@json-render/react";
import {
  auditCatalogRegistryParity,
  createGuardrailedStreamCompiler,
  createTelemetryTracker,
  createTimeTravelStateStore,
  SafeGenUIRenderer,
  specToJsonlStream,
} from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { spatialVerifiedCatalog } from "../catalog/spatial-catalog.js";
import {
  createSpatialRegistry,
  SpatialRuntimeContext,
} from "../catalog/spatial-registry.js";
import {
  ClusterSummary,
  createInitialClusterState,
  executeSreMutation,
  ServiceNodeData,
  SreAuditEntry,
} from "../data/cluster-seed.js";
import {
  buildCascadingOutageSpec,
  buildRegionalFailoverSpec,
  buildRedisMemoryTriageSpec,
  buildSpatialChaosPackets,
  synthesizeSpatialJsonlFromPrompt,
} from "../streams/spatial-streams.js";

describe("@genui-studio/spatial-ops — Application #2 Verification Suite", () => {
  it("1. Catalog-Registry Parity Audit: confirms 100% synchronization across all 14 spatial components and 4 actions", () => {
    const { rawComponentRegistry, actionHandlers } = createSpatialRegistry();
    const registeredComponentNames = Object.keys(rawComponentRegistry);

    expect(registeredComponentNames.length).toBe(14);
    expect(spatialVerifiedCatalog.metadata.componentNames.length).toBe(14);
    expect(spatialVerifiedCatalog.metadata.actionNames.length).toBe(4);

    const audit = auditCatalogRegistryParity(
      spatialVerifiedCatalog,
      rawComponentRegistry,
      actionHandlers
    );

    expect(audit.synchronized).toBe(true);
    expect(audit.missingComponents).toEqual([]);
    expect(audit.extraComponents).toEqual([]);
    expect(audit.missingActions).toEqual([]);
    expect(audit.missingDescriptions).toEqual([]);
  });

  it("2. Formal Property-Based Testing (PBT) Suite: verifies INV-1 through INV-4 on the 14-component Spatial Catalog", () => {
    const report = runCatalogInvariantSuite(spatialVerifiedCatalog, {
      numRuns: 20,
    });
    const failures = report.theorems.filter((t) => !t.passed);
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    expect(report.allPassed).toBe(true);
    expect(report.theorems).toHaveLength(4);
  });

  it("3. Seeded 16-Node Cluster Dataset + All 4 SRE Remediation Mutations + Time-Travel Undo/Redo", () => {
    const initialState = createInitialClusterState();
    expect(Object.keys(initialState.cluster.services).length).toBe(16);
    expect(initialState.cluster.edges.length).toBeGreaterThanOrEqual(10);
    expect(initialState.cluster.logs.length).toBeGreaterThanOrEqual(5);

    const store = createTimeTravelStateStore(
      initialState as unknown as Record<string, unknown>
    );

    const initialSummary = store.get("/cluster/summary") as ClusterSummary;
    const initialUnhealthy = initialSummary.unhealthyNodes;

    // Mutation 1: Trip Circuit Breaker on srv-order-proc
    executeSreMutation(store, "tripCircuitBreaker", {
      serviceId: "srv-order-proc",
    });

    const servicesAfterCb = store.get("/cluster/services") as Record<string, ServiceNodeData>;
    expect(servicesAfterCb["srv-order-proc"]?.status).toBe("CIRCUIT_OPEN");
    expect(servicesAfterCb["srv-order-proc"]?.circuitBreakerTripped).toBe(true);

    // Mutation 2: Trigger Regional Failover from US-East to EU-West
    executeSreMutation(store, "triggerRegionalFailover", {
      fromRegion: "US-East",
      toRegion: "EU-West",
      trafficPercentage: 70,
    });

    const servicesAfterFailover = store.get("/cluster/services") as Record<string, ServiceNodeData>;
    expect(servicesAfterFailover["srv-eu-failover-gw"]?.status).toBe("NOMINAL");

    // Mutation 3: Scale Service Replicas on srv-api-gateway (+6)
    const prevReplicas = servicesAfterFailover["srv-api-gateway"]?.replicas ?? 18;
    executeSreMutation(store, "scaleServiceReplicas", {
      serviceId: "srv-api-gateway",
      deltaReplicas: 6,
    });

    const servicesAfterScale = store.get("/cluster/services") as Record<string, ServiceNodeData>;
    expect(servicesAfterScale["srv-api-gateway"]?.replicas).toBe(prevReplicas + 6);

    // Mutation 4: Rollback Deployment on srv-api-gateway
    executeSreMutation(store, "rollbackDeployment", {
      serviceId: "srv-api-gateway",
      targetVersion: "v3.8.3-stable",
    });

    const servicesAfterRollback = store.get("/cluster/services") as Record<string, ServiceNodeData>;
    expect(servicesAfterRollback["srv-api-gateway"]?.version).toBe("v3.8.3-stable");
    expect(servicesAfterRollback["srv-api-gateway"]?.status).toBe("NOMINAL");

    const auditLog = store.get("/cluster/auditLog") as SreAuditEntry[];
    expect(auditLog.length).toBeGreaterThanOrEqual(4);

    // Time-Travel Undo all 4 mutations
    expect(store.canUndo()).toBe(true);
    store.undo(); // Undo rollback
    store.undo(); // Undo scale
    store.undo(); // Undo failover
    store.undo(); // Undo circuit breaker

    const restoredSummary = store.get("/cluster/summary") as ClusterSummary;
    expect(restoredSummary.unhealthyNodes).toBe(initialUnhealthy);

    // Time-Travel Redo restores the first mutation
    expect(store.canRedo()).toBe(true);
    store.redo();
    const redoneServices = store.get("/cluster/services") as Record<string, ServiceNodeData>;
    expect(redoneServices["srv-order-proc"]?.status).toBe("CIRCUIT_OPEN");
  });

  it("4. End-to-End Stream Compilation & Spatial Chaos Outage Resilience: compiles hybrid 3D/2D specs and survives Chaos Injection with zero unhandled exceptions", () => {
    const tracker = createTelemetryTracker();
    const { safeRegistry } = createSpatialRegistry(tracker);
    const store = createTimeTravelStateStore(
      createInitialClusterState() as unknown as Record<string, unknown>
    );

    const compiler = createGuardrailedStreamCompiler({
      catalog: spatialVerifiedCatalog,
      telemetryTracker: tracker,
    });

    // Stream Scenario 1: Full SEV-1 Outage
    const mainJsonl = specToJsonlStream(buildCascadingOutageSpec());
    compiler.push(mainJsonl);
    const compiled = compiler.finalize();

    expect(compiled.spec.root).toBe("warroom-shell-root");
    expect(Object.keys(compiled.spec.elements).length).toBeGreaterThanOrEqual(18);

    const initialHtml = renderToStaticMarkup(
      React.createElement(
        SpatialRuntimeContext.Provider,
        { value: { timeTravelStore: store } },
        React.createElement(
          JSONUIProvider,
          { registry: safeRegistry, store, children: null },
          React.createElement(SafeGenUIRenderer, {
            spec: compiled.spec,
            registry: safeRegistry,
            catalog: spatialVerifiedCatalog,
            telemetryTracker: tracker,
            healedDiagnostics: compiled.healedDiagnostics,
          })
        )
      )
    );

    // Verify key 3D and 2D components rendered
    expect(initialHtml).toContain("aegis-war-room-shell");
    expect(initialHtml).toContain("cluster-topology-canvas");
    expect(initialHtml).toContain("PostgreSQL");
    expect(initialHtml).toContain("runbook-action-desk");

    // Inject Spatial Chaos Packets
    const chaosPackets = buildSpatialChaosPackets("warroom-shell-root");
    const chaosResult = compiler.push(chaosPackets.join("\n") + "\n");

    // 1. Prototype pollution must be blocked
    expect(
      ({} as Record<string, unknown>).polluted
    ).toBeUndefined();

    // Render post-chaos Spec
    const chaosHtml = renderToStaticMarkup(
      React.createElement(
        SpatialRuntimeContext.Provider,
        { value: { timeTravelStore: store } },
        React.createElement(
          JSONUIProvider,
          { registry: safeRegistry, store, children: null },
          React.createElement(SafeGenUIRenderer, {
            spec: chaosResult.spec,
            registry: safeRegistry,
            catalog: spatialVerifiedCatalog,
            telemetryTracker: tracker,
            healedDiagnostics: chaosResult.healedDiagnostics,
          })
        )
      )
    );

    // 2. Out-of-bounds scale factor (99.9x) auto-healed to 4.0 and badged
    expect(chaosHtml).toContain('data-genui-diagnostic-badge="healed"');
    expect(chaosHtml).toContain("Chaos Fuzzed Node");

    // 3. Hallucinated component quarantined into ElementFaultCard
    expect(chaosHtml).toContain('data-genui-fault-card="true"');
    expect(chaosHtml).toContain("HallucinatedQuantumQubitMesh");

    // 4. Parent war-room shell remains intact
    expect(chaosHtml).toContain("aegis-war-room-shell");

    const snap = tracker.getSnapshot();
    expect(snap.healedPropsCount).toBeGreaterThan(0);
    expect(snap.severedCyclesCount).toBeGreaterThan(0);
    expect(snap.activeFaults.length).toBeGreaterThan(0);

    // Verify other scenario builders and prompt synthesizer
    expect(buildRegionalFailoverSpec().root).toBe("warroom-shell-failover");
    expect(buildRedisMemoryTriageSpec().root).toBe("warroom-shell-redis");
    expect(
      synthesizeSpatialJsonlFromPrompt("prepare cross region failover to eu-west")
    ).toContain("warroom-shell-failover");
  });
});
