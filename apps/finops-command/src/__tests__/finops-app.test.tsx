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
import { finopsVerifiedCatalog } from "../catalog/finops-catalog.js";
import {
  createFinOpsRegistry,
  FinOpsRuntimeContext,
} from "../catalog/finops-registry.js";
import {
  createInitialFinOpsState,
  CustomerAccount,
  executeFinOpsMutation,
  FinOpsAuditEntry,
  FinOpsMetrics,
  WebhookEventRecord,
} from "../data/ledger-seed.js";
import {
  buildCorruptedChaosPackets,
  buildEnterpriseRetentionSpec,
  buildExecutiveMrrTriageSpec,
  buildStripeRecoverySpec,
  synthesizeFinOpsJsonlFromPrompt,
} from "../streams/finops-streams.js";

describe("@genui-studio/finops-command — Application #1 Verification Suite", () => {
  it("1. Catalog-Registry Parity Audit: confirms 100% synchronization across all 15 FinOps components and 4 actions", () => {
    const { rawComponentRegistry, actionHandlers } = createFinOpsRegistry();
    const registeredComponentNames = Object.keys(rawComponentRegistry);

    expect(registeredComponentNames.length).toBe(15);
    expect(finopsVerifiedCatalog.metadata.componentNames.length).toBe(15);
    expect(finopsVerifiedCatalog.metadata.actionNames.length).toBe(4);

    const audit = auditCatalogRegistryParity(
      finopsVerifiedCatalog,
      rawComponentRegistry,
      actionHandlers
    );

    expect(audit.synchronized).toBe(true);
    expect(audit.missingComponents).toEqual([]);
    expect(audit.extraComponents).toEqual([]);
    expect(audit.missingActions).toEqual([]);
    expect(audit.missingDescriptions).toEqual([]);
  });

  it("2. Formal Property-Based Testing (PBT) Suite: verifies INV-1 through INV-4 on the 15-component FinOps Catalog", () => {
    const report = runCatalogInvariantSuite(finopsVerifiedCatalog, {
      numRuns: 25,
    });
    const failures = report.theorems.filter((t) => !t.passed);
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    expect(report.allPassed).toBe(true);
    expect(report.theorems).toHaveLength(4);
  });

  it("3. Seeded 240-Account SaaS Ledger + All 4 Interactive Mutations + Time-Travel Undo/Redo", () => {
    const initialState = createInitialFinOpsState();
    expect(initialState.ledger.accounts.length).toBe(240);
    expect(initialState.ledger.mrrHistory.length).toBe(12);
    expect(initialState.ledger.cohorts.length).toBe(6);
    expect(initialState.ledger.webhooks.length).toBeGreaterThanOrEqual(8);

    const store = createTimeTravelStateStore(
      initialState as unknown as Record<string, unknown>
    );

    const initialMetrics = store.get("/ledger/metrics") as FinOpsMetrics;
    const initialMrr = initialMetrics.totalMrrCents;
    const initialDisputed = initialMetrics.disputedCents;

    // Mutation 1: Issue Partial Refund on acct_1001 ($1,850.00)
    executeFinOpsMutation(store, "issuePartialRefund", {
      accountId: "acct_1001",
      invoiceId: "in_9001",
      amountCents: 185_000,
      reason: "DISPUTE_RESOLUTION: Q4 SLA settlement",
    });

    const afterRefundMetrics = store.get("/ledger/metrics") as FinOpsMetrics;
    expect(afterRefundMetrics.disputedCents).toBeLessThan(initialDisputed);

    // Mutation 2: Extend Trial Period on acct_1008 (+14 days)
    const beforeTrialAcct = (
      store.get("/ledger/accounts") as CustomerAccount[]
    ).find((a) => a.id === "acct_1008")!;
    const initialTrialDays = beforeTrialAcct.trialDaysRemaining;

    executeFinOpsMutation(store, "extendTrialPeriod", {
      accountId: "acct_1008",
      extensionDays: 14,
      note: "Security review completion",
    });

    const afterTrialAcct = (
      store.get("/ledger/accounts") as CustomerAccount[]
    ).find((a) => a.id === "acct_1008")!;
    expect(afterTrialAcct.trialDaysRemaining).toBe(initialTrialDays + 14);
    expect(afterTrialAcct.status).toBe("TRIALING");

    // Mutation 3: Retry Failed Webhook wh_3001
    executeFinOpsMutation(store, "retryFailedWebhook", {
      webhookId: "wh_3001",
      routeGateway: "STRIPE_EU_FALLBACK",
      idempotencyKey: "idem_test_wh_3001",
    });

    const updatedWebhook = (
      store.get("/ledger/webhooks") as WebhookEventRecord[]
    ).find((w) => w.id === "wh_3001")!;
    expect(updatedWebhook.status).toBe("DELIVERED");

    // Mutation 4: Apply Retention Discount on acct_1004 (20% for 6 months)
    executeFinOpsMutation(store, "applyRetentionDiscount", {
      accountId: "acct_1004",
      discountPercent: 20,
      durationMonths: 6,
      justification: "Executive renewal save",
    });

    const discountedAcct = (
      store.get("/ledger/accounts") as CustomerAccount[]
    ).find((a) => a.id === "acct_1004")!;
    expect(discountedAcct.discountPercent).toBe(20);

    const auditLog = store.get("/ledger/auditLog") as FinOpsAuditEntry[];
    expect(auditLog.length).toBeGreaterThanOrEqual(5);

    // Verify Time-Travel Undo restores exact initial state across all 4 mutations
    expect(store.canUndo()).toBe(true);
    store.undo(); // Undo discount
    store.undo(); // Undo webhook retry
    store.undo(); // Undo trial extension
    store.undo(); // Undo partial refund

    const restoredMetrics = store.get("/ledger/metrics") as FinOpsMetrics;
    expect(restoredMetrics.totalMrrCents).toBe(initialMrr);
    expect(restoredMetrics.disputedCents).toBe(initialDisputed);

    // Verify Redo re-applies the refund deterministically
    expect(store.canRedo()).toBe(true);
    store.redo();
    const redoneMetrics = store.get("/ledger/metrics") as FinOpsMetrics;
    expect(redoneMetrics.disputedCents).toBe(afterRefundMetrics.disputedCents);
  });

  it("4. End-to-End Stream Compilation & Chaos Packet Resilience: streams all 3 playbooks and survives the Hostile Chaos Packet Batch with zero crashes", () => {
    const tracker = createTelemetryTracker();
    const { safeRegistry } = createFinOpsRegistry(tracker);
    const store = createTimeTravelStateStore(
      createInitialFinOpsState() as unknown as Record<string, unknown>
    );

    // Stream Playbook 1 (Full 14-component surface) through GuardrailedStreamCompiler
    const compiler = createGuardrailedStreamCompiler({
      catalog: finopsVerifiedCatalog,
      telemetryTracker: tracker,
    });

    const mainJsonl = specToJsonlStream(buildExecutiveMrrTriageSpec());
    compiler.push(mainJsonl);
    const compiled = compiler.finalize();

    expect(compiled.spec.root).toBe("root-shell");
    // 1 shell + 4 sections + 4 KPIs + waterfall + chart + matrix + anomaly + ticker
    // + 4 mutation cards + ledger + audit banner = 20 elements
    expect(Object.keys(compiled.spec.elements).length).toBe(20);

    const initialHtml = renderToStaticMarkup(
      React.createElement(
        FinOpsRuntimeContext.Provider,
        { value: { timeTravelStore: store } },
        React.createElement(
          JSONUIProvider,
          { registry: safeRegistry, store, children: null },
          React.createElement(SafeGenUIRenderer, {
            spec: compiled.spec,
            registry: safeRegistry,
            catalog: finopsVerifiedCatalog,
            telemetryTracker: tracker,
          })
        )
      )
    );

    // Verify key FinOps components and WCAG table attributes rendered cleanly
    expect(initialHtml).toContain("Q4 Global RevOps &amp; EMEA Churn Command Center");
    expect(initialHtml).toContain("Interactive 240-Account Subscription &amp; Invoice Ledger");
    expect(initialHtml).toContain('aria-sort="descending"');
    expect(initialHtml).not.toContain('aria-sort="none"');

    // Now inject the Hostile / Corrupted AI Packet Batch into the active compiler
    const chaosPackets = buildCorruptedChaosPackets("root-shell");
    const chaosResult = compiler.push(chaosPackets.join("\n") + "\n");

    // 1. Prototype pollution must be blocked
    expect(
      ({} as Record<string, unknown>).polluted
    ).toBeUndefined();

    // Render the post-chaos Spec through SafeGenUIRenderer
    const chaosHtml = renderToStaticMarkup(
      React.createElement(
        FinOpsRuntimeContext.Provider,
        { value: { timeTravelStore: store } },
        React.createElement(
          JSONUIProvider,
          { registry: safeRegistry, store, children: null },
          React.createElement(SafeGenUIRenderer, {
            spec: chaosResult.spec,
            registry: safeRegistry,
            catalog: finopsVerifiedCatalog,
            telemetryTracker: tracker,
            healedDiagnostics: chaosResult.healedDiagnostics,
          })
        )
      )
    );

    // 2. Out-of-bounds 999% discount card was healed to 50% and rendered a DiagnosticHealedBadge
    expect(chaosHtml).toContain('data-genui-diagnostic-badge="healed"');
    expect(chaosHtml).toContain("Apply 50% Retention Discount");

    // 3. Throwing KpiMetricCard and HallucinatedStripeQuantumWidget were quarantined in ElementFaultCards
    expect(chaosHtml).toContain('data-genui-fault-card="true"');
    expect(chaosHtml).toContain("HallucinatedStripeQuantumWidget");

    // 4. Parent workspace & 240-account ledger remained 100% intact and un-crashed
    expect(chaosHtml).toContain("Q4 Global RevOps &amp; EMEA Churn Command Center");
    expect(chaosHtml).toContain("Interactive 240-Account Subscription &amp; Invoice Ledger");

    const snap = tracker.getSnapshot();
    expect(snap.healedPropsCount).toBeGreaterThan(0);
    expect(snap.severedCyclesCount).toBeGreaterThan(0);
    expect(snap.activeFaults.length).toBeGreaterThan(0);

    // Also verify Playbooks 2, 3, and natural language intent synthesizer produce valid specs
    expect(buildStripeRecoverySpec().root).toBe("root-recovery");
    expect(buildEnterpriseRetentionSpec().root).toBe("root-retention");
    expect(
      synthesizeFinOpsJsonlFromPrompt("retry failed stripe webhook and issue refund")
    ).toContain("root-recovery");
  });
});
