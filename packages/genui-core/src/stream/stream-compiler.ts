import {
  applySpecStreamPatch,
  diffToPatches,
  parseSpecStreamLine,
  type Spec,
  type SpecStreamLine,
} from "@json-render/core";
import {
  deepCloneAndSanitizeValue,
  isSafeJsonPointer,
  sanitizeSpecGraph,
  type DeepSanitizeCounters,
} from "./dag-sanitizer.js";
import {
  createTelemetryTracker,
  type TelemetryTracker,
} from "../telemetry/telemetry-tracker.js";
import type {
  GraphIssue,
  GuardrailedStreamStepResult,
  HealedDiagnosticsByElement,
  PropDiagnostic,
  SanitizeGraphOptions,
  StreamTelemetrySnapshot,
  VerifiedCatalog,
} from "../types.js";

const VALID_PATCH_OPS = new Set([
  "add",
  "remove",
  "replace",
  "move",
  "copy",
  "test",
]);

export interface GuardrailedStreamCompilerOptions {
  /** Optional VerifiedCatalog to enforce component & Zod prop validation/healing */
  readonly catalog?: VerifiedCatalog<any, any>;
  /** Optional initial spec state */
  readonly initialSpec?: Spec;
  /** Maximum allowed tree depth (default: 16) */
  readonly maxDepth?: number;
  /** Maximum allowed elements (default: 500) */
  readonly maxElements?: number;
  /** Optional external telemetry tracker to share across components */
  readonly telemetryTracker?: TelemetryTracker;
}

export interface GuardrailedStreamCompiler {
  /** Push an arbitrary string chunk (1 byte, partial line, or multiple lines) */
  push(chunk: string): GuardrailedStreamStepResult;
  /** Flush any un-newlined trailing buffer, apply final lossy DAG cleanup, and mark complete */
  finalize(): GuardrailedStreamStepResult;
  /** Get the current sanitized, render-safe Spec */
  getSpec(): Spec;
  /** Get all valid RFC 6902 patches applied so far */
  getAppliedPatches(): readonly SpecStreamLine[];
  /** Get all rejected/malformed lines encountered so far */
  getRejectedLines(): readonly string[];
  /** Get per-element healing provenance for the current Spec */
  getHealedDiagnostics(): HealedDiagnosticsByElement;
  /** Get the live telemetry snapshot */
  getTelemetry(): StreamTelemetrySnapshot;
  /** Subscribe to telemetry changes */
  subscribeTelemetry(listener: () => void): () => void;
  /** Reset the stream compiler to initial empty state */
  reset(nextInitialSpec?: Spec): void;
}

/**
 * Serializes any Spec into a canonical RFC 6902 JSONL patch stream.
 * Useful for round-trip testing, persistence, and stream replay.
 */
