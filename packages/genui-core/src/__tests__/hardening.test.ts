import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { schema } from "@json-render/react/schema";
import { z } from "zod";
import {
  computeDeterministicHash,
  createGuardrailedStreamCompiler,
  createTimeTravelStateStore,
  createVerifiedCatalog,
  deepCloneAndSanitizeValue,
  inspectSpecGraph,
} from "../index.js";
import type { DeepSanitizeCounters } from "../stream/dag-sanitizer.js";

function sha256Node(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

describe("@genui-studio/core hardening guarantees", () => {
  describe("cryptographic SHA-256 & semantic enum healing", () => {
    it("computes genuine FIPS 180-4 SHA-256 matching node:crypto over UTF-8", () => {
      const vectors = [
        "",
        "abc",
        "genui-studio-deterministic-hash",
        "unicode-🚀-metric-αβγ-日本語",
        JSON.stringify({ a: [1, 2, 3], nested: { ok: true } }),
      ];

      for (const sample of vectors) {
        const actual = computeDeterministicHash(sample);
        expect(actual).toMatch(/^[0-9a-f]{64}$/);
        expect(actual).toBe(sha256Node(sample));
      }
    });

    it("produces identical SHA-256 catalog hashes regardless of component/prop/action key insertion order", () => {
      const catA = createVerifiedCatalog(schema, {
        components: {
          AlertBanner: {
            description: "Alert",
            props: z.object({
              severity: z.enum(["CRITICAL_OUTAGE", "DEGRADED", "NOMINAL"]),
              title: z.string(),
            }),
          },
          MetricCard: {
            description: "KPI card",
            props: z.object({ label: z.string(), value: z.number().min(0).max(100) }),
          },
        },
        actions: {
          acknowledge: { description: "Ack" },
          escalate: { description: "Escalate" },
        },
      });

      const catB = createVerifiedCatalog(schema, {
        components: {
          MetricCard: {
            description: "KPI card",
            props: z.object({ value: z.number().min(0).max(100), label: z.string() }),
          },
          AlertBanner: {
            description: "Alert",
            props: z.object({
              title: z.string(),
              severity: z.enum(["CRITICAL_OUTAGE", "DEGRADED", "NOMINAL"]),
            }),
          },
        },
        actions: {
          escalate: { description: "Escalate" },
          acknowledge: { description: "Ack" },
        },
      });

      expect(catA.metadata.catalogHash).toBe(catB.metadata.catalogHash);
      expect(catA.metadata.catalogHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("heals case-mismatched and separator-drifted enum values semantically before defaulting", () => {
      const cat = createVerifiedCatalog(schema, {
        components: {
          StatusBadge: {
            description: "Service status badge",
            props: z.object({
              status: z.enum(["CRITICAL_OUTAGE", "DEGRADED_LATENCY", "NOMINAL"]),
              tier: z.enum(["TIER_1", "TIER_2", "FREE"]),
            }),
          },
        },
        actions: {},
      });

      const semanticRes = cat.validateAndHealProps("el-1", "StatusBadge", {
        status: "critical-outage",
        tier: " tier 2 ",
      });
      expect(semanticRes.ok).toBe(true);
      expect(semanticRes.props.status).toBe("CRITICAL_OUTAGE");
      expect(semanticRes.props.tier).toBe("TIER_2");
      expect(semanticRes.healedCount).toBe(2);

      const fallbackRes = cat.validateAndHealProps("el-2", "StatusBadge", {
        status: "completely_unknown_status",
        tier: "NOMINAL_TYPO",
      });
      expect(fallbackRes.ok).toBe(true);
      expect(fallbackRes.props.status).toBe("CRITICAL_OUTAGE");
      expect(fallbackRes.props.tier).toBe("TIER_1");
    });
  });

  describe("TimeTravelStateStore runtime immutability & snapshot stability", () => {
    it("deep-freezes snapshots, get() results, and getHistory() while preserving Object.is identity", () => {
      const store = createTimeTravelStateStore({
        metrics: { cpu: 42, tags: ["prod", "us-east"] },
        unchanged: { region: "eu-west" },
      });

      const snap1 = store.getSnapshot();
      expect(store.getSnapshot()).toBe(snap1);
      expect(store.getServerSnapshot?.()).toBe(snap1);
      expect(Object.isFrozen(snap1)).toBe(true);
      expect(Object.isFrozen(snap1.metrics)).toBe(true);

      // Strict mode external mutation must throw TypeError and leave store untouched
      expect(() => {
        (snap1 as Record<string, unknown>).tampered = true;
      }).toThrow(TypeError);
      expect(() => {
        ((store.get("/metrics") as { tags: string[] }).tags).push("evil");
      }).toThrow(TypeError);
      expect(() => {
        (store.getHistory() as unknown[]).push({ fake: true });
      }).toThrow(TypeError);
      expect(() => {
        (store.getHistory()[0]!.changedPaths as string[]).push("/evil");
      }).toThrow(TypeError);
      expect(() => {
        (store.getHistory()[0]!.snapshot as Record<string, unknown>).hacked = 1;
      }).toThrow(TypeError);

      // Mutating deep path inside an already-frozen parent object succeeds via structural sharing
      store.set("/metrics/cpu", 88);
      const snap2 = store.getSnapshot();
      expect(snap2).not.toBe(snap1);
      expect(snap2.metrics).toEqual({ cpu: 88, tags: ["prod", "us-east"] });
      expect(snap2.unchanged).toBe(snap1.unchanged);
      expect(Object.isFrozen(snap2)).toBe(true);
      expect(() => {
        (snap2.metrics as Record<string, unknown>).cpu = 0;
      }).toThrow(TypeError);

      // Undo/redo & reset remain frozen
      expect(store.undo()).toBe(true);
      expect(store.getSnapshot()).toBe(snap1);
      expect(store.redo()).toBe(true);
      expect(store.getSnapshot()).toBe(snap2);

      store.reset({ fresh: { count: 1 } });
      expect(Object.isFrozen(store.getSnapshot())).toBe(true);
      expect(Object.isFrozen(store.getSnapshot().fresh)).toBe(true);
    });
  });

  describe("DAG sanitizer & stream compiler recursion/buffer/byte caps", () => {
    it("bounds deeply nested JS values in deepCloneAndSanitizeValue without stack overflow", () => {
      let deep: Record<string, unknown> = { leaf: "ok" };
      for (let i = 0; i < 200; i += 1) {
        deep = { child: deep };
      }

      const counters: DeepSanitizeCounters = {
        healedNumbersCount: 0,
        blockedUrisCount: 0,
        blockedPathsCount: 0,
        issues: [],
      };
      const sanitized = deepCloneAndSanitizeValue(deep, counters, "/props");
      expect(sanitized).toBeTruthy();
      expect(counters.issues.some((i) => i.code === "value_depth_exceeded")).toBe(
        true,
      );
    });

    it("enforces maxNodes budget on oversized value payloads", () => {
      const wideArray = Array.from({ length: 1_500 }, (_, idx) => ({ id: idx }));
      const counters: DeepSanitizeCounters = {
        healedNumbersCount: 0,
        blockedUrisCount: 0,
        blockedPathsCount: 0,
        issues: [],
      };
      deepCloneAndSanitizeValue(wideArray, counters, "/props/rows", "tbl", undefined, 0, {
        maxNodes: 200,
      });
      expect(counters.issues.some((i) => i.code === "value_budget_exceeded")).toBe(
        true,
      );
    });

    it("bounds inspectSpecGraph DFS recursion on 5,000-deep chains", () => {
      const elements: Record<string, { type: string; props: Record<string, unknown>; children: string[] }> = {};
      for (let i = 0; i < 5_000; i += 1) {
        elements[`n-${i}`] = {
          type: "Box",
          props: {},
          children: i + 1 < 5_000 ? [`n-${i + 1}`] : [],
        };
      }

      const inspection = inspectSpecGraph(
        { root: "n-0", elements },
        { maxDepth: 16 },
      );
      expect(inspection.issues.some((i) => i.code === "depth_limit_exceeded")).toBe(
        true,
      );
      expect(inspection.maxObservedDepth).toBeLessThanOrEqual(17);
    });

    it("enforces maxBufferBytes / maxLineLength across chunks and recovers at next newline", () => {
      const compiler = createGuardrailedStreamCompiler({
        maxBufferBytes: 1024,
        maxLineLength: 1024,
      });

      const oversizedFirstHalf = `{"op":"add","path":"/elements/big","value":"${"x".repeat(600)}`;
      const oversizedMiddle = "z".repeat(600);
      const oversizedTail = `${"y".repeat(200)}"}\n`;
      const validRoot = `{"op":"add","path":"/root","value":"card"}\n`;
      const validCard = `{"op":"add","path":"/elements/card","value":{"type":"Box","props":{"ok":true},"children":[]}}\n`;

      const step1 = compiler.push(oversizedFirstHalf);
      expect(step1.issues).toHaveLength(0);

      // Buffer exceeds maxBufferBytes mid-line before \n arrives
      const step2 = compiler.push(oversizedMiddle);
      expect(step2.issues.some((i) => i.code === "line_limit_exceeded")).toBe(
        true,
      );

      // Next \n resets oversized drop mode and parses following valid patches
      const step3 = compiler.push(oversizedTail + validRoot + validCard);
      expect(step3.appliedPatches).toHaveLength(2);
      const final = compiler.finalize();
      expect(final.spec.root).toBe("card");
      expect(final.spec.elements.card?.props.ok).toBe(true);
      expect(compiler.getRejectedLines()[0]!.length).toBeLessThanOrEqual(600);
    });

    it("enforces maxTotalStreamBytes and maxPatches", () => {
      const compiler = createGuardrailedStreamCompiler({
        maxTotalStreamBytes: 1024,
        maxPatches: 2,
      });

      compiler.push(`{"op":"add","path":"/root","value":"r"}\n`);
      const second = compiler.push(`{"op":"add","path":"/elements/r","value":{"type":"Box","props":{},"children":[]}}\n`);
      expect(second.appliedPatches).toHaveLength(1);

      const third = compiler.push(`{"op":"add","path":"/elements/r2","value":{"type":"Box","props":{},"children":[]}}\n`);
      expect(third.issues.some((i) => i.code === "stream_limit_exceeded")).toBe(
        true,
      );
      expect(compiler.getAppliedPatches()).toHaveLength(2);

      const huge = compiler.push("z".repeat(2_048));
      expect(huge.issues.some((i) => i.code === "stream_limit_exceeded")).toBe(
        true,
      );
      const finalized = compiler.finalize();
      expect(finalized.spec.root).toBe("r");
    });

    it("unwraps SSE data: streams, keepalives, and whole-Spec snapshots with full safety healing", () => {
      const cat = createVerifiedCatalog(schema, {
        components: {
          Gauge: {
            description: "Metric gauge",
            props: z.object({
              severity: z.enum(["CRITICAL_OUTAGE", "NOMINAL"]),
              value: z.number().min(0).max(100),
            }),
          },
        },
        actions: {},
      });

      const compiler = createGuardrailedStreamCompiler({ catalog: cat });
      const sseStream = [
        ": keep-alive",
        "event: spec_update",
        `data: ${JSON.stringify({
          root: "g1",
          elements: {
            g1: {
              type: "Gauge",
              props: { severity: "critical-outage", value: 999 },
              children: [],
            },
            __proto__: {
              type: "Gauge",
              props: { severity: "NOMINAL", value: 10 },
              children: [],
            },
          },
        })}`,
        "data: [DONE]",
        "",
      ].join("\r\n");

      // Drip 7 characters at a time to test chunking invariance over SSE CRLF
      for (let i = 0; i < sseStream.length; i += 7) {
        compiler.push(sseStream.slice(i, i + 7));
      }

      const result = compiler.finalize();
      expect(result.spec.root).toBe("g1");
      expect(result.spec.elements.g1?.props).toEqual({
        severity: "CRITICAL_OUTAGE",
        value: 100,
      });
      expect(
        Object.prototype.hasOwnProperty.call(result.spec.elements, "__proto__"),
      ).toBe(false);
    });
  });
});
