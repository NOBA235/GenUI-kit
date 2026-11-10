import type {
  ElementFaultRecord,
  GraphIssue,
  PropDiagnostic,
  StreamTelemetrySnapshot,
} from "../types.js";

export interface TelemetryTracker {
  /** Get the current immutable telemetry snapshot */
  getSnapshot(): StreamTelemetrySnapshot;
  /** Subscribe to telemetry updates (compatible with React useSyncExternalStore) */
  subscribe(listener: () => void): () => void;
  /** Mark stream start */
  startStream(): void;
  /** Record a processed chunk and validation pass */
  recordChunkPass(params: {
    charsCount: number;
    appliedPatchesCount: number;
    rejectedPatchesCount: number;
    validationLatencyMs: number;
    evaluatedPropsDelta: number;
    healedPropsDelta: number;
    rejectedPropsDelta: number;
    severedCyclesDelta: number;
    diagnostics?: readonly PropDiagnostic[];
    issues?: readonly GraphIssue[];
  }): void;
  /** Record prop validation/healing metrics from the renderer boundary */
  recordPropEvaluation(params: {
    evaluated: number;
    healed: number;
    rejected: number;
    diagnostics?: readonly PropDiagnostic[];
  }): void;
  /** Record an isolated element fault caught by the Error Boundary */
  recordElementFault(fault: ElementFaultRecord): void;
  /** Clear a resolved element fault by elementKey */
  clearElementFault(elementKey: string): void;
  /** Mark stream completion */
  completeStream(): void;
  /** Reset all counters to initial idle state */
  reset(): void;
}

const MAX_DIAGNOSTIC_LOG = 64;
const MAX_ISSUE_LOG = 64;
const MAX_FAULT_LOG = 32;

function createInitialSnapshot(): StreamTelemetrySnapshot {
  return {
    tokensPerSec: 0,
    totalCharsProcessed: 0,
    patchCount: 0,
    rejectedPatchCount: 0,
    lastValidationLatencyMs: 0,
    avgValidationLatencyMs: 0,
    totalValidationLatencyMs: 0,
    schemaComplianceRate: 1,
    evaluatedPropsCount: 0,
    healedPropsCount: 0,
    rejectedPropsCount: 0,
    severedCyclesCount: 0,
    activeFaults: [],
    recentDiagnostics: [],
    recentIssues: [],
    status: "idle",
  };
}

/**
 * High-precision, zero-allocation-overhead telemetry tracker for Generative UI streams.
 */
