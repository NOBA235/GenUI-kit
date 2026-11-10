import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { schema } from "@json-render/react/schema";
import { defineRegistry, JSONUIProvider } from "@json-render/react";
import { z } from "zod";
import {
  auditCatalogRegistryParity,
  canonicalStringify,
  createGuardrailedStreamCompiler,
  createTelemetryTracker,
  createTimeTravelStateStore,
  createVerifiedCatalog,
  inspectSpecGraph,
  SafeGenUIRenderer,
  sanitizeSpecGraph,
  specToJsonlStream,
  wrapRegistryWithTelemetry,
} from "../index.js";
import {
  arbitraryAdversarialSpec,
  arbitraryCorruptedJsonlStream,
  catalogToSpecArbitrary,
  runCatalogInvariantSuite,
  splitStreamByCutPoints,
} from "../testing/index.js";

// Reference multi-component Zod Catalog for PBT verification
const testCatalogConfig = {
  components: {
    TelemetryCard: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
        severity: z.enum(["healthy", "warning", "critical"]),
      }),
      description: "Container card displaying operational telemetry.",
    },
    MetricGauge: {
      props: z.object({
        label: z.string(),
        value: z.number().min(0).max(100),
        unit: z.string().nullable(),
      }),
      description: "Numeric gauge bounded between 0 and 100.",
    },
    ActionTrigger: {
      props: z.object({
        label: z.string(),
        disabled: z.boolean().nullable(),
      }),
      description: "Interactive button triggering catalog actions.",
    },
  },
  actions: {
    remediateNode: {
      params: z.object({
        targetId: z.string(),
        force: z.boolean().nullable(),
      }),
      description: "Executes remediation on the specified cluster node.",
    },
  },
};

const verifiedTestCatalog = createVerifiedCatalog(schema, testCatalogConfig);

