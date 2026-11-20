import React, { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, X, XCircle, Zap } from "lucide-react";
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

function isPointerOutsideDialog(
  e: React.PointerEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement,
): boolean {
  const r = dialog.getBoundingClientRect();
  return (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  );
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
  const pressedOutsideRef = useRef(false);
  const titleId = useId();
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

  // Fallback for browsers without <dialog closedby="any"> (Safari):
  // require both pointerdown and pointerup outside the dialog box so text-selection drags don't dismiss.
  const handlePointerDown = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;
    pressedOutsideRef.current = isPointerOutsideDialog(e, dialog);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;
    if (pressedOutsideRef.current && isPointerOutsideDialog(e, dialog)) {
      dialog.close();
      onClose();
    }
    pressedOutsideRef.current = false;
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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-labelledby={titleId}
      data-testid="hub-xray-drawer"
      className="studio-dialog fixed inset-y-0 right-0 left-auto m-0 h-dvh w-full max-w-2xl border-l border-[#E4E4E7] bg-white p-0 text-[#09090B] shadow-2xl"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E4E4E7] bg-[#FAFAFA] px-4 py-4 sm:gap-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-[#2563EB]"
              />
              <span className="font-mono text-[0.6875rem] font-medium text-[#2563EB]">
                @genui-studio/core · X-Ray Telemetry &amp; PBT Inspector
              </span>
            </div>
            <h2
              id={titleId}
              className="mt-1 truncate text-base font-semibold tracking-tight text-[#09090B]"
            >
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
            className="inline-flex shrink-0 min-h-[32px] items-center gap-1 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            <span className="hidden sm:inline font-mono text-[0.625rem] text-[#71717A]">ESC</span>
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Telemetry Strip + Chaos Injection */}
        <div className="border-b border-[#E4E4E7] bg-white px-4 py-3.5 space-y-3 sm:px-5">
          {onInjectChaosPacket && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="font-mono text-xs font-semibold text-[#991B1B]">
                  Adversarial Guardrail Stress Test (INV-PBT-02)
                </div>
                <p className="text-xs text-[#52525B]">
                  Fires out-of-bounds props &amp; cyclic references into the live
                  template stream to prove zero-crash self-healing.
                </p>
              </div>
              <button
                type="button"
                onClick={onInjectChaosPacket}
                data-testid="hub-inject-chaos-btn"
                className="inline-flex shrink-0 min-h-[32px] items-center gap-1.5 rounded-lg bg-[#B91C1C] px-3 py-1.5 font-mono text-xs font-medium text-white hover:bg-[#991B1B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
              >
                <Zap aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Inject Chaos Packet</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3 md:grid-cols-6">
            <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
              <span className="block text-[0.625rem] font-medium text-[#71717A]">PATCHES</span>
              <span className="text-sm font-semibold tabular-nums text-[#09090B]">
                {telemetry.patchCount}
              </span>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
              <span className="block text-[0.625rem] font-medium text-[#71717A]">THROUGHPUT</span>
              <span className="text-sm font-semibold tabular-nums text-[#047857]">
                {Math.round(telemetry.tokensPerSec)} tok/s
              </span>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
              <span className="block text-[0.625rem] font-medium text-[#71717A]">LATENCY</span>
              <span className="text-sm font-semibold tabular-nums text-[#09090B]">
                {telemetry.lastValidationLatencyMs.toFixed(2)}ms
              </span>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
              <span className="block text-[0.625rem] font-medium text-[#71717A]">COMPLIANCE</span>
              <span className="text-sm font-semibold tabular-nums text-[#047857]">
                {(telemetry.schemaComplianceRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
              <span className="block text-[0.625rem] font-medium text-[#71717A]">HEALED</span>
              <span className="text-sm font-semibold tabular-nums text-[#B45309]">
                {telemetry.healedPropsCount}
              </span>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
              <span className="block text-[0.625rem] font-medium text-[#71717A]">CYCLES</span>
              <span className="text-sm font-semibold tabular-nums text-[#B91C1C]">
                {telemetry.severedCyclesCount}
              </span>
            </div>
          </div>

          <div
            role="group"
            aria-label="Inspector sections"
            className="hub-scroll-row gap-1.5 pt-0.5 font-mono text-xs sm:flex-wrap"
          >
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
                className={`min-h-[30px] rounded-md border px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                  activeTab === key
                    ? "border-[#09090B] bg-[#09090B] text-white"
                    : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto bg-[#FAFAFA] p-4 space-y-4 font-mono text-xs sm:p-5">
          {activeTab === "PATCH_STREAM" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[0.6875rem] font-medium text-[#52525B]">
                <span>Live RFC 6902 Patch Frames</span>
                <span className="tabular-nums">
                  Elements:{" "}
                  {currentSpec ? Object.keys(currentSpec.elements).length : 0}
                </span>
              </div>
              {patchLog.length === 0 ? (
                <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 text-[#52525B]">
                  Stream initialized. Use the Live Remix Bar to stream new
                  RFC 6902 mutations.
                </div>
              ) : (
                patchLog.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 break-all ${
                      item.isChaos
                        ? "border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]"
                        : "border-[#E4E4E7] bg-white text-[#09090B]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[0.625rem] text-[#71717A] mb-1 tabular-nums">
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
                <div className="flex items-center gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4 font-medium text-[#065F46]">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span>Zero healed props, zero graph cycles, and zero element faults.</span>
                </div>
              ) : (
                <>
                  {telemetry.recentDiagnostics.map((d, idx) => (
                    <div
                      key={`diag-${idx}`}
                      className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[#78350F]"
                    >
                      <div className="font-semibold">
                        [{d.status.toUpperCase()}] {d.componentType}.{d.propName}
                      </div>
                      <div className="text-[0.6875rem] text-[#52525B] mt-1">
                        {d.reason}
                      </div>
                    </div>
                  ))}
                  {telemetry.recentIssues.map((issue, idx) => (
                    <div
                      key={`issue-${idx}`}
                      className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[#7F1D1D]"
                    >
                      <div className="font-semibold">{issue.code}</div>
                      <div className="text-[0.6875rem] text-[#52525B] mt-1">
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E4E7] bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#09090B]">
                    In-Browser fast-check Verification
                  </div>
                  <p className="text-[0.6875rem] text-[#52525B] mt-1">
                    Executes INV-PBT-01 through INV-PBT-04 directly against this
                    template&apos;s VerifiedCatalog.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRunningPbt}
                  onClick={handleRunInBrowserPbt}
                  data-testid="hub-run-pbt-btn"
                  className="min-h-[36px] rounded-lg bg-[#09090B] px-3.5 py-1.5 font-medium text-white hover:enabled:bg-[#18181B] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  {isRunningPbt ? "Running..." : "Run fast-check PBT Suite"}
                </button>
              </div>

              {pbtReport && (
                <div className="space-y-2.5" data-testid="hub-pbt-report">
                  <div
                    className={`flex items-center gap-2 rounded-xl border p-3 font-semibold ${
                      pbtReport.allPassed
                        ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]"
                        : "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                    }`}
                  >
                    {pbtReport.allPassed ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {pbtReport.allPassed
                        ? `ALL ${pbtReport.theorems.length} FORMAL THEOREMS PASSED (${pbtReport.totalDurationMs.toFixed(1)}ms)`
                        : "INVARIANT VIOLATION DETECTED"}
                    </span>
                  </div>
                  {pbtReport.theorems.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-[#E4E4E7] bg-white p-3.5 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#09090B]">
                          {t.id}: {t.name}
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            t.passed ? "text-[#047857]" : "text-[#B91C1C]"
                          }`}
                        >
                          {t.passed ? "PASS" : "FAIL"} ({t.runs} runs ·{" "}
                          {t.durationMs.toFixed(1)}ms)
                        </span>
                      </div>
                      {t.counterexample && (
                        <pre className="hub-code-surface rounded-lg border border-white/10 p-2.5 text-[0.6875rem] overflow-x-auto">
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
              <div className="rounded-xl border border-[#E4E4E7] bg-white p-3.5 space-y-1">
                <div className="text-[0.6875rem] font-medium text-[#71717A]">
                  CANONICAL SHA-256 FINGERPRINT
                </div>
                <div className="font-semibold text-[#2563EB] break-all">
                  {catalog.metadata.catalogHash}
                </div>
              </div>
              <pre className="hub-code-surface rounded-xl border border-white/10 p-4 text-[0.6875rem] whitespace-pre-wrap leading-relaxed">
                {systemPromptPreview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