export function specToJsonlStream(spec: Spec): string {
  const lines: string[] = [];
  lines.push(
    JSON.stringify({
      op: "add",
      path: "/root",
      value: spec.root,
    } satisfies SpecStreamLine),
  );
  lines.push(
    JSON.stringify({
      op: "add",
      path: "/elements",
      value: {},
    } satisfies SpecStreamLine),
  );

  const sortedElementKeys = Object.keys(spec.elements).sort((a, b) =>
    a.localeCompare(b),
  );
  for (const key of sortedElementKeys) {
    const escapedKey = key.replace(/~/g, "~0").replace(/\//g, "~1");
    lines.push(
      JSON.stringify({
        op: "add",
        path: `/elements/${escapedKey}`,
        value: spec.elements[key],
      } satisfies SpecStreamLine),
    );
  }

  if (spec.state !== undefined) {
    lines.push(
      JSON.stringify({
        op: "add",
        path: "/state",
        value: spec.state,
      } satisfies SpecStreamLine),
    );
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Validates whether an RFC 6902 patch line is structurally safe to apply
 * to the raw state object without prototype pollution or primitive traversal crashes.
 */
function validatePatchSafety(
  rawPatch: unknown,
  targetObj: Record<string, unknown>,
): { ok: true; patch: SpecStreamLine } | { ok: false; reason: string } {
  if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) {
    return { ok: false, reason: "Patch is not a JSON object." };
  }

  const candidate = rawPatch as Record<string, unknown>;
  const op = candidate.op;
  const path = candidate.path;

  if (typeof op !== "string" || !VALID_PATCH_OPS.has(op)) {
    return {
      ok: false,
      reason: `Invalid RFC 6902 patch op "${String(op)}".`,
    };
  }

  if (typeof path !== "string" || !isSafeJsonPointer(path) || path === "") {
    return {
      ok: false,
      reason: `Unsafe or root-overwriting RFC 6902 path "${String(path)}".`,
    };
  }

  if (op === "move" || op === "copy") {
    if (
      typeof candidate.from !== "string" ||
      !isSafeJsonPointer(candidate.from) ||
      candidate.from === ""
    ) {
      return {
        ok: false,
        reason: `Unsafe or missing RFC 6902 "from" pointer "${String(candidate.from)}".`,
      };
    }
  }

  if ((op === "add" || op === "replace" || op === "test") && !("value" in candidate)) {
    return {
      ok: false,
      reason: `Patch op "${op}" requires a "value" field.`,
    };
  }

  // Verify parent traversal won't attempt to index into a primitive (string/number/boolean/null)
  const segments = path
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));

  let cursor: unknown = targetObj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (cursor === null || cursor === undefined) {
      // applySpecStreamPatch auto-creates missing intermediate objects/arrays on add/replace,
      // unless op is remove/test/move/copy
      if (op === "remove" || op === "test") {
        return {
          ok: false,
          reason: `Cannot perform "${op}" on non-existent ancestor at "/${segments.slice(0, i + 1).join("/")}".`,
        };
      }
      break;
    }
    if (typeof cursor !== "object") {
      return {
        ok: false,
        reason: `Cannot traverse through primitive value (${typeof cursor}) at "/${segments.slice(0, i).join("/")}".`,
      };
    }
    if (Array.isArray(cursor)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) {
        return {
          ok: false,
          reason: `Out-of-bounds array index "${seg}" during traversal.`,
        };
      }
      cursor = cursor[idx];
    } else {
      cursor = (cursor as Record<string, unknown>)[seg];
    }
  }

  // Also check if leaf target is an array with an unreasonable index (prevent sparse array OOM)
  const leafSeg = segments[segments.length - 1]!;
  if (Array.isArray(cursor) && leafSeg !== "-") {
    const idx = Number(leafSeg);
    if (!Number.isInteger(idx) || idx < 0 || idx > cursor.length + 1000) {
      return {
        ok: false,
        reason: `Invalid or excessive array index "${leafSeg}".`,
      };
    }
  }

  return {
    ok: true,
    patch: candidate as unknown as SpecStreamLine,
  };
}

/**
 * Creates a guardrailed RFC 6902 JSONL stream compiler that guarantees:
 * 1. Stream Chunking Invariance (Theorem 1): Any arbitrary chunk boundary partition produces
 *    the exact same finalized Spec.
 * 2. Adversarial Payload Resilience (Theorem 2): Never crashes on prototype pollution, NaN/Infinity,
 *    cycles, primitive path traversal, or truncated JSON lines.
 */
