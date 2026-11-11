import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { JSONUIProvider } from "@json-render/react";
import type { Spec } from "@json-render/core";
import {
  createGuardrailedStreamCompiler,
  createTelemetryTracker,
  createTimeTravelStateStore,
  GuardrailedStreamCompiler,
  GuardrailedStreamStepResult,
  HealedDiagnosticsByElement,
  specToJsonlStream,
  StreamTelemetrySnapshot,
  TemplateExportModal,
} from "@genui-studio/core";
import { finopsVerifiedCatalog } from "./catalog/finops-catalog.js";
import {
  createFinOpsRegistry,
  FinOpsRuntimeContext,
} from "./catalog/finops-registry.js";
import {
  createInitialFinOpsState,
  FinOpsMetrics,
  formatUsdCents,
  WebhookEventRecord,
} from "./data/ledger-seed.js";
import {
  buildCorruptedChaosPackets,
  chunkJsonlForStreaming,
  FINOPS_SCENARIO_PRESETS,
  LiveLlmEndpointConfig,
  streamFromLiveLlmEndpoint,
  synthesizeFinOpsJsonlFromPrompt,
} from "./streams/finops-streams.js";
import { XRayDrawer, XRayPatchLogItem } from "./components/XRayDrawer.js";
import { SafeGenUIRenderer } from "@genui-studio/core";

export interface AppProps {
  /**
   * When true (used in unit/integration tests), streams synchronously without animation frame delays
   * so tests can assert on the final rendered DOM immediately.
   */
  instantStreamForTest?: boolean;
}