export function createTelemetryTracker(): TelemetryTracker {
  let snapshot: StreamTelemetrySnapshot = createInitialSnapshot();
  let streamStartTimeMs: number | null = null;
  let validationPassCount = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Never allow a telemetry subscriber to break the engine pipeline
      }
    }
  }

  function computeComplianceRate(
    evaluated: number,
    rejected: number,
    rejectedPatches: number,
    appliedPatches: number,
  ): number {
    const totalChecks = evaluated + appliedPatches + rejectedPatches;
    if (totalChecks <= 0) return 1;
    const totalFailures = rejected + rejectedPatches;
    const rate = Math.max(0, Math.min(1, (totalChecks - totalFailures) / totalChecks));
    return Number(rate.toFixed(4));
  }

  function computeTokensPerSec(totalChars: number): number {
    if (streamStartTimeMs === null || totalChars <= 0) return 0;
    const elapsedSec = Math.max(0.005, (performance.now() - streamStartTimeMs) / 1000);
    const estimatedTokens = totalChars / 4;
    return Number((estimatedTokens / elapsedSec).toFixed(1));
  }

  return {
    getSnapshot(): StreamTelemetrySnapshot {
      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    startStream(): void {
      streamStartTimeMs = performance.now();
      snapshot = {
        ...snapshot,
        status: "streaming",
      };
      notify();
    },

    recordChunkPass(params): void {
      if (streamStartTimeMs === null) {
        streamStartTimeMs = performance.now();
      }
      validationPassCount += 1;

      const totalCharsProcessed = snapshot.totalCharsProcessed + Math.max(0, params.charsCount);
      const patchCount = snapshot.patchCount + Math.max(0, params.appliedPatchesCount);
      const rejectedPatchCount =
        snapshot.rejectedPatchCount + Math.max(0, params.rejectedPatchesCount);
      const lastValidationLatencyMs = Number(Math.max(0, params.validationLatencyMs).toFixed(3));
      const totalValidationLatencyMs = Number(
        (snapshot.totalValidationLatencyMs + lastValidationLatencyMs).toFixed(3),
      );
      const avgValidationLatencyMs = Number(
        (totalValidationLatencyMs / validationPassCount).toFixed(3),
      );

      const evaluatedPropsCount =
        snapshot.evaluatedPropsCount + Math.max(0, params.evaluatedPropsDelta);
      const healedPropsCount =
        snapshot.healedPropsCount + Math.max(0, params.healedPropsDelta);
      const rejectedPropsCount =
        snapshot.rejectedPropsCount + Math.max(0, params.rejectedPropsDelta);
      const severedCyclesCount =
        snapshot.severedCyclesCount + Math.max(0, params.severedCyclesDelta);

      const recentDiagnostics =
        params.diagnostics && params.diagnostics.length > 0
          ? [...snapshot.recentDiagnostics, ...params.diagnostics].slice(-MAX_DIAGNOSTIC_LOG)
          : snapshot.recentDiagnostics;

      const recentIssues =
        params.issues && params.issues.length > 0
          ? [...snapshot.recentIssues, ...params.issues].slice(-MAX_ISSUE_LOG)
          : snapshot.recentIssues;

      snapshot = {
        ...snapshot,
        status: "streaming",
        tokensPerSec: computeTokensPerSec(totalCharsProcessed),
        totalCharsProcessed,
        patchCount,
        rejectedPatchCount,
        lastValidationLatencyMs,
        avgValidationLatencyMs,
        totalValidationLatencyMs,
        evaluatedPropsCount,
        healedPropsCount,
        rejectedPropsCount,
        severedCyclesCount,
        schemaComplianceRate: computeComplianceRate(
          evaluatedPropsCount,
          rejectedPropsCount,
          rejectedPatchCount,
          patchCount,
        ),
        recentDiagnostics,
        recentIssues,
      };
      notify();
    },

    recordPropEvaluation(params): void {
      const evaluatedPropsCount =
        snapshot.evaluatedPropsCount + Math.max(0, params.evaluated);
      const healedPropsCount = snapshot.healedPropsCount + Math.max(0, params.healed);
      const rejectedPropsCount =
        snapshot.rejectedPropsCount + Math.max(0, params.rejected);

      const recentDiagnostics =
        params.diagnostics && params.diagnostics.length > 0
          ? [...snapshot.recentDiagnostics, ...params.diagnostics].slice(-MAX_DIAGNOSTIC_LOG)
          : snapshot.recentDiagnostics;

      snapshot = {
        ...snapshot,
        evaluatedPropsCount,
        healedPropsCount,
        rejectedPropsCount,
        schemaComplianceRate: computeComplianceRate(
          evaluatedPropsCount,
          rejectedPropsCount,
          snapshot.rejectedPatchCount,
          snapshot.patchCount,
        ),
        recentDiagnostics,
      };
      notify();
    },

    recordElementFault(fault: ElementFaultRecord): void {
      const filtered = snapshot.activeFaults.filter(
        (existing) => existing.elementKey !== fault.elementKey,
      );
      const activeFaults = [...filtered, fault].slice(-MAX_FAULT_LOG);
      snapshot = {
        ...snapshot,
        activeFaults,
      };
      notify();
    },

    clearElementFault(elementKey: string): void {
      if (!snapshot.activeFaults.some((f) => f.elementKey === elementKey)) {
        return;
      }
      snapshot = {
        ...snapshot,
        activeFaults: snapshot.activeFaults.filter((f) => f.elementKey !== elementKey),
      };
      notify();
    },

    completeStream(): void {
      snapshot = {
        ...snapshot,
        status: "complete",
      };
      notify();
    },

    reset(): void {
      streamStartTimeMs = null;
      validationPassCount = 0;
      snapshot = createInitialSnapshot();
      notify();
    },
  };
}