export function createGuardrailedStreamCompiler(
  options: GuardrailedStreamCompilerOptions = {},
): GuardrailedStreamCompiler {
  const maxDepth = options.maxDepth ?? 16;
  const maxElements = options.maxElements ?? 500;
  const catalog = options.catalog;
  const tracker = options.telemetryTracker ?? createTelemetryTracker();

  let lineBuffer = "";
  let rawPatchState: Record<string, unknown> = createInitialRawState(
    options.initialSpec,
  );
  let currentSanitizedSpec: Spec = sanitizeAndHealCurrentState(false).spec;
  let currentHealedDiagnostics: HealedDiagnosticsByElement = {};
  const appliedPatches: SpecStreamLine[] = [];
  const rejectedLines: string[] = [];

  /**
   * Groups healed diagnostics by element key. Because sanitizeAndHealCurrentState re-evaluates
   * the full raw patch state, the result always reflects the *current* Spec (stale entries for
   * removed or later-corrected elements disappear automatically).
   */
  function groupHealedByElement(
    diagnostics: readonly PropDiagnostic[],
  ): HealedDiagnosticsByElement {
    const grouped: Record<string, PropDiagnostic[]> = Object.create(null);
    for (const d of diagnostics) {
      if (d.status !== "healed") continue;
      (grouped[d.elementKey] ??= []).push(d);
    }
    return grouped;
  }

  function createInitialRawState(initial?: Spec): Record<string, unknown> {
    if (!initial) {
      return { root: "", elements: {} };
    }
    const counters: DeepSanitizeCounters = {
      healedNumbersCount: 0,
      blockedUrisCount: 0,
      blockedPathsCount: 0,
      issues: [],
    };
    return deepCloneAndSanitizeValue(
      initial,
      counters,
      "",
    ) as Record<string, unknown>;
  }

  function sanitizeAndHealCurrentState(isFinal: boolean): {
    spec: Spec;
    issues: GraphIssue[];
    diagnostics: PropDiagnostic[];
    evaluatedProps: number;
    healedProps: number;
    rejectedProps: number;
    severedCycles: number;
  } {
    const graphOpts: SanitizeGraphOptions = {
      maxDepth,
      maxElements,
      pruneMissingChildren: isFinal,
      ...(catalog ? { allowedComponents: catalog.metadata.componentNames } : {}),
    };

    const sanitized = sanitizeSpecGraph(rawPatchState, graphOpts);
    const diagnostics: PropDiagnostic[] = [];
    const extraIssues: GraphIssue[] = [];
    let evaluatedProps = 0;
    let healedProps = sanitized.healedNumbersCount + sanitized.blockedUrisCount;
    let rejectedProps = sanitized.blockedPathsCount;

    if (catalog) {
      for (const [elKey, el] of Object.entries(sanitized.spec.elements)) {
        const rawProps = (el.props ?? {}) as Record<string, unknown>;
        evaluatedProps += Math.max(1, Object.keys(rawProps).length);
        const propCheck = catalog.validateAndHealProps(elKey, el.type, rawProps);
        el.props = propCheck.props;
        diagnostics.push(...propCheck.diagnostics);
        healedProps += propCheck.healedCount;
        rejectedProps += propCheck.rejectedCount;

        if (!propCheck.ok) {
          for (const d of propCheck.diagnostics) {
            if (d.status === "rejected") {
              extraIssues.push({
                severity: "error",
                code: "unknown_component",
                message: `Element "${elKey}" (${el.type}.${d.propName}): ${d.reason}`,
                elementKey: elKey,
              });
            }
          }
        }
      }
    }

    return {
      spec: sanitized.spec,
      issues: [...sanitized.inspection.issues, ...extraIssues],
      diagnostics,
      evaluatedProps,
      healedProps,
      rejectedProps,
      severedCycles: sanitized.severedCyclesCount,
    };
  }

  function processSingleLine(
    rawLine: string,
    stepApplied: SpecStreamLine[],
    stepRejected: string[],
    stepIssues: GraphIssue[],
  ): { healedDelta: number; rejectedDelta: number } {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return { healedDelta: 0, rejectedDelta: 0 };
    }

    // Ignore markdown code fence lines (e.g. ```spec, ```jsonl, ```json, ```) or comments
    if (trimmed.startsWith("```") || trimmed.startsWith("//")) {
      return { healedDelta: 0, rejectedDelta: 0 };
    }

    // Parse JSON line safely
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      // Fallback to @json-render/core's parseSpecStreamLine if applicable
      const fallback = parseSpecStreamLine(trimmed);
      if (!fallback) {
        rejectedLines.push(trimmed);
        stepRejected.push(trimmed);
        stepIssues.push({
          severity: "warning",
          code: "malformed_patch_line",
          message: `Rejected malformed JSONL line: ${trimmed.slice(0, 80)}`,
        });
        return { healedDelta: 0, rejectedDelta: 1 };
      }
      parsedJson = fallback;
    }

    const safety = validatePatchSafety(parsedJson, rawPatchState);
    if (!safety.ok) {
      rejectedLines.push(trimmed);
      stepRejected.push(trimmed);
      stepIssues.push({
        severity: "error",
        code: "blocked_unsafe_path",
        message: safety.reason,
        path:
          typeof (parsedJson as Record<string, unknown>)?.path === "string"
            ? ((parsedJson as Record<string, unknown>).path as string)
            : undefined,
      });
      return { healedDelta: 0, rejectedDelta: 1 };
    }

    // Sanitize patch value before applying so prototype pollution / NaN / unsafe URIs never enter rawPatchState
    const counters: DeepSanitizeCounters = {
      healedNumbersCount: 0,
      blockedUrisCount: 0,
      blockedPathsCount: 0,
      issues: [],
    };
    const sanitizedPatch: SpecStreamLine = {
      ...safety.patch,
      ...(safety.patch.value !== undefined
        ? {
            value: deepCloneAndSanitizeValue(
              safety.patch.value,
              counters,
              safety.patch.path,
            ),
          }
        : {}),
    };

    stepIssues.push(...counters.issues);

    // Apply patch on a clone or with rollback safety so a failed 'test' or deep path error never corrupts rawPatchState
    const backup = structuredClone(rawPatchState);
    try {
      applySpecStreamPatch(rawPatchState, sanitizedPatch);
      appliedPatches.push(sanitizedPatch);
      stepApplied.push(sanitizedPatch);
      return {
        healedDelta: counters.healedNumbersCount + counters.blockedUrisCount,
        rejectedDelta: counters.blockedPathsCount,
      };
    } catch (err) {
      rawPatchState = backup;
      rejectedLines.push(trimmed);
      stepRejected.push(trimmed);
      stepIssues.push({
        severity: "error",
        code: "malformed_patch_line",
        message:
          err instanceof Error
            ? `Patch execution rejected: ${err.message}`
            : "Patch execution failed.",
        path: sanitizedPatch.path,
      });
      return {
        healedDelta: counters.healedNumbersCount,
        rejectedDelta: counters.blockedPathsCount + 1,
      };
    }
  }

  return {
    push(chunk: string): GuardrailedStreamStepResult {
      const startTime = performance.now();
      const safeChunk = typeof chunk === "string" ? chunk : String(chunk ?? "");

      if (tracker.getSnapshot().status === "idle") {
        tracker.startStream();
      }

      lineBuffer += safeChunk;

      const stepApplied: SpecStreamLine[] = [];
      const stepRejected: string[] = [];
      const stepIssues: GraphIssue[] = [];
      let patchHealedDelta = 0;
      let patchRejectedDelta = 0;

      let newlineIdx = lineBuffer.indexOf("\n");
      while (newlineIdx !== -1) {
        const line = lineBuffer.slice(0, newlineIdx).replace(/\r$/, "");
        lineBuffer = lineBuffer.slice(newlineIdx + 1);
        const deltas = processSingleLine(
          line,
          stepApplied,
          stepRejected,
          stepIssues,
        );
        patchHealedDelta += deltas.healedDelta;
        patchRejectedDelta += deltas.rejectedDelta;
        newlineIdx = lineBuffer.indexOf("\n");
      }

      let sanitizeResult = {
        spec: currentSanitizedSpec,
        issues: [] as GraphIssue[],
        diagnostics: [] as PropDiagnostic[],
        evaluatedProps: 0,
        healedProps: 0,
        rejectedProps: 0,
        severedCycles: 0,
      };

      if (stepApplied.length > 0) {
        sanitizeResult = sanitizeAndHealCurrentState(false);
        currentSanitizedSpec = sanitizeResult.spec;
        currentHealedDiagnostics = groupHealedByElement(
          sanitizeResult.diagnostics,
        );
      }

      const latencyMs = performance.now() - startTime;
      const allStepIssues = [...stepIssues, ...sanitizeResult.issues];

      tracker.recordChunkPass({
        charsCount: safeChunk.length,
        appliedPatchesCount: stepApplied.length,
        rejectedPatchesCount: stepRejected.length,
        validationLatencyMs: latencyMs,
        evaluatedPropsDelta: sanitizeResult.evaluatedProps,
        healedPropsDelta: patchHealedDelta + sanitizeResult.healedProps,
        rejectedPropsDelta: patchRejectedDelta + sanitizeResult.rejectedProps,
        severedCyclesDelta: sanitizeResult.severedCycles,
        diagnostics: sanitizeResult.diagnostics,
        issues: allStepIssues,
      });

      return {
        spec: currentSanitizedSpec,
        appliedPatches: stepApplied,
        rejectedLines: stepRejected,
        issues: allStepIssues,
        telemetry: tracker.getSnapshot(),
        healedDiagnostics: currentHealedDiagnostics,
      };
    },

    finalize(): GuardrailedStreamStepResult {
      const startTime = performance.now();
      const stepApplied: SpecStreamLine[] = [];
      const stepRejected: string[] = [];
      const stepIssues: GraphIssue[] = [];
      let patchHealedDelta = 0;
      let patchRejectedDelta = 0;

      // Flush any trailing line that did not end with \n (Fixes BUG-PBT-01)
      if (lineBuffer.length > 0) {
        const remainingLines = lineBuffer.split("\n");
        lineBuffer = "";
        for (const rawLine of remainingLines) {
          const deltas = processSingleLine(
            rawLine.replace(/\r$/, ""),
            stepApplied,
            stepRejected,
            stepIssues,
          );
          patchHealedDelta += deltas.healedDelta;
          patchRejectedDelta += deltas.rejectedDelta;
        }
      }

      // Run final lossy sanitization (pruning any unresolved dangling child keys)
      const sanitizeResult = sanitizeAndHealCurrentState(true);
      currentSanitizedSpec = sanitizeResult.spec;
      currentHealedDiagnostics = groupHealedByElement(sanitizeResult.diagnostics);

      const latencyMs = performance.now() - startTime;
      const allStepIssues = [...stepIssues, ...sanitizeResult.issues];

      tracker.recordChunkPass({
        charsCount: 0,
        appliedPatchesCount: stepApplied.length,
        rejectedPatchesCount: stepRejected.length,
        validationLatencyMs: latencyMs,
        evaluatedPropsDelta: sanitizeResult.evaluatedProps,
        healedPropsDelta: patchHealedDelta + sanitizeResult.healedProps,
        rejectedPropsDelta: patchRejectedDelta + sanitizeResult.rejectedProps,
        severedCyclesDelta: sanitizeResult.severedCycles,
        diagnostics: sanitizeResult.diagnostics,
        issues: allStepIssues,
      });
      tracker.completeStream();

      return {
        spec: currentSanitizedSpec,
        appliedPatches: stepApplied,
        rejectedLines: stepRejected,
        issues: allStepIssues,
        telemetry: tracker.getSnapshot(),
        healedDiagnostics: currentHealedDiagnostics,
      };
    },

    getSpec(): Spec {
      return currentSanitizedSpec;
    },

    getAppliedPatches(): readonly SpecStreamLine[] {
      return appliedPatches;
    },

    getRejectedLines(): readonly string[] {
      return rejectedLines;
    },

    getHealedDiagnostics(): HealedDiagnosticsByElement {
      return currentHealedDiagnostics;
    },

    getTelemetry(): StreamTelemetrySnapshot {
      return tracker.getSnapshot();
    },

    subscribeTelemetry(listener: () => void): () => void {
      return tracker.subscribe(listener);
    },

    reset(nextInitialSpec?: Spec): void {
      lineBuffer = "";
      appliedPatches.length = 0;
      rejectedLines.length = 0;
      rawPatchState = createInitialRawState(nextInitialSpec);
      tracker.reset();
      currentSanitizedSpec = sanitizeAndHealCurrentState(false).spec;
      currentHealedDiagnostics = {};
    },
  };
}

export { diffToPatches };
