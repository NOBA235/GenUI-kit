import React, {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { defineRegistry, useStateStore } from "@json-render/react";
import {
  TelemetryTracker,
  TimeTravelStateStore,
  wrapRegistryWithTelemetry,
} from "@genui-studio/core";
import { finopsVerifiedCatalog } from "./finops-catalog.js";
import {
  CohortRow,
  CustomerAccount,
  executeFinOpsMutation,
  FinOpsAuditEntry,
  FinOpsMetrics,
  formatUsdCents,
  MrrHistoryPoint,
  WebhookEventRecord,
} from "../data/ledger-seed.js";

export interface FinOpsRuntimeContextValue {
  timeTravelStore?: TimeTravelStateStore;
  onMutationExecuted?: (entry: FinOpsAuditEntry) => void;
}

export const FinOpsRuntimeContext = createContext<FinOpsRuntimeContextValue>({});

const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Helper hook that executes a FinOps ledger mutation through TimeTravelStateStore
 * (recording an undo/redo snapshot) or falls back to the active @json-render StateStore.
 */
function useFinOpsMutation() {
  const stateStore = useStateStore();
  const { timeTravelStore, onMutationExecuted } = useContext(FinOpsRuntimeContext);

  return (
    type:
      | "issuePartialRefund"
      | "extendTrialPeriod"
      | "retryFailedWebhook"
      | "applyRetentionDiscount",
    payload: Record<string, unknown>
  ): FinOpsAuditEntry => {
    const targetStore = timeTravelStore ?? {
      get: (p: string) => stateStore.get(p),
      set: (p: string, v: unknown) => stateStore.set(p, v),
      update: (updates: Record<string, unknown>) => stateStore.update(updates),
    };
    const entry = executeFinOpsMutation(targetStore, type, payload);
    if (onMutationExecuted) {
      onMutationExecuted(entry);
    }
    return entry;
  };
}

interface PaymentTraceSpanItem {
  spanId: string;
  stepName: string;
  gatewayService: string;
  startOffsetMs: number;
  durationMs: number;
  status: "OK" | "ERROR";
  errorCode?: string;
  detailMessage?: string;
}

interface PaymentTraceInspectorProps {
  title: string;
  traceId: string;
  accountId: string;
  invoiceId: string;
  gateway: "STRIPE_PRIMARY" | "STRIPE_EU_FALLBACK" | "ADYEN_BACKUP_MID";
  recommendedGateway: "STRIPE_PRIMARY" | "STRIPE_EU_FALLBACK" | "ADYEN_BACKUP_MID";
  totalDurationMs: number;
  recommendedAction: string;
  spans: PaymentTraceSpanItem[];
}

function PaymentTraceInspectorView({
  props,
}: {
  props: PaymentTraceInspectorProps;
}) {
  const { get } = useStateStore();
  const mutate = useFinOpsMutation();

  const defaultSelected =
    props.spans.find((s) => s.status === "ERROR")?.spanId ??
    props.spans[0]?.spanId ??
    null;
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(
    defaultSelected
  );
  const [replayed, setReplayed] = useState(false);

  const webhooks =
    (get("/ledger/webhooks") as WebhookEventRecord[] | undefined) ?? [];
  const matchingWebhook =
    webhooks.find(
      (w) =>
        (w.accountId === props.accountId || w.invoiceId === props.invoiceId) &&
        w.status !== "DELIVERED"
    ) ??
    webhooks.find((w) => w.status !== "DELIVERED") ??
    webhooks[0];

  const hasErrors = props.spans.some((s) => s.status === "ERROR") && !replayed;
  const maxDuration = Math.max(
    1,
    props.totalDurationMs,
    ...props.spans.map((s) => s.startOffsetMs + s.durationMs)
  );
  const selectedSpan =
    props.spans.find((s) => s.spanId === selectedSpanId) ?? props.spans[0];

  const handleFailoverReplay = () => {
    mutate("retryFailedWebhook", {
      webhookId: matchingWebhook?.id ?? "wh_3001",
      routeGateway: props.recommendedGateway,
    });
    setReplayed(true);
  };

  return (
    <div
      className="rounded-xl border border-slate-800/90 bg-slate-950/90 p-4 shadow-lg"
      data-testid="payment-trace-inspector"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                hasErrors
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              {hasErrors ? "FAILURE TRACE" : "RECOVERED / SETTLED"}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {props.traceId}
            </span>
          </div>
          <h3 className="mt-1 font-sans text-sm font-semibold text-slate-100">
            {props.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>
              Gateway:{" "}
              <strong className="text-slate-200">
                {replayed ? props.recommendedGateway : props.gateway}
              </strong>
            </span>
            <span>
              Account: <strong className="text-slate-200">{props.accountId}</strong>
            </span>
            <span>
              Invoice: <strong className="text-slate-200">{props.invoiceId}</strong>
            </span>
            <span>
              Total Latency:{" "}
              <strong
                className={
                  props.totalDurationMs > 1000 && !replayed
                    ? "text-rose-300"
                    : "text-emerald-300"
                }
              >
                {replayed ? "84ms (Post-Failover)" : `${props.totalDurationMs}ms`}
              </strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFailoverReplay}
          data-testid="payment-trace-failover-btn"
          className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition ${
            replayed
              ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-200"
              : "border-cyan-400/50 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
          }`}
        >
          {replayed
            ? `✓ Replayed via ${props.recommendedGateway}`
            : `⚡ Failover & Replay via ${props.recommendedGateway}`}
        </button>
      </div>

      {/* Gantt Execution Span Waterfall */}
      <div className="mt-3 space-y-1.5">
        {props.spans.map((span) => {
          const isError = span.status === "ERROR" && !replayed;
          const isSelected = selectedSpan?.spanId === span.spanId;
          const leftPct = Math.min(
            94,
            Math.max(0, (span.startOffsetMs / maxDuration) * 100)
          );
          const widthPct = Math.max(
            4,
            Math.min(100 - leftPct, (span.durationMs / maxDuration) * 100)
          );

          return (
            <button
              key={span.spanId}
              type="button"
              onClick={() => setSelectedSpanId(span.spanId)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                isSelected
                  ? "border-cyan-500/50 bg-slate-900/90"
                  : "border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/70"
              }`}
            >
              <div className="grid grid-cols-12 items-center gap-2 font-mono text-xs">
                <div className="col-span-5 truncate">
                  <span
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                      isError ? "bg-rose-400" : "bg-emerald-400"
                    }`}
                  />
                  <span className="font-semibold text-slate-200">
                    {span.stepName}
                  </span>
                  <span className="ml-2 text-[10px] text-slate-400">
                    ({span.gatewayService})
                  </span>
                </div>

                <div className="col-span-5 relative h-3 rounded bg-slate-800/90 overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded ${
                      isError ? "bg-rose-500" : "bg-cyan-400"
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                  />
                </div>

                <div className="col-span-2 text-right font-semibold">
                  <span className={isError ? "text-rose-300" : "text-slate-300"}>
                    {span.durationMs}ms
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Span Diagnostics & Action Recommendation */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {selectedSpan && (
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/75 p-2.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Selected Hop: {selectedSpan.spanId}</span>
              <span
                className={
                  selectedSpan.status === "ERROR" && !replayed
                    ? "text-rose-300 font-bold"
                    : "text-emerald-300 font-bold"
                }
              >
                {replayed ? "OK (RECOVERED)" : selectedSpan.status}
              </span>
            </div>
            {selectedSpan.errorCode && (
              <div className="mt-1 text-rose-300">
                error_code: <strong>{selectedSpan.errorCode}</strong>
              </div>
            )}
            <div className="mt-1 font-sans text-xs text-slate-200">
              {selectedSpan.detailMessage ??
                `${selectedSpan.stepName} completed in ${selectedSpan.durationMs}ms`}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 font-mono text-[11px] text-amber-100">
          <div className="font-bold uppercase tracking-wider text-amber-300">
            Recommended Automated Runbook
          </div>
          <p className="mt-1 font-sans text-xs text-amber-100/90">
            {props.recommendedAction}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Mandatory light-dismiss backdrop click fallback for browsers without native `closedby="any"` support.
 */
function handleDialogLightDismiss(
  e: React.MouseEvent<HTMLDialogElement>,
  dialogEl: HTMLDialogElement | null
) {
  if (!dialogEl) return;
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const rect = dialogEl.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      dialogEl.close();
    }
  }
}

type FinOpsActionName =
  | "issuePartialRefund"
  | "extendTrialPeriod"
  | "retryFailedWebhook"
  | "applyRetentionDiscount";

/**
 * Builds a catalog-level action handler that runs the real ledger mutation against the
 * @json-render state model (used when an LLM-emitted `on.press` binding fires an action
 * instead of a mutation card's local button).
 */
function createLedgerActionHandler(actionName: FinOpsActionName) {
  return async (
    params: Record<string, unknown> | undefined,
    setState: (
      updater: (prev: Record<string, unknown>) => Record<string, unknown>
    ) => void
  ): Promise<void> => {
    if (!params) return;
    setState((prev) => {
      const next = structuredClone(prev);
      const readPointer = (path: string): unknown =>
        path
          .split("/")
          .filter(Boolean)
          .reduce<unknown>(
            (node, seg) =>
              node && typeof node === "object"
                ? (node as Record<string, unknown>)[seg]
                : undefined,
            next
          );
      const writePointer = (path: string, value: unknown): void => {
        const segs = path.split("/").filter(Boolean);
        let node = next as Record<string, unknown>;
        for (const seg of segs.slice(0, -1)) {
          node[seg] ??= {};
          node = node[seg] as Record<string, unknown>;
        }
        node[segs[segs.length - 1]!] = value;
      };
      executeFinOpsMutation(
        { get: readPointer, set: writePointer },
        actionName,
        params
      );
      return next;
    });
  };
}

export const finopsActionHandlers = {
  issuePartialRefund: createLedgerActionHandler("issuePartialRefund"),
  extendTrialPeriod: createLedgerActionHandler("extendTrialPeriod"),
  retryFailedWebhook: createLedgerActionHandler("retryFailedWebhook"),
  applyRetentionDiscount: createLedgerActionHandler("applyRetentionDiscount"),
};

export function createFinOpsRegistry(telemetry?: TelemetryTracker) {
  const { registry: rawComponentRegistry, handlers, executeAction } = defineRegistry(finopsVerifiedCatalog.catalog, {
    components: {
      WorkspaceShell: ({ props, children }) => {
        const riskBadgeColor =
          props.riskLevel === "CRITICAL"
            ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
            : props.riskLevel === "ELEVATED"
            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";

        return (
          <div
            className="space-y-6 rounded-xl border border-slate-800/90 bg-slate-950/75 p-5 shadow-2xl"
            data-testid="finops-workspace-shell"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-cyan-300">
                    {props.playbookTag}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${riskBadgeColor}`}
                  >
                    RISK: {props.riskLevel}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">
                  {props.title}
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">{props.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Guardrailed RFC 6902 Spec Surface</span>
              </div>
            </div>
            <div className="space-y-6">{children}</div>
          </div>
        );
      },

      SectionGrid: ({ props, children }) => {
        const gridCols =
          props.columns === "4"
            ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
            : props.columns === "3"
            ? "grid-cols-1 md:grid-cols-3"
            : props.columns === "2"
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-cols-1";

        return (
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                {props.heading}
              </h3>
              {props.description && (
                <p className="text-xs text-slate-400">{props.description}</p>
              )}
            </div>
            <div className={`grid gap-4 ${gridCols}`}>{children}</div>
          </section>
        );
      },

      KpiMetricCard: ({ props }) => {
        if (props.caption === "CHAOS_TRIGGER_RENDER_CRASH") {
          throw new Error(
            "Chaos Injection: Simulated leaf KpiMetricCard runtime exception caught by GenUIElementErrorBoundary"
          );
        }
        const { get } = useStateStore();
        const rawValue = get(props.valuePath);
        const numericValue = typeof rawValue === "number" ? rawValue : 0;

        const formattedValue =
          props.unit === "USD"
            ? formatUsdCents(numericValue)
            : props.unit === "PERCENT"
            ? `${numericValue.toFixed(1)}%`
            : numericValue.toLocaleString("en-US");

        const deltaBadge =
          props.deltaDirection === "UP_GOOD" || props.deltaDirection === "DOWN_GOOD"
            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
            : props.deltaDirection === "DOWN_BAD"
            ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
            : "text-slate-300 bg-slate-800 border-slate-700";

        return (
          <div
            className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-4 transition hover:border-slate-700"
            data-testid="kpi-metric-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">
                {props.label}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium ${deltaBadge}`}
              >
                {props.deltaText}
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-50 tabular-nums">
              {formattedValue}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>{props.caption}</span>
              <code className="rounded bg-slate-950/80 px-1 py-0.5 font-mono text-[10px] text-cyan-400">
                {props.valuePath}
              </code>
            </div>
          </div>
        );
      },

      MrrChurnChart: ({ props }) => {
        const { get } = useStateStore();
        const history =
          (get("/ledger/mrrHistory") as MrrHistoryPoint[] | undefined) ?? [];
        const metrics = get("/ledger/metrics") as FinOpsMetrics | undefined;
        const [activeView, setActiveView] = useState(props.defaultView);
        const [selectedMonth, setSelectedMonth] = useState<string | null>(
          props.highlightMonth ?? null
        );

        const maxMrr = Math.max(
          1,
          ...history.map((h) => h.endingMrrCents)
        );

        const activePoint =
          history.find((h) => h.month === selectedMonth) ??
          history[history.length - 1];

        return (
          <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">
                  {props.title}
                </h4>
                <p className="text-xs text-slate-400">{props.subtitle}</p>
              </div>
              <div className="flex rounded-md border border-slate-800 bg-slate-950 p-0.5 text-xs">
                {(
                  [
                    ["NET_WATERFALL", "Net MRR"],
                    ["CHURN_VS_EXPANSION", "Expansion vs Churn"],
                    ["NET_MRR_TREND", "Growth Curve"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setActiveView(mode)}
                    className={`rounded px-2.5 py-1 font-medium transition ${
                      activeView === mode
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive SVG Bar/Area Chart */}
            <div className="mt-4 grid grid-cols-12 items-end gap-2 pt-4 h-44 border-b border-slate-800/80 pb-2">
              {history.map((pt) => {
                const heightPct = Math.max(
                  14,
                  Math.round((pt.endingMrrCents / maxMrr) * 100)
                );
                const expansionPct = Math.min(
                  100,
                  Math.round(
                    ((pt.newMrrCents + pt.expansionMrrCents) /
                      Math.max(1, pt.endingMrrCents)) *
                      380
                  )
                );
                const churnPct = Math.min(
                  100,
                  Math.round(
                    ((pt.churnedMrrCents + pt.contractionMrrCents) /
                      Math.max(1, pt.endingMrrCents)) *
                      380
                  )
                );
                const isSelected = activePoint?.month === pt.month;

                return (
                  <button
                    key={pt.month}
                    type="button"
                    onClick={() => setSelectedMonth(pt.month)}
                    className={`group flex h-full flex-col justify-end items-center gap-1 rounded px-1 py-1 transition ${
                      isSelected
                        ? "bg-cyan-500/10 ring-1 ring-cyan-500/40"
                        : "hover:bg-slate-800/60"
                    }`}
                    title={`${pt.month}: ${formatUsdCents(pt.endingMrrCents)}`}
                  >
                    {activeView === "CHURN_VS_EXPANSION" ? (
                      <div className="flex w-full items-end justify-center gap-0.5 h-32">
                        <div
                          style={{ height: `${ Math.max(12, expansionPct) }%` }}
                          className="w-2.5 rounded-t bg-emerald-400/85"
                        />
                        <div
                          style={{ height: `${ Math.max(10, churnPct) }%` }}
                          className="w-2.5 rounded-t bg-rose-400/85"
                        />
                      </div>
                    ) : (
                      <div className="flex w-full items-end justify-center h-32">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t transition ${
                            isSelected
                              ? "bg-cyan-400"
                              : "bg-indigo-500/75 group-hover:bg-indigo-400"
                          }`}
                        />
                      </div>
                    )}
                    <span className="font-mono text-[10px] text-slate-400">
                      {pt.month.slice(5)}
                    </span>
                  </button>
                );
              })}
            </div>

            {activePoint && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-md bg-slate-950/80 p-2.5 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">MONTH</span>
                  <span className="text-slate-100 font-semibold">
                    {activePoint.month}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    NEW + EXPANSION
                  </span>
                  <span className="text-emerald-300">
                    +{formatUsdCents(activePoint.newMrrCents + activePoint.expansionMrrCents)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    CHURN + CONTRACTION
                  </span>
                  <span className="text-rose-300">
                    -{formatUsdCents(activePoint.churnedMrrCents + activePoint.contractionMrrCents)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    PERIOD END MRR
                  </span>
                  <span className="text-cyan-300">
                    {formatUsdCents(activePoint.endingMrrCents)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    LIVE LEDGER MRR
                  </span>
                  <span className="text-emerald-300 font-semibold">
                    {formatUsdCents(metrics?.totalMrrCents ?? activePoint.endingMrrCents)}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      },

      CohortRetentionMatrix: ({ props }) => {
        const { get, set } = useStateStore();
        const cohorts = (get("/ledger/cohorts") as CohortRow[] | undefined) ?? [];
        const [regionFilter, setRegionFilter] = useState(props.focusRegion);

        const filteredCohorts = useMemo(() => {
          if (regionFilter === "ALL") return cohorts;
          return cohorts.filter((c) => c.region === regionFilter);
        }, [cohorts, regionFilter]);

        const cellColor = (val: number) => {
          if (val >= 95) return "bg-emerald-500/25 text-emerald-200";
          if (val >= 90) return "bg-cyan-500/20 text-cyan-200";
          if (val >= 85) return "bg-amber-500/20 text-amber-200";
          return "bg-rose-500/25 text-rose-200";
        };

        return (
          <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">
                  {props.title}
                </h4>
                <p className="text-xs text-slate-400">
                  Click any regional cohort to filter the live Customer Ledger below
                </p>
              </div>
              <div className="flex gap-1 font-mono text-xs">
                {(["ALL", "NA", "EMEA", "APAC", "LATAM"] as const).map((reg) => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => {
                      setRegionFilter(reg);
                      set("/ledger/filters/region", reg);
                    }}
                    className={`rounded px-2 py-1 transition ${
                      regionFilter === reg
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                    <th className="py-2 pr-3">Cohort Segment</th>
                    <th className="py-2 px-2">Accts</th>
                    <th className="py-2 px-2">M1</th>
                    <th className="py-2 px-2">M2</th>
                    <th className="py-2 px-2">M3</th>
                    <th className="py-2 px-2">M4</th>
                    <th className="py-2 px-2">M5</th>
                    <th className="py-2 px-2">M6</th>
                    <th className="py-2 pl-2 text-right">NDR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCohorts.map((row) => (
                    <tr
                      key={row.cohortId}
                      onClick={() => set("/ledger/filters/region", row.region)}
                      className="cursor-pointer hover:bg-slate-800/40 transition"
                    >
                      <td className="py-2 pr-3 font-sans font-medium text-slate-200">
                        {row.label}
                      </td>
                      <td className="py-2 px-2 text-slate-400">
                        {row.startingAccounts}
                      </td>
                      {[row.m1, row.m2, row.m3, row.m4, row.m5, row.m6].map(
                        (mVal, idx) => (
                          <td key={idx} className="py-1.5 px-1">
                            <span
                              className={`inline-block w-full rounded px-1.5 py-0.5 text-center text-[11px] ${cellColor(
                                mVal
                              )}`}
                            >
                              {mVal.toFixed(1)}%
                            </span>
                          </td>
                        )
                      )}
                      <td className="py-2 pl-2 text-right font-semibold text-emerald-300">
                        {row.ndrPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      },

      AnomalyAlertCard: ({ props }) => {
        const { set } = useStateStore();
        const badgeStyle =
          props.severity === "CRITICAL"
            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
            : props.severity === "HIGH"
            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
            : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

        return (
          <div
            className="rounded-lg border border-rose-500/30 bg-slate-900/80 p-4 shadow-lg"
            data-testid="anomaly-alert-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${badgeStyle}`}
                >
                  {props.severity} ANOMALY
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {props.anomalyId} · {props.affectedRegion}
                </span>
              </div>
              <span className="font-mono text-xs font-semibold text-rose-300">
                Revenue at Risk: {formatUsdCents(props.impactCents)}
              </span>
            </div>

            <h4 className="mt-2 text-sm font-semibold text-slate-100">
              {props.title}
            </h4>
            <p className="mt-1 text-xs text-slate-300">{props.summary}</p>

            <div className="mt-3 rounded border border-slate-800 bg-slate-950/80 p-2.5 text-xs">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                Root Cause Telemetry
              </span>
              <span className="text-slate-200">{props.rootCause}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (props.filterStatusOnSelect) {
                    set("/ledger/filters/status", props.filterStatusOnSelect);
                  }
                  if (props.affectedRegion !== "GLOBAL") {
                    set("/ledger/filters/region", props.affectedRegion);
                  }
                  set("/ledger/filters/page", 1);
                }}
                className="rounded border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition"
              >
                Isolate Affected Accounts in Ledger →
              </button>
            </div>
          </div>
        );
      },

      CustomerLedgerTable: ({ props }) => {
        const { get, set } = useStateStore();
        const captionId = useId();
        const accounts =
          (get("/ledger/accounts") as CustomerAccount[] | undefined) ?? [];
        const searchQuery =
          (get("/ledger/filters/searchQuery") as string | undefined) ?? "";
        const statusFilter =
          (get("/ledger/filters/status") as string | undefined) ??
          props.defaultStatusFilter ??
          "ALL";
        const regionFilter =
          (get("/ledger/filters/region") as string | undefined) ??
          props.defaultRegionFilter ??
          "ALL";
        const sortField =
          (get("/ledger/filters/sortField") as string | undefined) ?? "mrrCents";
        const sortDirection =
          (get("/ledger/filters/sortDirection") as
            | "ascending"
            | "descending"
            | undefined) ?? "descending";
        const currentPage =
          (get("/ledger/filters/page") as number | undefined) ?? 1;

        const filteredAndSorted = useMemo(() => {
          const q = searchQuery.trim().toLowerCase();
          const filtered = accounts.filter((acct) => {
            if (statusFilter !== "ALL" && acct.status !== statusFilter) {
              return false;
            }
            if (regionFilter !== "ALL" && acct.region !== regionFilter) {
              return false;
            }
            if (q.length > 0) {
              return (
                acct.companyName.toLowerCase().includes(q) ||
                acct.id.toLowerCase().includes(q) ||
                acct.lastInvoiceId.toLowerCase().includes(q) ||
                acct.csmOwner.toLowerCase().includes(q)
              );
            }
            return true;
          });

          const dirMultiplier = sortDirection === "ascending" ? 1 : -1;
          return [...filtered].sort((a, b) => {
            if (sortField === "mrrCents") {
              return (a.mrrCents - b.mrrCents) * dirMultiplier;
            }
            if (sortField === "healthScore") {
              return (a.healthScore - b.healthScore) * dirMultiplier;
            }
            if (sortField === "failedChargesCount") {
              return (a.failedChargesCount - b.failedChargesCount) * dirMultiplier;
            }
            if (sortField === "companyName") {
              return (
                textCollator.compare(a.companyName, b.companyName) * dirMultiplier
              );
            }
            if (sortField === "status") {
              return textCollator.compare(a.status, b.status) * dirMultiplier;
            }
            return 0;
          });
        }, [accounts, searchQuery, statusFilter, regionFilter, sortField, sortDirection]);

        const pageSize = props.pageSize || 8;
        const totalPages = Math.max(
          1,
          Math.ceil(filteredAndSorted.length / pageSize)
        );
        const safePage = Math.min(Math.max(1, currentPage), totalPages);
        const pageSlice = filteredAndSorted.slice(
          (safePage - 1) * pageSize,
          safePage * pageSize
        );

        const handleSort = (columnKey: string) => {
          if (sortField === columnKey) {
            set(
              "/ledger/filters/sortDirection",
              sortDirection === "ascending" ? "descending" : "ascending"
            );
          } else {
            set("/ledger/filters/sortField", columnKey);
            set("/ledger/filters/sortDirection", "descending");
          }
        };

        const statusBadge = (status: CustomerAccount["status"]) => {
          switch (status) {
            case "ACTIVE":
              return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
            case "PAST_DUE":
              return "bg-rose-500/15 text-rose-300 border-rose-500/40";
            case "DISPUTED":
              return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40";
            case "AT_RISK":
              return "bg-amber-500/15 text-amber-300 border-amber-500/40";
            case "TRIALING":
              return "bg-cyan-500/15 text-cyan-300 border-cyan-500/40";
            default:
              return "bg-slate-800 text-slate-400 border-slate-700";
          }
        };

        return (
          <div
            className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-4 space-y-3"
            data-testid="customer-ledger-table"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">
                  {props.title}
                </h4>
                <p className="text-xs text-slate-400">
                  Showing {pageSlice.length} of {filteredAndSorted.length} matching
                  subscriptions (Total seeded: {accounts.length})
                </p>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    set("/ledger/filters/searchQuery", e.target.value);
                    set("/ledger/filters/page", 1);
                  }}
                  placeholder="Search company, acct_id, invoice..."
                  aria-label="Search customer ledger"
                  className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                />

                <select
                  value={statusFilter}
                  aria-label="Filter by subscription status"
                  onChange={(e) => {
                    set("/ledger/filters/status", e.target.value);
                    set("/ledger/filters/page", 1);
                  }}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="ALL">Status: ALL</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAST_DUE">PAST_DUE</option>
                  <option value="DISPUTED">DISPUTED</option>
                  <option value="AT_RISK">AT_RISK</option>
                  <option value="TRIALING">TRIALING</option>
                  <option value="CHURNED">CHURNED</option>
                </select>

                <select
                  value={regionFilter}
                  aria-label="Filter by region"
                  onChange={(e) => {
                    set("/ledger/filters/region", e.target.value);
                    set("/ledger/filters/page", 1);
                  }}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="ALL">Region: ALL</option>
                  <option value="NA">NA</option>
                  <option value="EMEA">EMEA</option>
                  <option value="APAC">APAC</option>
                  <option value="LATAM">LATAM</option>
                </select>
              </div>
            </div>

            {/* WCAG-Compliant Sortable & Container-Query Responsive Table */}
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={captionId}
              className="table-wrapper rounded border border-slate-800 bg-slate-950/60"
              style={
                {
                  "--label-1": "'Customer'",
                  "--label-2": "'Plan & Region'",
                  "--label-3": "'MRR'",
                  "--label-4": "'Status'",
                  "--label-5": "'Invoice'",
                  "--label-6": "'Health'",
                } as React.CSSProperties
              }
            >
              <table className="w-full text-left text-xs border-collapse">
                <caption id={captionId} className="sr-only">
                  {props.title}
                </caption>
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "companyName" ? sortDirection : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("companyName")}
                      >
                        <span>Customer Account</span>
                        <span className="sort-icon" aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Plan / Region
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "mrrCents" ? sortDirection : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("mrrCents")}
                      >
                        <span>MRR (USD)</span>
                        <span className="sort-icon" aria-hidden="true" />
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "status" ? sortDirection : undefined
                      }
                    >
                      <button type="button" onClick={() => handleSort("status")}>
                        <span>Status</span>
                        <span className="sort-icon" aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Last Invoice / Gateway
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "healthScore" ? sortDirection : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("healthScore")}
                      >
                        <span>Health</span>
                        <span className="sort-icon" aria-hidden="true" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {pageSlice.map((acct) => (
                    <tr
                      key={acct.id}
                      onClick={() => set("/ledger/selectedAccountId", acct.id)}
                      className="cursor-pointer hover:bg-slate-800/40 transition"
                    >
                      <th scope="row" className="px-3 py-2.5 font-medium text-slate-100">
                        <div className="flex flex-col">
                          <span>{acct.companyName}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {acct.id} · CSM: {acct.csmOwner}
                          </span>
                        </div>
                      </th>
                      <td className="px-3 py-2.5 text-slate-300">
                        <span className="font-medium">{acct.planTier}</span>{" "}
                        <span className="font-mono text-[11px] text-slate-400">
                          ({acct.region})
                        </span>
                        {acct.discountPercent > 0 && (
                          <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                            -{acct.discountPercent}% OFF
                          </span>
                        )}
                      </td>
                      <td
                        className="px-3 py-2.5 font-mono font-semibold text-slate-100 tabular-nums"
                        data-value={acct.mrrCents}
                      >
                        {formatUsdCents(acct.mrrCents)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${statusBadge(
                            acct.status
                          )}`}
                        >
                          {acct.status}
                        </span>
                        {acct.trialDaysRemaining > 0 && (
                          <span className="ml-1.5 font-mono text-[10px] text-cyan-300">
                            {acct.trialDaysRemaining}d left
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        <div>
                          {acct.lastInvoiceId} ({acct.lastInvoiceStatus})
                        </div>
                        {acct.disputedAmountCents > 0 && (
                          <div className="text-rose-300">
                            Unpaid/Disputed: {formatUsdCents(acct.disputedAmountCents)}
                          </div>
                        )}
                      </td>
                      <td
                        className="px-3 py-2.5 font-mono text-xs tabular-nums"
                        data-value={acct.healthScore}
                      >
                        <span
                          className={
                            acct.healthScore >= 80
                              ? "text-emerald-300"
                              : acct.healthScore >= 55
                              ? "text-amber-300"
                              : "text-rose-300 font-semibold"
                          }
                        >
                          {acct.healthScore}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
              <span className="font-mono">
                Page {safePage} of {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => set("/ledger/filters/page", safePage - 1)}
                  className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-200 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => set("/ledger/filters/page", safePage + 1)}
                  className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-200 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        );
      },

      WebhookStreamTicker: ({ props }) => {
        const { get } = useStateStore();
        const executeMutation = useFinOpsMutation();
        const webhooks =
          (get("/ledger/webhooks") as WebhookEventRecord[] | undefined) ?? [];

        const visible = webhooks
          .filter((wh) =>
            props.filterStatus === "ALL" ? true : wh.status === props.filterStatus
          )
          .slice(0, props.maxEvents);

        return (
          <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-100">
                {props.title}
              </h4>
              <span className="font-mono text-[11px] text-slate-400">
                {visible.length} events shown
              </span>
            </div>

            <div className="divide-y divide-slate-800/70 rounded border border-slate-800 bg-slate-950/70">
              {visible.map((wh) => (
                <div
                  key={wh.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-mono">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          wh.status === "DELIVERED"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : wh.status === "FAILED"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {wh.status}
                      </span>
                      <span className="text-slate-200 font-semibold">
                        {wh.eventType}
                      </span>
                      <span className="text-slate-400">({wh.id})</span>
                    </div>
                    <div className="text-slate-400">
                      {wh.companyName} · {formatUsdCents(wh.amountCents)} ·{" "}
                      <span className="text-rose-300/90">{wh.failureReason}</span>
                    </div>
                  </div>

                  {wh.status !== "DELIVERED" && (
                    <button
                      type="button"
                      onClick={() =>
                        executeMutation("retryFailedWebhook", {
                          webhookId: wh.id,
                          routeGateway: "STRIPE_EU_FALLBACK",
                          idempotencyKey: `idem_quick_${wh.id}`,
                        })
                      }
                      className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 font-mono text-[11px] text-cyan-200 hover:bg-cyan-500/25 transition"
                    >
                      Replay Webhook ↻
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      },

      IssueRefundCard: ({ props }) => {
        const { get } = useStateStore();
        const executeMutation = useFinOpsMutation();
        const dialogRef = useRef<HTMLDialogElement>(null);
        const hintId = useId();
        const [amountDollars, setAmountDollars] = useState(
          (props.suggestedAmountCents / 100).toFixed(2)
        );
        const [reason, setReason] = useState<string>(props.defaultReason);
        const [note, setNote] = useState(props.operatorNote);
        const [interacted, setInteracted] = useState(false);
        const [lastAudit, setLastAudit] = useState<FinOpsAuditEntry | null>(null);

        const accounts =
          (get("/ledger/accounts") as CustomerAccount[] | undefined) ?? [];
        const account = accounts.find((a) => a.id === props.accountId);

        const parsedCents = Math.round(Number(amountDollars) * 100);
        const isAmountInvalid =
          !Number.isFinite(parsedCents) ||
          parsedCents < 100 ||
          parsedCents > 50_000_000;

        const handleExecute = () => {
          setInteracted(true);
          if (isAmountInvalid) return;
          const entry = executeMutation("issuePartialRefund", {
            accountId: props.accountId,
            invoiceId: props.invoiceId,
            amountCents: parsedCents,
            reason: `${reason}: ${note}`,
          });
          setLastAudit(entry);
          dialogRef.current?.close();
        };

        return (
          <div
            className="rounded-lg border border-amber-500/35 bg-slate-900/80 p-4 space-y-3"
            data-testid="issue-refund-card"
          >
            <div className="flex items-center justify-between">
              <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                MUTATION CARD · ISSUE PARTIAL REFUND
              </span>
              <span className="font-mono text-xs text-slate-400">
                {props.accountId} / {props.invoiceId}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-100">
                Credit / Partial Refund:{" "}
                {account?.companyName ?? props.accountId}
              </h4>
              <p className="text-xs text-slate-400">
                Current MRR:{" "}
                <strong className="font-mono text-slate-200">
                  {formatUsdCents(account?.mrrCents ?? 0)}
                </strong>{" "}
                · Unpaid/Disputed:{" "}
                <strong className="font-mono text-rose-300">
                  {formatUsdCents(account?.disputedAmountCents ?? 0)}
                </strong>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label
                  htmlFor={`refund-amt-${hintId}`}
                  className="block font-medium text-slate-200"
                >
                  Refund Amount (USD)
                </label>
                <span id={hintId} className="field-hint">
                  Must be between $1.00 and $500,000.00
                </span>
                <input
                  id={`refund-amt-${hintId}`}
                  type="number"
                  min={1}
                  max={500000}
                  step="0.01"
                  required
                  value={amountDollars}
                  aria-describedby={hintId}
                  aria-invalid={interacted && isAmountInvalid ? "true" : "false"}
                  onBlur={() => setInteracted(true)}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  className={`mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 ${
                    interacted && isAmountInvalid ? "user-invalid-fallback" : ""
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-200">
                    Reason Code
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="DISPUTE_RESOLUTION">DISPUTE_RESOLUTION</option>
                    <option value="SLA_CREDIT">SLA_CREDIT</option>
                    <option value="DUPLICATE_CHARGE">DUPLICATE_CHARGE</option>
                    <option value="GOODWILL_RETENTION">GOODWILL_RETENTION</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-200">
                    Audit Memo
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                  />
                </div>
              </div>
            </div>

            {lastAudit && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-200">
                ✓ Executed: {lastAudit.summary}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => dialogRef.current?.showModal()}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                Preview Gate
              </button>
              <button
                type="button"
                onClick={handleExecute}
                data-testid="execute-refund-btn"
                className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition"
              >
                Execute Refund ({formatUsdCents(Number.isFinite(parsedCents) ? parsedCents : 0)})
              </button>
            </div>

            <dialog
              ref={dialogRef}
              {...({ closedby: "any" } as Record<string, unknown>)}
              onClick={(e) => handleDialogLightDismiss(e, dialogRef.current)}
              className="m-auto max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
            >
              <h5 className="text-sm font-semibold">
                Confirm Ledger Refund Mutation
              </h5>
              <p className="mt-2 text-xs text-slate-300">
                This action will credit{" "}
                <strong className="font-mono text-amber-300">
                  {formatUsdCents(Number.isFinite(parsedCents) ? parsedCents : 0)}
                </strong>{" "}
                on invoice <code className="font-mono">{props.invoiceId}</code> for{" "}
                <strong>{account?.companyName ?? props.accountId}</strong> and record
                an immutable Time-Travel snapshot.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950"
                >
                  Confirm Refund
                </button>
              </div>
            </dialog>
          </div>
        );
      },

      ExtendTrialCard: ({ props }) => {
        const { get } = useStateStore();
        const executeMutation = useFinOpsMutation();
        const hintId = useId();
        const [days, setDays] = useState(String(props.defaultExtensionDays));
        const [note, setNote] = useState(props.playbookNote);
        const [interacted, setInteracted] = useState(false);
        const [lastAudit, setLastAudit] = useState<FinOpsAuditEntry | null>(null);

        const accounts =
          (get("/ledger/accounts") as CustomerAccount[] | undefined) ?? [];
        const account = accounts.find((a) => a.id === props.accountId);

        const parsedDays = Number(days);
        const isInvalid =
          !Number.isInteger(parsedDays) || parsedDays < 3 || parsedDays > 60;

        const handleExecute = () => {
          setInteracted(true);
          if (isInvalid) return;
          const entry = executeMutation("extendTrialPeriod", {
            accountId: props.accountId,
            extensionDays: parsedDays,
            note,
          });
          setLastAudit(entry);
        };

        return (
          <div
            className="rounded-lg border border-cyan-500/35 bg-slate-900/80 p-4 space-y-3"
            data-testid="extend-trial-card"
          >
            <div className="flex items-center justify-between">
              <span className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                MUTATION CARD · EXTEND TRIAL WINDOW
              </span>
              <span className="font-mono text-xs text-slate-400">
                {props.accountId}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-100">
                Extend Trial: {account?.companyName ?? props.accountId}
              </h4>
              <p className="text-xs text-slate-400">
                Current Trial Remaining:{" "}
                <strong className="font-mono text-cyan-300">
                  {account?.trialDaysRemaining ?? 0} days
                </strong>{" "}
                · Pipeline MRR:{" "}
                <strong className="font-mono text-slate-200">
                  {formatUsdCents(account?.mrrCents ?? 0)}
                </strong>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label
                  htmlFor={`trial-days-${hintId}`}
                  className="block font-medium text-slate-200"
                >
                  Extension Window (Days)
                </label>
                <span id={hintId} className="field-hint">
                  Guardrailed policy allows 3 to 60 days per extension
                </span>
                <input
                  id={`trial-days-${hintId}`}
                  type="number"
                  min={3}
                  max={60}
                  required
                  value={days}
                  aria-describedby={hintId}
                  aria-invalid={interacted && isInvalid ? "true" : "false"}
                  onBlur={() => setInteracted(true)}
                  onChange={(e) => setDays(e.target.value)}
                  className={`mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 ${
                    interacted && isInvalid ? "user-invalid-fallback" : ""
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium text-slate-200">
                  Onboarding Milestone Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>
            </div>

            {lastAudit && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-200">
                ✓ Executed: {lastAudit.summary}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleExecute}
                data-testid="execute-trial-btn"
                className="rounded bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition"
              >
                Extend Trial (+{Number.isFinite(parsedDays) ? parsedDays : 0} Days)
              </button>
            </div>
          </div>
        );
      },

      RetryWebhookCard: ({ props }) => {
        const { get } = useStateStore();
        const executeMutation = useFinOpsMutation();
        const [gateway, setGateway] = useState<string>(props.routeGateway);
        const [lastAudit, setLastAudit] = useState<FinOpsAuditEntry | null>(null);

        const webhooks =
          (get("/ledger/webhooks") as WebhookEventRecord[] | undefined) ?? [];
        const wh = webhooks.find((w) => w.id === props.webhookId);

        const handleExecute = () => {
          const entry = executeMutation("retryFailedWebhook", {
            webhookId: props.webhookId,
            routeGateway: gateway,
            idempotencyKey: props.idempotencyKey,
          });
          setLastAudit(entry);
        };

        return (
          <div
            className="rounded-lg border border-indigo-500/35 bg-slate-900/80 p-4 space-y-3"
            data-testid="retry-webhook-card"
          >
            <div className="flex items-center justify-between">
              <span className="rounded border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-300">
                MUTATION CARD · RETRY FAILED WEBHOOK
              </span>
              <span className="font-mono text-xs text-slate-400">
                {props.webhookId}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-100">
                Replay Gateway Charge:{" "}
                {wh?.companyName ?? props.accountId}
              </h4>
              <p className="text-xs text-slate-400">
                Status:{" "}
                <strong className="font-mono text-rose-300">
                  {wh?.status ?? "FAILED"}
                </strong>{" "}
                · Invoice:{" "}
                <strong className="font-mono text-slate-200">
                  {props.invoiceId} ({formatUsdCents(wh?.amountCents ?? 0)})
                </strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block font-medium text-slate-200">
                  Payment Routing Gateway
                </label>
                <select
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="STRIPE_EU_FALLBACK">STRIPE_EU_FALLBACK</option>
                  <option value="STRIPE_PRIMARY">STRIPE_PRIMARY</option>
                  <option value="ADYEN_BACKUP_MID">ADYEN_BACKUP_MID</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-200">
                  Idempotency Key
                </label>
                <input
                  type="text"
                  readOnly
                  value={props.idempotencyKey}
                  className="mt-1 w-full rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 font-mono text-xs text-slate-400"
                />
              </div>
            </div>

            {lastAudit && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-200">
                ✓ Executed: {lastAudit.summary}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleExecute}
                data-testid="execute-webhook-btn"
                className="rounded bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 transition"
              >
                Replay & Settle Charge ↻
              </button>
            </div>
          </div>
        );
      },

      RetentionDiscountCard: ({ props }) => {
        const { get } = useStateStore();
        const executeMutation = useFinOpsMutation();
        const hintId = useId();
        const [discount, setDiscount] = useState(String(props.discountPercent));
        const [months, setMonths] = useState(String(props.durationMonths));
        const [justification, setJustification] = useState(props.justification);
        const [interacted, setInteracted] = useState(false);
        const [lastAudit, setLastAudit] = useState<FinOpsAuditEntry | null>(null);

        const accounts =
          (get("/ledger/accounts") as CustomerAccount[] | undefined) ?? [];
        const account = accounts.find((a) => a.id === props.accountId);

        const parsedDiscount = Number(discount);
        const isInvalid =
          !Number.isFinite(parsedDiscount) ||
          parsedDiscount < 5 ||
          parsedDiscount > 50;

        const handleExecute = () => {
          setInteracted(true);
          if (isInvalid) return;
          const entry = executeMutation("applyRetentionDiscount", {
            accountId: props.accountId,
            discountPercent: parsedDiscount,
            durationMonths: Number(months) || 6,
            justification,
          });
          setLastAudit(entry);
        };

        return (
          <div
            className="rounded-lg border border-emerald-500/35 bg-slate-900/80 p-4 space-y-3"
            data-testid="retention-discount-card"
          >
            <div className="flex items-center justify-between">
              <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                MUTATION CARD · RETENTION DISCOUNT OFFER
              </span>
              <span className="font-mono text-xs text-slate-400">
                {props.accountId}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-100">
                Apply Save Discount:{" "}
                {account?.companyName ?? props.accountId}
              </h4>
              <p className="text-xs text-slate-400">
                Current MRR:{" "}
                <strong className="font-mono text-slate-200">
                  {formatUsdCents(account?.mrrCents ?? 0)}
                </strong>{" "}
                · Active Discount:{" "}
                <strong className="font-mono text-emerald-300">
                  {account?.discountPercent ?? 0}%
                </strong>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={`disc-pct-${hintId}`}
                    className="block font-medium text-slate-200"
                  >
                    Discount Percentage (%)
                  </label>
                  <span id={hintId} className="field-hint">
                    Policy ceiling: 5% min to 50% max
                  </span>
                  <input
                    id={`disc-pct-${hintId}`}
                    type="number"
                    min={5}
                    max={50}
                    required
                    value={discount}
                    aria-describedby={hintId}
                    aria-invalid={interacted && isInvalid ? "true" : "false"}
                    onBlur={() => setInteracted(true)}
                    onChange={(e) => setDiscount(e.target.value)}
                    className={`mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 ${
                      interacted && isInvalid ? "user-invalid-fallback" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-200">
                    Duration (Months)
                  </label>
                  <span className="field-hint">1 to 12 billing cycles</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-200">
                  Executive Justification
                </label>
                <input
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>
            </div>

            {lastAudit && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-200">
                ✓ Executed: {lastAudit.summary}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleExecute}
                data-testid="execute-discount-btn"
                className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
              >
                Apply {Number.isFinite(parsedDiscount) ? parsedDiscount : 0}% Retention Discount
              </button>
            </div>
          </div>
        );
      },

      RevenueWaterfallCard: ({ props }) => {
        const { get } = useStateStore();
        const history =
          (get("/ledger/mrrHistory") as MrrHistoryPoint[] | undefined) ?? [];
        const metrics = get("/ledger/metrics") as FinOpsMetrics | undefined;
        const latest = history[history.length - 1];

        const steps = [
          {
            label: "Starting MRR",
            cents: latest?.startingMrrCents ?? 210_000_000,
            tone: "text-slate-200",
          },
          {
            label: "+ New Logo MRR",
            cents: latest?.newMrrCents ?? 14_500_000,
            tone: "text-emerald-300",
          },
          {
            label: "+ Expansion MRR",
            cents: latest?.expansionMrrCents ?? 9_800_000,
            tone: "text-emerald-300",
          },
          {
            label: "- Contraction MRR",
            cents: -(latest?.contractionMrrCents ?? 3_100_000),
            tone: "text-amber-300",
          },
          {
            label: "- Churned MRR",
            cents: -(latest?.churnedMrrCents ?? 4_400_000),
            tone: "text-rose-300",
          },
          {
            label: "= Live Net MRR",
            cents: metrics?.totalMrrCents ?? latest?.endingMrrCents ?? 226_800_000,
            tone: "text-cyan-300 font-bold",
          },
        ];

        return (
          <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-100">
                {props.title}
              </h4>
              <span className="font-mono text-xs text-slate-400">
                {props.periodLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {steps.map((s) => (
                <div
                  key={s.label}
                  className="rounded border border-slate-800 bg-slate-950/75 p-2.5"
                >
                  <span className="block text-[11px] text-slate-400">
                    {s.label}
                  </span>
                  <span className={`mt-1 block font-mono text-sm ${s.tone}`}>
                    {formatUsdCents(s.cents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      },

      AuditTrailBanner: ({ props }) => {
        const { get } = useStateStore();
        const auditLog =
          (get("/ledger/auditLog") as FinOpsAuditEntry[] | undefined) ?? [];
        const visible = auditLog.slice(0, props.maxEntries);

        return (
          <div
            className="rounded-lg border border-slate-800/90 bg-slate-950/90 p-3.5"
            data-testid="audit-trail-banner"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
                  {props.title}
                </h4>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Total Entries: {auditLog.length} (Time-Travel Undo Ready)
              </span>
            </div>

            <div className="space-y-1.5">
              {visible.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800/80 bg-slate-900/70 px-2.5 py-1.5 font-mono text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] text-cyan-300">
                      {entry.actionType}
                    </span>
                    <span className="font-sans text-slate-200">
                      {entry.summary}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span
                      className={
                        entry.mrrDeltaCents >= 0
                          ? "text-emerald-300"
                          : "text-amber-300"
                      }
                    >
                      MRR Δ:{" "}
                      {entry.mrrDeltaCents >= 0 ? "+" : ""}
                      {formatUsdCents(entry.mrrDeltaCents)}
                    </span>
                    <span className="text-slate-500">
                      {entry.timestamp.slice(11, 19)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      },

      PaymentTraceInspector: ({ props }) => (
        <PaymentTraceInspectorView props={props} />
      ),
    },

    actions: finopsActionHandlers,
  });

  const safeRegistry = wrapRegistryWithTelemetry(
    finopsVerifiedCatalog,
    rawComponentRegistry,
    {
      telemetryTracker: telemetry,
      showHealedBadges: true,
    }
  );

  return {
    rawComponentRegistry,
    safeRegistry,
    actionHandlers: finopsActionHandlers,
    handlers,
    executeAction,
  };
}
