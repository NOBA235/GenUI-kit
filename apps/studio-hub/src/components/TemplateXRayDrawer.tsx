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
      className="studio-dialog fixed inset-y-0 right-0 left-auto m-0 h-dvh w-full max-w-2xl border-l border-[#E8EDF5] bg-white p-0 text-[#0B1221] shadow-2xl"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E8EDF5] bg-[#FAFBFD] px-4 py-4 sm:gap-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-[#2563EB]"
              />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                @genui-studio/core · X-Ray Telemetry &amp; PBT Inspector
              </span>
            </div>
            <h2 className="mt-1 truncate text-base font-bold text-[#0B1221]">
              {templateTitle} ({templateSlug})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
            data-testid="close-hub-xray-btn"
            className="shrink-0 min-h-[34px] rounded-full border border-[#CBD5E1] bg-white px-3.5 py-1.5 font-mono text-xs font-semibold text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
<span className="hidden sm:inline">ESC / </span>Close ✕
          </button>
        </div>

        {/* Telemetry Strip + Chaos Injection */}
        <div className="border-b border-[#E8EDF5] bg-white px-4 py-3.5 space-y-3 sm:px-5">
          {onInjectChaosPacket && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3.5">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="font-mono text-xs font-bold text-[#991B1B]">
                  Adversarial Guardrail Stress Test (INV-PBT-02)
                </div>
                <p className="text-xs text-[#5B6B82]">
                  Fires out-of-bounds props &amp; cyclic references into the live
                  template stream to prove zero-crash self-healing.
                </p>
              </div>
              <button
                type="button"
                onClick={onInjectChaosPacket}
                data-testid="hub-inject-chaos-btn"
                className="shrink-0 min-h-[34px] rounded-full bg-[#B91C1C] px-4 py-1.5 font-mono text-xs font-semibold text-white hover:bg-[#991B1B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
              >
                ⚡ Inject Chaos Packet
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3 md:grid-cols-6">
            <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5">
              <span className="block text-[10px] font-semibold text-[#64748B]">PATCHES</span>
              <span className="text-sm font-bold tabular-nums text-[#0B1221]">
                {telemetry.patchCount}
              </span>
            </div>
            <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5">
              <span className="block text-[10px] font-semibold text-[#64748B]">THROUGHPUT</span>
              <span className="text-sm font-bold tabular-nums text-[#047857]">
                {Math.round(telemetry.tokensPerSec)} tok/s
              </span>
            </div>
            <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5">
              <span className="block text-[10px] font-semibold text-[#64748B]">LATENCY</span>
              <span className="text-sm font-bold tabular-nums text-[#0B1221]">
                {telemetry.lastValidationLatencyMs.toFixed(2)}ms
              </span>
            </div>
            <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5">
              <span className="block text-[10px] font-semibold text-[#64748B]">COMPLIANCE</span>
              <span className="text-sm font-bold tabular-nums text-[#047857]">
                {(telemetry.schemaComplianceRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5">
              <span className="block text-[10px] font-semibold text-[#64748B]">HEALED</span>
              <span className="text-sm font-bold tabular-nums text-[#B45309]">
                {telemetry.healedPropsCount}
              </span>
            </div>
            <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5">
              <span className="block text-[10px] font-semibold text-[#64748B]">CYCLES</span>
              <span className="text-sm font-bold tabular-nums text-[#B91C1C]">
                {telemetry.severedCyclesCount}
              </span>
            </div>
          </div>

          <div className="hub-scroll-row gap-1.5 pt-1 font-mono text-xs sm:flex-wrap">
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
                aria-pressed={activeTab === key}
                onClick={() => setActiveTab(key)}
                className={`min-h-[32px] rounded-full border px-3.5 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                  activeTab === key
                    ? "border-[#0B1324] bg-[#0B1324] text-white font-semibold"
                    : "border-[#CBD5E1] bg-white text-[#5B6B82] hover:border-[#0B1221] hover:text-[#0B1221]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 space-y-4 font-mono text-xs sm:p-5">
          {activeTab === "PATCH_STREAM" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#5B6B82]">
                <span>Live RFC 6902 Patch Frames</span>
                <span>
                  Elements:{" "}
                  {currentSpec ? Object.keys(currentSpec.elements).length : 0}
                </span>
              </div>
              {patchLog.length === 0 ? (
                <div className="rounded-2xl border border-[#E8EDF5] bg-white p-4 text-[#5B6B82]">
                  Stream initialized. Use the GenUI Live Remix Bar to stream new
                  RFC 6902 mutations.
                </div>
              ) : (
                patchLog.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 break-all ${
                      item.isChaos
                        ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#7F1D1D]"
                        : "border-[#E8EDF5] bg-white text-[#0B1221]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#64748B] mb-1">
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
                <div className="rounded-2xl border border-[#6EE7B7] bg-[#ECFDF5] p-4 font-medium text-[#065F46]">
                  ✔ Zero healed props, zero graph cycles, and zero element faults.
                </div>
              ) : (
                <>
                  {telemetry.recentDiagnostics.map((d, idx) => (
                    <div
                      key={`diag-${idx}`}
                      className="rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] p-3 text-[#78350F]"
                    >
                      <div className="font-semibold">
                        [{d.status.toUpperCase()}] {d.componentType}.{d.propName}
                      </div>
                      <div className="text-[11px] text-[#5B6B82] mt-1">
                        {d.reason}
                      </div>
                    </div>
                  ))}
                  {telemetry.recentIssues.map((issue, idx) => (
                    <div
                      key={`issue-${idx}`}
                      className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[#7F1D1D]"
                    >
                      <div className="font-semibold">{issue.code}</div>
                      <div className="text-[11px] text-[#5B6B82] mt-1">
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8EDF5] bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#0B1221]">
                    In-Browser fast-check Verification
                  </div>
                  <p className="text-[11px] text-[#5B6B82] mt-1">
                    Executes INV-PBT-01 through INV-PBT-04 directly against this
                    template&apos;s VerifiedCatalog.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRunningPbt}
                  onClick={handleRunInBrowserPbt}
                  data-testid="hub-run-pbt-btn"
                  className="min-h-[38px] rounded-full bg-[#0B1324] px-4 py-2 font-semibold text-white hover:bg-[#1E293B] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  {isRunningPbt ? "Running..." : "Run fast-check PBT Suite"}
                </button>
              </div>

              {pbtReport && (
                <div className="space-y-2.5" data-testid="hub-pbt-report">
                  <div
                    className={`rounded-2xl border p-3 font-semibold ${
                      pbtReport.allPassed
                        ? "border-[#6EE7B7] bg-[#ECFDF5] text-[#065F46]"
                        : "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
                    }`}
                  >
                    {pbtReport.allPassed
                      ? `✔ ALL ${pbtReport.theorems.length} FORMAL THEOREMS PASSED (${pbtReport.totalDurationMs.toFixed(1)}ms)`
                      : "✖ INVARIANT VIOLATION DETECTED"}
                  </div>
                  {pbtReport.theorems.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-[#E8EDF5] bg-white p-3.5 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#0B1221]">
                          {t.id}: {t.name}
                        </span>
                        <span
                          className={`font-semibold ${
                            t.passed ? "text-[#047857]" : "text-[#B91C1C]"
                          }`}
                        >
                          {t.passed ? "PASS" : "FAIL"} ({t.runs} runs ·{" "}
                          {t.durationMs.toFixed(1)}ms)
                        </span>
                      </div>
                      {t.counterexample && (
                        <pre className="hub-code-surface rounded-xl border border-white/10 p-2.5 text-[11px] overflow-x-auto">
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
              <div className="rounded-2xl border border-[#E8EDF5] bg-white p-3.5 space-y-1">
                <div className="text-[11px] font-bold text-[#5B6B82]">
                  CANONICAL SHA-256 FINGERPRINT
                </div>
                <div className="font-semibold text-[#2563EB] break-all">
                  {catalog.metadata.catalogHash}
                </div>
              </div>
              <pre className="hub-code-surface rounded-2xl border border-white/10 p-4 text-[11px] whitespace-pre-wrap leading-relaxed">
                {systemPromptPreview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