export const App: React.FC<AppProps> = ({ instantStreamForTest = false }) => {
  // 1. Initialize Time-Travel State Store with deterministic 240-account SaaS ledger
  const timeTravelStore = useMemo(
    () =>
      createTimeTravelStateStore(
        createInitialFinOpsState() as unknown as Record<string, unknown>
      ),
    []
  );

  // 2. Initialize Telemetry Tracker + Telemetry-Wrapped Component Registry
  const telemetryTracker = useMemo(() => createTelemetryTracker(), []);
  const { safeRegistry } = useMemo(
    () => createFinOpsRegistry(telemetryTracker),
    [telemetryTracker]
  );

  // 3. Subscribe to live store state for top bar metrics & Time-Travel Undo/Redo controls
  const [storeVersion, setStoreVersion] = useState(0);
  useEffect(() => {
    return timeTravelStore.subscribe(() => {
      setStoreVersion((v) => v + 1);
    });
  }, [timeTravelStore]);

  // 4. Subscribe to live telemetry snapshot
  const [telemetry, setTelemetry] = useState<StreamTelemetrySnapshot>(() =>
    telemetryTracker.getSnapshot()
  );
  useEffect(() => {
    return telemetryTracker.subscribe(() => {
      setTelemetry(telemetryTracker.getSnapshot());
    });
  }, [telemetryTracker]);

  // 5. Active GuardrailedStreamCompiler & Spec state
  const compilerRef = useRef<GuardrailedStreamCompiler | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchCounterRef = useRef(0);

  const [currentSpec, setCurrentSpec] = useState<Spec | null>(null);
  const [healedDiagnostics, setHealedDiagnostics] =
    useState<HealedDiagnosticsByElement>({});

  /** Commits a compiler step: render-safe Spec + per-element healing provenance */
  const applyCompilerStep = useCallback(
    (step: GuardrailedStreamStepResult) => {
      setCurrentSpec({ ...step.spec });
      setHealedDiagnostics(step.healedDiagnostics);
    },
    []
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    FINOPS_SCENARIO_PRESETS[0]!.id
  );
  const [promptInput, setPromptInput] = useState<string>(
    FINOPS_SCENARIO_PRESETS[0]!.prompt
  );
  const [patchLog, setPatchLog] = useState<XRayPatchLogItem[]>([]);
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // 6. Dual-Mode Stream Engine state (Recorded Judge Mode vs Live OpenAI-compatible SSE)
  const [streamMode, setStreamMode] = useState<"RECORDED_JUDGE" | "LIVE_API">(
    "RECORDED_JUDGE"
  );
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [liveConfig, setLiveConfig] = useState<LiveLlmEndpointConfig>({
    endpointUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [streamError, setStreamError] = useState<string | null>(null);

  const stopActiveTimer = () => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  };

  /**
   * Streams raw RFC 6902 JSONL text chunk-by-chunk through GuardrailedStreamCompiler
   */
  const runGuardrailedJsonlStream = useCallback(
    (jsonlText: string) => {
      stopActiveTimer();
      setStreamError(null);

      const compiler = createGuardrailedStreamCompiler({
        catalog: finopsVerifiedCatalog,
        telemetryTracker,
      });
      compilerRef.current = compiler;
      setPatchLog([]);

      if (instantStreamForTest) {
        const lines = jsonlText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const logItems: XRayPatchLogItem[] = lines.map((rawLine) => ({
          id: ++patchCounterRef.current,
          rawLine,
          timestamp: new Date().toISOString().slice(11, 23),
        }));
        compiler.push(jsonlText);
        const finalized = compiler.finalize();
        setPatchLog(logItems);
        applyCompilerStep(finalized);
        setIsStreaming(false);
        return;
      }

      const chunks = chunkJsonlForStreaming(jsonlText, 14);
      setIsStreaming(true);
      let idx = 0;

      const pushNextChunk = () => {
        if (idx >= chunks.length) {
          const finalized = compiler.finalize();
          applyCompilerStep(finalized);
          setIsStreaming(false);
          return;
        }
        const chunk = chunks[idx++]!;
        const step = compiler.push(chunk);
        const rawLines = chunk
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        setPatchLog((prev) => [
          ...rawLines.map((rawLine) => ({
            id: ++patchCounterRef.current,
            rawLine,
            timestamp: new Date().toISOString().slice(11, 23),
          })),
          ...prev,
        ]);
        applyCompilerStep(step);

        streamTimerRef.current = setTimeout(pushNextChunk, 28);
      };

      pushNextChunk();
    },
    [instantStreamForTest, telemetryTracker]
  );

  // Boot initial scenario on mount
  useEffect(() => {
    const initialPreset = FINOPS_SCENARIO_PRESETS[0]!;
    const jsonl = specToJsonlStream(initialPreset.buildSpec());
    runGuardrailedJsonlStream(jsonl);
    return () => stopActiveTimer();
  }, [runGuardrailedJsonlStream]);

  // Select a preset scenario
  const handleSelectScenario = (scenarioId: string) => {
    const preset = FINOPS_SCENARIO_PRESETS.find((s) => s.id === scenarioId);
    if (!preset) return;
    setActiveScenarioId(preset.id);
    setPromptInput(preset.prompt);
    const jsonl = specToJsonlStream(preset.buildSpec());
    runGuardrailedJsonlStream(jsonl);
  };

  // Submit custom natural language intent
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    if (streamMode === "LIVE_API" && liveConfig.apiKey.trim().length > 0) {
      stopActiveTimer();
      setStreamError(null);
      setIsStreaming(true);
      setPatchLog([]);
      const compiler = createGuardrailedStreamCompiler({
        catalog: finopsVerifiedCatalog,
        telemetryTracker,
      });
      compilerRef.current = compiler;

      try {
        await streamFromLiveLlmEndpoint(
          promptInput,
          liveConfig,
          (chunk) => {
            const step = compiler.push(chunk);
            applyCompilerStep(step);
            const lines = chunk
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
            if (lines.length > 0) {
              setPatchLog((prev) => [
                ...lines.map((rawLine) => ({
                  id: ++patchCounterRef.current,
                  rawLine,
                  timestamp: new Date().toISOString().slice(11, 23),
                })),
                ...prev,
              ]);
            }
          }
        );
        const finalized = compiler.finalize();
        applyCompilerStep(finalized);
      } catch (err) {
        setStreamError(
          err instanceof Error ? err.message : "Live API streaming failed"
        );
      } finally {
        setIsStreaming(false);
      }
      return;
    }

    // Deterministic Recorded / Synthesized Stream Mode
    const synthesizedJsonl = synthesizeFinOpsJsonlFromPrompt(promptInput);
    runGuardrailedJsonlStream(synthesizedJsonl);
  };

  /**
   * Injects the Hostile / Corrupted AI Packet Batch directly into the active GuardrailedStreamCompiler
   * to visually prove prop healing, cycle severance, prototype-pollution blocking, and node fault isolation.
   */
  const handleInjectChaosPacket = useCallback(() => {
    stopActiveTimer();
    setIsStreaming(false);

    let compiler = compilerRef.current;
    if (!compiler) {
      compiler = createGuardrailedStreamCompiler({
        catalog: finopsVerifiedCatalog,
        telemetryTracker,
      });
      compilerRef.current = compiler;
    }

    const rootKey = currentSpec?.root || "root-shell";
    const chaosLines = buildCorruptedChaosPackets(rootKey);
    const chaosPayload = chaosLines.join("\n") + "\n";

    const result = compiler.push(chaosPayload);
    applyCompilerStep(result);
    setPatchLog((prev) => [
      ...chaosLines.map((rawLine) => ({
        id: ++patchCounterRef.current,
        rawLine,
        timestamp: new Date().toISOString().slice(11, 23),
        isChaos: true,
      })),
      ...prev,
    ]);
  }, [currentSpec?.root, telemetryTracker]);

  /**
   * Simulates a live incoming Stripe webhook failure event in the ledger store
   */
  const handleSimulateWebhookArrival = () => {
    const webhooks = [
      ...((timeTravelStore.get("/ledger/webhooks") as WebhookEventRecord[]) ??
        []),
    ];
    const metrics = {
      ...((timeTravelStore.get("/ledger/metrics") as FinOpsMetrics) ?? {}),
    };
    const newWhId = `wh_${3000 + webhooks.length + 1}`;
    const newEvent: WebhookEventRecord = {
      id: newWhId,
      eventType: "invoice.payment_failed",
      accountId: "acct_1004",
      companyName: "Vanguard Cloud Systems",
      invoiceId: `in_${9100 + webhooks.length}`,
      amountCents: 320_000,
      status: "FAILED",
      failureReason: "card_declined: authentication_required (3DS2 timeout)",
      attemptCount: 1,
      createdAt: new Date().toISOString(),
    };
    webhooks.unshift(newEvent);
    metrics.failedChargesTotal = (metrics.failedChargesTotal ?? 0) + 1;
    metrics.disputedCents = (metrics.disputedCents ?? 0) + 320_000;
    timeTravelStore.update({
      "/ledger/webhooks": webhooks,
      "/ledger/metrics": metrics,
    });
  };

  const metrics = timeTravelStore.get("/ledger/metrics") as
    | FinOpsMetrics
    | undefined;
  const snapshots = timeTravelStore.getHistory();
  const canUndo = timeTravelStore.canUndo();
  const canRedo = timeTravelStore.canRedo();

  return (
    <div
      className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col"
      data-store-version={storeVersion}
    >
      {/* Top Executive Telemetry & Verification Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-3">
          {/* Brand & Architecture Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 font-mono text-sm font-bold text-cyan-300 shadow-inner">
              G∑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-100">
                  GenUI Studio · FinOps Command Center
                </h1>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  @genui-studio/core
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400">
                14 Zod Components · 240 Seeded Accounts · RFC 6902 JSONL Stream
              </p>
            </div>
          </div>

          {/* Quick App Switcher Navigation & Template Export */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 font-mono text-xs">
              <span className="rounded bg-cyan-500/20 px-2.5 py-1 font-semibold text-cyan-200 border border-cyan-500/40">
                App 1: FinOps (Active)
              </span>
              <a
                href="http://localhost:5174"
                target="_blank"
                rel="noreferrer"
                title="Launch App 2: Aegis Spatial Ops & 3D WebGL Incident Command Center"
                className="rounded px-2.5 py-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition flex items-center gap-1"
              >
                App 2: Spatial War-Room 3D ↗
              </a>
            </div>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              title="Export Agent-Ready Template Pack (.zip, npx CLI, MCP)"
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1 font-mono text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition cursor-pointer shadow-sm shadow-purple-950/50"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              Export Template 📦
            </button>
          </div>

          {/* Live Ledger KPI Pill Strip */}
          <div className="hidden xl:flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/75 px-3.5 py-1.5 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">
                LIVE NET MRR
              </span>
              <span
                className="font-semibold text-emerald-300 tabular-nums"
                data-testid="header-live-mrr"
              >
                {formatUsdCents(metrics?.totalMrrCents ?? 0)}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block">
                UNSETTLED / DISPUTED
              </span>
              <span
                className="font-semibold text-rose-300 tabular-nums"
                data-testid="header-disputed-balance"
              >
                {formatUsdCents(metrics?.disputedCents ?? 0)}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block">
                FAILED CHARGES
              </span>
              <span
                className="font-semibold text-amber-300 tabular-nums"
                data-testid="header-failed-charges"
              >
                {metrics?.failedChargesTotal ?? 0}
              </span>
            </div>
          </div>

          {/* Time-Travel Undo/Redo + Chaos Injection + X-Ray Drawer Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Time-Travel Undo / Redo */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 font-mono text-xs">
              <button
                type="button"
                disabled={!canUndo}
                onClick={() => timeTravelStore.undo()}
                data-testid="time-travel-undo-btn"
                title="Undo last ledger mutation (TimeTravelStateStore)"
                className="rounded px-2.5 py-1 text-slate-200 hover:bg-slate-800 disabled:opacity-35 transition"
              >
                ↶ Undo
              </button>
              <span
                className="px-2 text-[11px] text-slate-400"
                data-testid="time-travel-snapshot-count"
              >
                v{snapshots.length}
              </span>
              <button
                type="button"
                disabled={!canRedo}
                onClick={() => timeTravelStore.redo()}
                data-testid="time-travel-redo-btn"
                title="Redo ledger mutation (TimeTravelStateStore)"
                className="rounded px-2.5 py-1 text-slate-200 hover:bg-slate-800 disabled:opacity-35 transition"
              >
                ↷ Redo
              </button>
            </div>

            {/* Quick Chaos Packet Injection Button */}
            <button
              type="button"
              onClick={handleInjectChaosPacket}
              data-testid="header-inject-chaos-btn"
              className="rounded-lg border border-rose-500/45 bg-rose-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-rose-200 hover:bg-rose-500/25 transition"
            >
              ⚡ Inject Corrupted AI Packet
            </button>

            {/* Open Spec & Telemetry X-Ray Drawer */}
            <button
              type="button"
              onClick={() => setIsXRayOpen(true)}
              data-testid="open-xray-drawer-btn"
              className="rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 font-mono text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition"
            >
              🔬 Spec & Telemetry X-Ray ({telemetry.patchCount} patches)
            </button>
          </div>
        </div>
      </header>

      {/* Operational Intent Command Bar & Scenario Switcher */}
      <section className="border-b border-slate-800/80 bg-slate-900/45">
        <div className="mx-auto max-w-[1600px] px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Operational Playbooks:
              </span>
              {FINOPS_SCENARIO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectScenario(preset.id)}
                  data-testid={`scenario-btn-${preset.id}`}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    activeScenarioId === preset.id
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
                      : "border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>{preset.title}</span>
                  <span className="ml-1.5 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateWebhookArrival}
                data-testid="simulate-webhook-btn"
                className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-200 hover:bg-amber-500/20 transition"
              >
                + Simulate Failed Stripe Webhook
              </button>

              <button
                type="button"
                onClick={() => setShowApiConfig((s) => !s)}
                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                {streamMode === "LIVE_API"
                  ? "🟢 Mode: Live LLM SSE"
                  : "🔵 Mode: Recorded Judge Replay"}
              </button>
            </div>
          </div>

          {/* Optional Live LLM API Configuration Panel */}
          {showApiConfig && (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-200">
                    Streaming Provider Configuration
                  </span>
                  <p className="text-slate-400">
                    Switch between zero-friction Recorded Judge Replay and Live
                    OpenAI-Compatible SSE Streaming using{" "}
                    <code>finopsVerifiedCatalog.prompt()</code>.
                  </p>
                </div>
                <div className="flex gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() => setStreamMode("RECORDED_JUDGE")}
                    className={`rounded px-2.5 py-1 ${
                      streamMode === "RECORDED_JUDGE"
                        ? "bg-cyan-500 text-slate-950 font-semibold"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Recorded Judge Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamMode("LIVE_API")}
                    className={`rounded px-2.5 py-1 ${
                      streamMode === "LIVE_API"
                        ? "bg-emerald-500 text-slate-950 font-semibold"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Live LLM Endpoint
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="url"
                  value={liveConfig.endpointUrl}
                  onChange={(e) =>
                    setLiveConfig({ ...liveConfig, endpointUrl: e.target.value })
                  }
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                />
                <input
                  type="text"
                  value={liveConfig.model}
                  onChange={(e) =>
                    setLiveConfig({ ...liveConfig, model: e.target.value })
                  }
                  placeholder="gpt-4o-mini"
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                />
                <input
                  type="password"
                  value={liveConfig.apiKey}
                  onChange={(e) =>
                    setLiveConfig({ ...liveConfig, apiKey: e.target.value })
                  }
                  placeholder="sk-... (Optional: leave blank for Judge Mode)"
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Natural Language Intent Bar */}
          <form onSubmit={handlePromptSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                aria-label="Operational FinOps intent prompt"
                placeholder="Type an operational FinOps intent (e.g., 'Isolate failed Stripe charges and prepare a refund for acct_1001')..."
                className="w-full rounded-lg border border-slate-700/90 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              data-testid="stream-intent-submit-btn"
              className="rounded-lg bg-cyan-500 px-4 py-2 font-mono text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition shrink-0"
            >
              {isStreaming ? "Streaming JSONL..." : "Stream Workspace ↵"}
            </button>
          </form>

          {streamError && (
            <div className="rounded border border-rose-500/40 bg-rose-950/30 px-3 py-2 font-mono text-xs text-rose-200">
              Stream Error: {streamError}
            </div>
          )}
        </div>
      </section>

      {/* Main Generative UI Workspace Surface */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-6">
        <FinOpsRuntimeContext.Provider value={{ timeTravelStore }}>
          <JSONUIProvider registry={safeRegistry} store={timeTravelStore}>
            <SafeGenUIRenderer
              spec={currentSpec}
              registry={safeRegistry}
              catalog={finopsVerifiedCatalog}
              loading={isStreaming}
              telemetryTracker={telemetryTracker}
              healedDiagnostics={healedDiagnostics}
            />
          </JSONUIProvider>
        </FinOpsRuntimeContext.Provider>
      </main>

      {/* Spec & Telemetry X-Ray Drawer */}
      <XRayDrawer
        isOpen={isXRayOpen}
        onClose={() => setIsXRayOpen(false)}
        telemetry={telemetry}
        patchLog={patchLog}
        currentSpec={currentSpec}
        onInjectChaosPacket={handleInjectChaosPacket}
      />

      {/* Commercial Template Pack Exporter Modal */}
      <TemplateExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        packId="finops-command-pro"
      />
    </div>
  );
};
