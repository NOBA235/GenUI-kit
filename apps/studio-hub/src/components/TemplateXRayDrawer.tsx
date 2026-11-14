import React, { useEffect, useRef, useState } from "react";
import type { Spec } from "@json-render/core";
import type {
  StreamTelemetrySnapshot,
  VerifiedCatalog,
} from "@genui-studio/core";
import {
  runCatalogInvariantSuite,
  type PbtSuiteReport,
} from "@genui-studio/core/testing";

export interface HubPatchLogItem {
  readonly id: number;
  readonly rawLine: string;
  readonly timestamp: string;
  readonly isChaos?: boolean;
}

export interface TemplateXRayDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly templateTitle: string;
  readonly templateSlug: string;
  readonly catalog: VerifiedCatalog<any, any>;
  readonly telemetry: StreamTelemetrySnapshot;
  readonly patchLog: readonly HubPatchLogItem[];
  readonly currentSpec: Spec | null;
  readonly onInjectChaosPacket?: () => void;
}

export const TemplateXRayDrawer: React.FC<TemplateXRayDrawerProps> = ({
  isOpen,
  onClose,
  templateTitle,
  templateSlug,
  catalog,
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
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inside) {
        dialog.close();
        onClose();
      }
    }
  };

  const handleRunInBrowserPbt = () => {
    setIsRunningPbt(true);
    requestAnimationFrame(() => {
      const report = runCatalogInvariantSuite(catalog, { numRuns: 15 });
      setPbtReport({
        ...report,
        timestamp: new Date().toISOString().slice(11, 23),
      });
      setIsRunningPbt(false);
    });
  };

  const systemPromptPreview = catalog.prompt({
    customRules: [
      `Target scoped template slug: ${templateSlug}.`,
      "Emit RFC 6902 JSONL patches targeting /root and /elements/*.",
    ],
  });

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, unknown>)}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-label="X-Ray Telemetry and PBT Inspector"
      data-testid="hub-xray-drawer"
      className="studio-dialog fixed inset-y-0 right-0 left-auto m-0 h-dvh w-full max-w-2xl border-l border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-2xl"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                @genui-studio/core · X-Ray Telemetry & PBT Inspector
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-100">
              {templateTitle} ({templateSlug})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
            data-testid="close-hub-xray-btn"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-200 hover:bg-slate-700 transition cursor-pointer"
          >
            ESC / Close ✕
          </button>
        </div>

        {/* Telemetry Strip + Chaos Injection */}
        <div className="border-b border-slate-800 bg-slate-900/50 px-5 py-3.5 space-y-3">
          {onInjectChaosPacket && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-950/20 p-3">
              <div className="space-y-0.5">
                <div className="font-mono text-xs font-semibold text-rose-300">
                  Adversarial Guardrail Stress Test (INV-PBT-02)
                </div>
                <p className="text-xs text-slate-300">
                  Fires out-of-bounds props & cyclic references into the live
                  template stream to prove zero-crash self-healing.
                </p>
              </div>
              <button
                type="button"
                onClick={onInjectChaosPacket}
                data-testid="hub-inject-chaos-btn"
                className="shrink-0 rounded-lg border border-rose-400/50 bg-rose-500 px-3 py-1.5 font-mono text-xs font-semibold text-slate-950 hover:bg-rose-400 transition cursor-pointer"
              >
                ⚡ Inject Chaos Packet
              </button>
            </div>
          )}

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
              <span className="block text-[10px] text-slate-400">HEALED</span>
              <span className="text-sm font-semibold text-amber-300">
                {telemetry.healedPropsCount}
              </span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-2">
              <span className="block text-[10px] text-slate-400">CYCLES</span>
              <span className="text-sm font-semibold text-rose-300">
                {telemetry.severedCyclesCount}
              </span>
            </div>
          </div>

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
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-md px-3 py-1.5 transition cursor-pointer ${
                  activeTab === key
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">
          {activeTab === "PATCH_STREAM" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Live RFC 6902 Patch Frames</span>
                <span>
                  Elements:{" "}
                  {currentSpec ? Object.keys(currentSpec.elements).length : 0}
                </span>
              </div>
              {patchLog.length === 0 ? (
                <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-slate-400">
                  Stream initialized. Use the GenUI Live Remix Bar to stream new
                  RFC 6902 mutations.
                </div>
              ) : (
                patchLog.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded border p-2.5 break-all ${
                      item.isChaos
                        ? "border-rose-500/40 bg-rose-950/20 text-rose-200"
                        : "border-slate-800 bg-slate-900/60 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>#{item.id}</span>
                      <span>{item.timestamp}</span>
                    </div>
                    {item.rawLine}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "DIAGNOSTICS" && (
            <div className="space-y-3">
              {telemetry.recentDiagnostics.length === 0 &&
              telemetry.activeFaults.length === 0 &&
              telemetry.recentIssues.length === 0 ? (
                <div className="rounded border border-emerald-500/30 bg-emerald-950/15 p-4 text-emerald-300">
                  ✔ Zero healed props, zero graph cycles, and zero element faults.
                </div>
              ) : (
                <>
                  {telemetry.recentDiagnostics.map((d, idx) => (
                    <div
                      key={`diag-${idx}`}
                      className="rounded border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200"
                    >
                      <div className="font-semibold">
                        [{d.status.toUpperCase()}] {d.componentType}.{d.propName}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1">
                        {d.reason}
                      </div>
                    </div>
                  ))}
                  {telemetry.recentIssues.map((issue, idx) => (
                    <div
                      key={`issue-${idx}`}
                      className="rounded border border-rose-500/30 bg-rose-950/20 p-3 text-rose-200"
                    >
                      <div className="font-semibold">{issue.code}</div>
                      <div className="text-[11px] text-slate-300 mt-1">
                        {issue.message}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === "PBT_SUITE" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <div>
                  <div className="font-semibold text-slate-100">
                    In-Browser fast-check Verification
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Executes INV-PBT-01 through INV-PBT-04 directly against this
                    template&apos;s VerifiedCatalog.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRunningPbt}
                  onClick={handleRunInBrowserPbt}
                  data-testid="hub-run-pbt-btn"
                  className="rounded-lg bg-cyan-500 px-3.5 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition cursor-pointer"
                >
                  {isRunningPbt ? "Running..." : "Run fast-check PBT Suite"}
                </button>
              </div>

              {pbtReport && (
                <div className="space-y-2.5" data-testid="hub-pbt-report">
                  <div
                    className={`rounded border p-3 ${
                      pbtReport.allPassed
                        ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                        : "border-rose-500/40 bg-rose-950/20 text-rose-300"
                    }`}
                  >
                    {pbtReport.allPassed
                      ? `✔ ALL ${pbtReport.theorems.length} FORMAL THEOREMS PASSED (${pbtReport.totalDurationMs.toFixed(1)}ms)`
                      : "✖ INVARIANT VIOLATION DETECTED"}
                  </div>
                  {pbtReport.theorems.map((t) => (
                    <div
                      key={t.id}
                      className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-100">
                          {t.id}: {t.name}
                        </span>
                        <span
                          className={
                            t.passed ? "text-emerald-300" : "text-rose-300"
                          }
                        >
                          {t.passed ? "PASS" : "FAIL"} ({t.runs} runs ·{" "}
                          {t.durationMs.toFixed(1)}ms)
                        </span>
                      </div>
                      {t.counterexample && (
                        <pre className="text-[11px] text-rose-300 overflow-x-auto">
                          {t.counterexample}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "SYSTEM_PROMPT" && (
            <div className="space-y-3">
              <div className="rounded border border-slate-800 bg-slate-900/60 p-3 space-y-1">
                <div className="text-[11px] text-slate-400">
                  CANONICAL SHA-256 FINGERPRINT
                </div>
                <div className="text-cyan-300 break-all">
                  {catalog.metadata.catalogHash}
                </div>
              </div>
              <pre className="rounded border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                {systemPromptPreview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
