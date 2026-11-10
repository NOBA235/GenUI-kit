import React, { useEffect, useRef, useState } from "react";
import type { Spec } from "@json-render/core";
import type { StreamTelemetrySnapshot } from "@genui-studio/core";
import {
  runCatalogInvariantSuite,
  type PbtSuiteReport,
} from "@genui-studio/core/testing";
import { spatialVerifiedCatalog } from "../catalog/spatial-catalog.js";

export interface SpatialPatchLogItem {
  id: number;
  rawLine: string;
  timestamp: string;
  isChaos?: boolean;
}

export interface SpatialXRayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: StreamTelemetrySnapshot;
  patchLog: SpatialPatchLogItem[];
  currentSpec: Spec | null;
  onInjectChaosPacket: () => void;
}

export const SpatialXRayDrawer: React.FC<SpatialXRayDrawerProps> = ({
  isOpen,
  onClose,
  telemetry,
  patchLog,
  currentSpec,
  onInjectChaosPacket,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<
    "PATCH_STREAM" | "DIAGNOSTICS" | "PBT_SUITE" | "SYSTEM_PROMPT"
  >("PATCH_STREAM");
  const [pbtReport, setPbtReport] = useState<
    (PbtSuiteReport & { timestamp: string }) | null
  >(null);
  const [isRunningPbt, setIsRunningPbt] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!isInDialog) {
        dialog.close();
        onClose();
      }
    }
  };

  const handleRunInBrowserPbt = () => {
    setIsRunningPbt(true);
    requestAnimationFrame(() => {
      const report = runCatalogInvariantSuite(spatialVerifiedCatalog, {
        numRuns: 15,
      });
      setPbtReport({
        ...report,
        timestamp: new Date().toISOString().slice(11, 23),
      });
      setIsRunningPbt(false);
    });
  };

  const systemPromptPreview = spatialVerifiedCatalog.prompt({
    customRules: [
      "Emit RFC 6902 JSONL patches targeting /root and /elements/*.",
      "Root element must be AegisWarRoomShell with spatial and hud slots.",
    ],
  });

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, unknown>)}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-label="Spatial Spec & Telemetry X-Ray Drawer"
      data-testid="spatial-xray-drawer-dialog"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh w-full max-w-2xl border-l border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-2xl z-50"
    >
      <div className="flex h-full flex-col">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                Aegis 3D · Spatial Telemetry & Invariant X-Ray
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-100">
              Spatial Spec & Telemetry X-Ray Inspector
            </h3>
          </div>

          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
            data-testid="close-spatial-xray-btn"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-200 hover:bg-slate-700 transition"
          >
            ESC / Close ✕
          </button>
        </div>

        {/* Chaos Packet Injection & Live Telemetry Strip */}
        <div className="border-b border-slate-800 bg-slate-900/50 px-5 py-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-950/20 p-3">
            <div className="space-y-0.5">
              <div className="font-mono text-xs font-semibold text-rose-300">
                Spatial Adversarial LLM Verification (INV-2)
              </div>
              <p className="text-xs text-slate-300">
                Injects an out-of-bounds 3D scale prop (99.9x), cyclic dependency
                edge, and prototype pollution patch into the active stream.
              </p>
            </div>
            <button
              type="button"
              onClick={onInjectChaosPacket}
              data-testid="spatial-inject-chaos-btn"
              className="shrink-0 rounded-lg border border-rose-400/50 bg-rose-500 px-3.5 py-2 font-mono text-xs font-semibold text-slate-950 shadow hover:bg-rose-400 transition"
            >
              ⚡ Inject Cascading Outage Chaos Packet
            </button>
          </div>

          {/* 6 Live Telemetry Gauges */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-xs">
            <div className="rounded border border-slate-800 bg-slate-950 p-2">
              <span className="block text-[10px] text-slate-400">PATCHES</span>
              <span className="text-sm font-semibold text-cyan-300">
                {telemetry.patchCount}
              </span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-2">
              <span className="block text-[10px] text-slate-400">THROUGHPUT</span>
              <span className="text-sm font-semibold text-emerald-300">
                {Math.round(telemetry.tokensPerSec)} tok/s
              </span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-2">
              <span className="block text-[10px] text-slate-400">LATENCY</span>
              <span className="text-sm font-semibold text-slate-100">
                {telemetry.lastValidationLatencyMs.toFixed(2)}ms
              </span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-2">
              <span className="block text-[10px] text-slate-400">COMPLIANCE</span>
              <span className="text-sm font-semibold text-emerald-300">
                {(telemetry.schemaComplianceRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-2">
              <span className="block text-[10px] text-slate-400">HEALED PROPS</span>
              <span
                className="text-sm font-semibold text-amber-300"
                data-testid="spatial-healed-count"
              >
                {telemetry.healedPropsCount}
              </span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-2">
              <span className="block text-[10px] text-slate-400">SEVERED CYCLES</span>
              <span
                className="text-sm font-semibold text-rose-300"
                data-testid="spatial-cycles-count"
              >
                {telemetry.severedCyclesCount}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 pt-1 font-mono text-xs">
            {(
              [
                ["PATCH_STREAM", `JSONL Stream (${patchLog.length})`],
                [
                  "DIAGNOSTICS",
                  `Healed & Faults (${
                    telemetry.recentDiagnostics.length +
                    telemetry.activeFaults.length +
                    telemetry.recentIssues.length
                  })`,
                ],
                ["PBT_SUITE", "fast-check PBT Suite"],
                ["SYSTEM_PROMPT", "Catalog & Prompt SHA"],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`rounded-md px-3 py-1.5 transition ${
                  activeTab === tabKey
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">
          {activeTab === "PATCH_STREAM" && (
            <div className="space-y-2" data-testid="spatial-patch-stream-list">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Live RFC 6902 JSON Patch Frames</span>
                <span>Rejected Frames: {telemetry.rejectedPatchCount}</span>
              </div>
              {patchLog.map((item) => (
                <div
                  key={item.id}
                  className={`rounded border p-2.5 break-all ${
                    item.isChaos
                      ? "border-rose-500/50 bg-rose-950/25 text-rose-200"
                      : "border-slate-800 bg-slate-900/70 text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>
                      Frame #{item.id}{" "}
                      {item.isChaos ? "· ⚡ HOSTILE CHAOS PACKET" : ""}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>
                  <code>{item.rawLine}</code>
                </div>
              ))}
            </div>
          )}

          {activeTab === "DIAGNOSTICS" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2">
                  Auto-Healed & Clamped Props ({telemetry.recentDiagnostics.length})
                </h4>
                {telemetry.recentDiagnostics.length === 0 ? (
                  <p className="text-slate-500">
                    No prop healing events recorded yet. Click &quot;Inject
                    Cascading Outage Chaos Packet&quot; above to trigger live prop
                    healing.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {telemetry.recentDiagnostics.map((d, idx) => (
                      <div
                        key={`${d.elementKey}-${d.propName}-${idx}`}
                        className="rounded border border-amber-500/35 bg-amber-950/15 p-2.5 text-amber-200"
                      >
                        <div className="font-semibold">
                          [{d.status.toUpperCase()}] {d.componentType}#
                          {d.elementKey}.{d.propName}
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          Reason: {d.reason}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Original: {JSON.stringify(d.originalValue)} → Healed:{" "}
                          {JSON.stringify(d.resolvedValue)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-300 mb-2">
                  Quarantined Element Faults ({telemetry.activeFaults.length})
                </h4>
                {telemetry.activeFaults.length === 0 ? (
                  <p className="text-slate-500">
                    Zero node faults. All spatial components are within normal parameters.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {telemetry.activeFaults.map((f) => (
                      <div
                        key={f.id}
                        className="rounded border border-rose-500/40 bg-rose-950/20 p-2.5 text-rose-200"
                      >
                        <div className="font-semibold">
                          [{f.phase}] {f.componentType} ({f.elementKey})
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          {f.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">
                  DAG Sanitizer & Prototype-Pollution Events (
                  {telemetry.recentIssues.length})
                </h4>
                {telemetry.recentIssues.length === 0 ? (
                  <p className="text-slate-500">
                    No cyclic edges or prototype pollution paths detected.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {telemetry.recentIssues.map((iss, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-cyan-500/35 bg-cyan-950/20 p-2 text-cyan-200"
                      >
                        [{iss.code}] {iss.path ?? iss.elementKey ?? "graph"}:{" "}
                        {iss.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "PBT_SUITE" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">
                      Live In-Browser `fast-check` Property Verification
                    </h4>
                    <p className="font-sans text-xs text-slate-400">
                      Generates arbitrary 3D and 2D UI specs from{" "}
                      <code>spatialVerifiedCatalog</code> (14 components, 4 actions)
                      and proves all 4 formal invariants.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isRunningPbt}
                    onClick={handleRunInBrowserPbt}
                    data-testid="spatial-run-pbt-btn"
                    className="rounded-lg bg-cyan-500 px-3.5 py-2 font-mono text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
                  >
                    {isRunningPbt
                      ? "Running fast-check..."
                      : "▶ Run fast-check PBT Suite"}
                  </button>
                </div>

                {pbtReport && (
                  <div
                    className="space-y-2 pt-2 border-t border-slate-800"
                    data-testid="spatial-pbt-results"
                  >
                    <div
                      className={`flex items-center justify-between font-semibold ${
                        pbtReport.allPassed ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      <span>
                        {pbtReport.allPassed
                          ? `✓ ${pbtReport.theorems.length}/${pbtReport.theorems.length} INVARIANTS HOLD`
                          : `✗ ${pbtReport.theorems.filter((t) => !t.passed).length} INVARIANT(S) FALSIFIED`}{" "}
                        ({pbtReport.totalRuns} randomized runs)
                      </span>
                      <span>
                        {pbtReport.totalDurationMs.toFixed(1)}ms · {pbtReport.timestamp}
                      </span>
                    </div>
                    {pbtReport.theorems.map((thm) => (
                      <div
                        key={thm.id}
                        className={`rounded border p-2.5 ${
                          thm.passed
                            ? "border-emerald-500/30 bg-emerald-950/15"
                            : "border-rose-500/40 bg-rose-950/20"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between font-semibold ${
                            thm.passed ? "text-emerald-200" : "text-rose-200"
                          }`}
                        >
                          <span>
                            {thm.id}: {thm.name}
                          </span>
                          <span>
                            {thm.passed ? "PASS" : "FAIL"} · {thm.runs} runs ·{" "}
                            {thm.durationMs.toFixed(1)}ms
                          </span>
                        </div>
                        {thm.counterexample && (
                          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-rose-200">
                            Shrunk counterexample: {thm.counterexample}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "SYSTEM_PROMPT" && (
            <div className="space-y-3">
              <div className="rounded border border-slate-800 bg-slate-900 p-3">
                <div className="text-slate-400 text-[11px]">
                  Deterministic Spatial Catalog SHA-256 Fingerprint (INV-4)
                </div>
                <div className="text-cyan-300 font-semibold mt-0.5 break-all">
                  {spatialVerifiedCatalog.metadata.catalogHash}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-[11px] mb-1">
                  Compiled System Instructions (`spatialVerifiedCatalog.prompt()`)
                </div>
                <pre className="max-h-72 overflow-y-auto rounded border border-slate-800 bg-slate-900/90 p-3 text-[11px] text-slate-200 whitespace-pre-wrap">
                  {systemPromptPreview}
                </pre>
              </div>
              <div>
                <div className="text-slate-400 text-[11px] mb-1">
                  Active Sanitized Spec Tree ({Object.keys(currentSpec?.elements ?? {}).length}{" "}
                  elements)
                </div>
                <pre className="max-h-64 overflow-y-auto rounded border border-slate-800 bg-slate-900/90 p-3 text-[11px] text-slate-300 whitespace-pre-wrap">
                  {JSON.stringify(currentSpec, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