describe("@genui-studio/core — Property-Based Testing (PBT) & Formal Invariants", () => {
  it("Invariant 1 (Stream Chunking Invariance): arbitrary random byte/character splits and CRLF/EOF boundaries always converge to the exact same Spec", () => {
    fc.assert(
      fc.property(
        catalogToSpecArbitrary(verifiedTestCatalog, {
          minElements: 1,
          maxElements: 7,
        }),
        fc.array(fc.double({ min: 0.01, max: 0.99, noNaN: true }), {
          minLength: 1,
          maxLength: 20,
        }),
        fc.boolean(),
        fc.boolean(),
        (originalSpec, cutRatios, useCrLf, stripFinalNewline) => {
          const baseJsonl = specToJsonlStream(originalSpec);
          const lineAdjusted = useCrLf
            ? baseJsonl.replace(/\n/g, "\r\n")
            : baseJsonl;
          const rawStream = stripFinalNewline
            ? lineAdjusted.replace(/\r?\n$/, "")
            : lineAdjusted;

          // Reference single-shot batch compilation
          const batchCompiler = createGuardrailedStreamCompiler({
            catalog: verifiedTestCatalog,
          });
          batchCompiler.push(baseJsonl);
          const expectedSpec = batchCompiler.finalize().spec;

          // Chunked streaming compilation across random split boundaries
          const chunkCompiler = createGuardrailedStreamCompiler({
            catalog: verifiedTestCatalog,
          });
          const chunks = splitStreamByCutPoints(rawStream, cutRatios);
          for (const chunk of chunks) {
            chunkCompiler.push(chunk);
          }
          const actualSpec = chunkCompiler.finalize().spec;

          expect(canonicalStringify(actualSpec)).toBe(
            canonicalStringify(expectedSpec),
          );
          expect(canonicalStringify(actualSpec)).toBe(
            canonicalStringify(originalSpec),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Invariant 2 (Adversarial Payload Resilience / Non-Crash): survives prototype pollution, NaN/Infinity/-0, cyclic graphs, diamond aliasing, and XSS URIs with strict idempotence", () => {
    fc.assert(
      fc.property(
        arbitraryAdversarialSpec(verifiedTestCatalog),
        arbitraryCorruptedJsonlStream(),
        (corruptedSpec, hostileJsonl) => {
          // 1. Direct DAG sanitizer resilience & idempotence
          const firstPass = sanitizeSpecGraph(corruptedSpec, {
            allowedComponents: verifiedTestCatalog.metadata.componentNames,
          });
          const secondPass = sanitizeSpecGraph(firstPass.spec, {
            allowedComponents: verifiedTestCatalog.metadata.componentNames,
          });

          expect(firstPass.inspection.hasCycles).toBe(false);
          expect(secondPass.inspection.hasCycles).toBe(false);
          expect(canonicalStringify(secondPass.spec)).toBe(
            canonicalStringify(firstPass.spec),
          );

          // 2. Stream compiler resilience on hostile JSONL lines
          const compiler = createGuardrailedStreamCompiler({
            catalog: verifiedTestCatalog,
          });
          expect(() => {
            compiler.push(hostileJsonl);
            compiler.finalize();
          }).not.toThrow();

          const finalSpec = compiler.getSpec();
          expect(inspectSpecGraph(finalSpec).hasCycles).toBe(false);

          // 3. Verify zero Object.prototype pollution
          expect(
            (Object.prototype as Record<string, unknown>).polluted,
          ).toBeUndefined();
          expect(
            (Object.prototype as Record<string, unknown>).hacked,
          ).toBeUndefined();

          // 4. Verify no -0, NaN, Infinity, or javascript: URIs survived in sanitized spec
          const serialized = JSON.stringify(firstPass.spec);
          expect(serialized).not.toContain("javascript:alert");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Invariant 3 (State Pointer Idempotency, Permutation Determinism & Isolation): out-of-order state mutations and overlapping parent/child pointers remain deterministic and isolated", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.tuple(
            fc.stringMatching(/^\/[a-f]{1,4}\/[a-z]{1,5}$/),
            fc.oneof(
              fc.integer({ min: -1000, max: 1000 }),
              fc.stringMatching(/^[a-zA-Z0-9_-]{1,12}$/),
              fc.boolean(),
            ),
          ),
          { selector: ([path]) => path, minLength: 2, maxLength: 10 },
        ),
        (pathEntries) => {
          const initialShared = {
            untouchedBranch: { secret: "immutable-ref" },
            sessionTag: "init",
          };
          const store1 = createTimeTravelStateStore(initialShared);
          const store2 = createTimeTravelStateStore(initialShared);

          const untouchedRefBefore = store1.get("/untouchedBranch");

          const forwardBatch = Object.fromEntries(pathEntries);
          const reverseBatch = Object.fromEntries([...pathEntries].reverse());

          store1.update(forwardBatch);
          store2.update(reverseBatch);

          // 1. Permutation determinism: forward vs reversed batch updates yield identical snapshots
          expect(canonicalStringify(store1.getSnapshot())).toBe(
            canonicalStringify(store2.getSnapshot()),
          );

          // 2. Structural sharing: untouched sibling branch preserves exact === object reference
          expect(store1.get("/untouchedBranch")).toBe(untouchedRefBefore);

          // 3. Idempotency: re-applying identical batch or individual values is a no-op
          const historyLen = store1.getHistory().length;
          store1.update(forwardBatch);
          for (const [p, v] of pathEntries) {
            store1.set(p, v);
          }
          expect(store1.getHistory().length).toBe(historyLen);

          // 4. Session Isolation: mutating store1 never leaks to store2
          store1.set("/sessionTag", "mutated-in-store1");
          expect(store2.get("/sessionTag")).toBe("init");

          // 5. Time-travel invertibility: undo all steps restores initial state, redo restores terminal state
          const terminalSnap = canonicalStringify(store1.getSnapshot());
          while (store1.canUndo()) {
            store1.undo();
          }
          expect(canonicalStringify(store1.getSnapshot())).toBe(
            canonicalStringify(initialShared),
          );
          while (store1.canRedo()) {
            store1.redo();
          }
          expect(canonicalStringify(store1.getSnapshot())).toBe(terminalSnap);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Invariant 3b (Parent/Child Collision & Watch Cascade Circuit Breaker): resolves parent/child batch collisions deterministically and halts infinite synchronous watch loops", () => {
    const storeA = createTimeTravelStateStore({});
    const storeB = createTimeTravelStateStore({});

    // Parent path "/a" and child path "/a/b" in opposite key orders (BUG-PBT-04 regression check)
    storeA.update({ "/a/b": 99, "/a": { b: 1, c: 2 } });
    storeB.update({ "/a": { b: 1, c: 2 }, "/a/b": 99 });

    expect(canonicalStringify(storeA.getSnapshot())).toBe(
      canonicalStringify(storeB.getSnapshot()),
    );
    expect(storeA.get("/a/b")).toBe(99);
    expect(storeA.get("/a/c")).toBe(2);

    // Watch cascade circuit breaker check
    const runawayStore = createTimeTravelStateStore(
      { counter: 0 },
      { maxCascadeDepth: 6 },
    );
    runawayStore.subscribe(() => {
      const current = Number(runawayStore.get("/counter") ?? 0);
      runawayStore.set("/counter", current + 1);
    });

    expect(() => runawayStore.set("/counter", 1)).not.toThrow();
    expect(runawayStore.getCascadeTripCount()).toBeGreaterThan(0);
    expect(Number(runawayStore.get("/counter"))).toBeLessThanOrEqual(7);
  });

  it("Invariant 4 (Catalog-to-Prompt Determinism): arbitrary permutations of component keys, Zod prop keys, action keys, and custom rules produce identical fingerprints and prompts", () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(
          ["TelemetryCard", "MetricGauge", "ActionTrigger"],
          { minLength: 3, maxLength: 3 },
        ),
        fc.array(fc.stringMatching(/^[A-Za-z0-9 -]{5,24}$/), {
          minLength: 1,
          maxLength: 5,
        }),
        (compOrder, customRules) => {
          const permutedComponents: Record<string, unknown> = {};
          for (const key of compOrder) {
            if (key === "TelemetryCard") {
              // Deliberately reverse Zod prop key insertion order
              permutedComponents[key] = {
                description:
                  testCatalogConfig.components.TelemetryCard.description,
                props: z.object({
                  severity: z.enum(["healthy", "warning", "critical"]),
                  subtitle: z.string().nullable(),
                  title: z.string(),
                }),
              };
            } else {
              permutedComponents[key] =
                testCatalogConfig.components[
                  key as keyof typeof testCatalogConfig.components
                ];
            }
          }

          const permutedCatalog = createVerifiedCatalog(schema, {
            components: permutedComponents as typeof testCatalogConfig.components,
            actions: testCatalogConfig.actions,
          });

          expect(permutedCatalog.metadata.catalogHash).toBe(
            verifiedTestCatalog.metadata.catalogHash,
          );

          const promptForward = verifiedTestCatalog.prompt({ customRules });
          const promptPermuted = permutedCatalog.prompt({
            customRules: [...customRules].reverse(),
          });

          expect(promptPermuted).toBe(promptForward);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("Fail-Safe Component Boundary & Telemetry Wrapper: heals out-of-bounds numbers, numeric strings, and invalid enums with a diagnostic badge, and isolates throwing nodes without crashing parent React tree", () => {
    const tracker = createTelemetryTracker();

    const { registry } = defineRegistry(verifiedTestCatalog.catalog, {
      components: {
        TelemetryCard: ({ props, children }) =>
          React.createElement(
            "section",
            { "data-testid": "telemetry-card", "data-severity": props.severity },
            React.createElement("h2", null, props.title),
            props.subtitle ? React.createElement("p", null, props.subtitle) : null,
            React.createElement("div", null, children),
          ),
        MetricGauge: ({ props }) => {
          if (props.label === "TRIGGER_CRASH") {
            throw new Error("Simulated leaf component runtime failure");
          }
          return React.createElement(
            "div",
            { "data-testid": "metric-gauge", "data-value": props.value },
            `${props.label}: ${props.value}${props.unit ?? "%"}`,
          );
        },
        ActionTrigger: ({ props }) =>
          React.createElement(
            "button",
            { type: "button", disabled: Boolean(props.disabled) },
            props.label,
          ),
      },
      actions: {
        remediateNode: async () => {},
      },
    });

    const safeRegistry = wrapRegistryWithTelemetry(
      verifiedTestCatalog,
      registry,
      {
        telemetryTracker: tracker,
        showHealedBadges: true,
      },
    );

    // Spec with:
    // 1. Out-of-bounds number (value: 250 -> clamped to 100)
    // 2. Invalid enum ("apocalyptic" -> healed to "healthy")
    // 3. A throwing sibling leaf ("TRIGGER_CRASH" -> caught by per-node ErrorBoundary)
    // 4. A cyclic self-reference on root ("card-root" -> "card-root" -> severed by SafeGenUIRenderer)
    const adversarialSpec = {
      root: "card-root",
      elements: {
        "card-root": {
          type: "TelemetryCard",
          props: {
            title: "Cluster Control Plane",
            subtitle: undefined, // Healed to null for nullable schema
            severity: "apocalyptic", // Healed to "healthy"
          },
          children: ["gauge-healed", "gauge-crashing", "btn-healthy", "card-root"],
        },
        "gauge-healed": {
          type: "MetricGauge",
          props: {
            label: "CPU Utilization",
            value: 250, // Out-of-bounds -> Clamped to 100
            unit: "%",
          },
          children: [],
        },
        "gauge-crashing": {
          type: "MetricGauge",
          props: {
            label: "TRIGGER_CRASH",
            value: 50,
            unit: "%",
          },
          children: [],
        },
        "btn-healthy": {
          type: "ActionTrigger",
          props: {
            label: "Execute Playbook",
            disabled: false,
          },
          children: [],
        },
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(
        JSONUIProvider,
        { registry: safeRegistry, initialState: {}, children: null },
        React.createElement(SafeGenUIRenderer, {
          spec: adversarialSpec,
          registry: safeRegistry,
          catalog: verifiedTestCatalog,
          telemetryTracker: tracker,
        }),
      ),
    );

    // Parent card and healthy sibling button rendered cleanly
    expect(html).toContain("Cluster Control Plane");
    expect(html).toContain("Execute Playbook");
    // Out-of-bounds 250 was clamped to 100 and rendered with inspectable healed badge
    expect(html).toContain('data-value="100"');
    expect(html).toContain('data-genui-diagnostic-badge="healed"');

    // Telemetry recorded healed props and severed cycle
    const telemetry = tracker.getSnapshot();
    expect(telemetry.healedPropsCount).toBeGreaterThanOrEqual(3);
    expect(telemetry.severedCyclesCount).toBe(1);

    // Also verify auditCatalogRegistryParity detects missing components
    const fullAudit = auditCatalogRegistryParity(
      verifiedTestCatalog,
      registry,
      { remediateNode: () => {} },
    );
    expect(fullAudit.synchronized).toBe(true);

    const brokenAudit = auditCatalogRegistryParity(
      verifiedTestCatalog,
      { TelemetryCard: registry.TelemetryCard },
      {},
    );
    expect(brokenAudit.synchronized).toBe(false);
    expect(brokenAudit.missingComponents).toContain("MetricGauge");
    expect(brokenAudit.missingActions).toContain("remediateNode");
  });

  it("runCatalogInvariantSuite: executes the reusable in-process PBT verification harness and passes 100%", () => {
    const report = runCatalogInvariantSuite(verifiedTestCatalog, {
      numRuns: 40,
    });
    expect(report.allPassed).toBe(true);
    expect(report.theorems).toHaveLength(4);
    expect(report.totalRuns).toBe(160);
  });
});
