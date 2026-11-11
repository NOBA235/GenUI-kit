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
  SafeGenUIRenderer,
  specToJsonlStream,
  StreamTelemetrySnapshot,
} from "@genui-studio/core";
import { spatialVerifiedCatalog } from "./catalog/spatial-catalog.js";
import {
  createSpatialRegistry,
  SpatialRuntimeContext,
} from "./catalog/spatial-registry.js";
import {
  ClusterSummary,
  createInitialClusterState,
  ServiceNodeData,
} from "./data/cluster-seed.js";
import {
  buildSpatialChaosPackets,
  chunkJsonlForStreaming,
  LiveLlmEndpointConfig,
  SPATIAL_SCENARIO_PRESETS,
  streamFromLiveLlmEndpoint,
  synthesizeSpatialJsonlFromPrompt,
} from "./streams/spatial-streams.js";
import {
  SpatialPatchLogItem,
  SpatialXRayDrawer,
} from "./components/SpatialXRayDrawer.js";

export interface AppProps {
  instantStreamForTest?: boolean;
}

export const App: React.FC<AppProps> = ({ instantStreamForTest = false }) => {
  // 1. Initialize Time-Travel State Store with deterministic 16-node cluster state
  const timeTravelStore = useMemo(
    () =>
      createTimeTravelStateStore(
        createInitialClusterState() as unknown as Record<string, unknown>
      ),
    []
  );

  // 2. Initialize Telemetry Tracker + Wrapped Registry
  const telemetryTracker = useMemo(() => createTelemetryTracker(), []);
  const { safeRegistry } = useMemo(
    () => createSpatialRegistry(telemetryTracker),
    [telemetryTracker]
  );

  // 3. Subscribe to store changes for Top HUD and Undo/Redo
  const [storeVersion, setStoreVersion] = useState(0);
  useEffect(() => {
    return timeTravelStore.subscribe(() => {
      setStoreVersion((v) => v + 1);
    });
  }, [timeTravelStore]);

  // 4. Subscribe to live stream telemetry
  const [telemetry, setTelemetry] = useState<StreamTelemetrySnapshot>(() =>
    telemetryTracker.getSnapshot()
  );
  useEffect(() => {
    return telemetryTracker.subscribe(() => {
      setTelemetry(telemetryTracker.getSnapshot());
    });
  }, [telemetryTracker]);

  // 5. Active Compiler & Spec state
  const compilerRef = useRef<GuardrailedStreamCompiler | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchCounterRef = useRef(0);

  const [currentSpec, setCurrentSpec] = useState<Spec | null>(null);
  const [healedDiagnostics, setHealedDiagnostics] =
    useState<HealedDiagnosticsByElement>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    SPATIAL_SCENARIO_PRESETS[0]!.id
  );
  const [promptInput, setPromptInput] = useState<string>(
    SPATIAL_SCENARIO_PRESETS[0]!.prompt
  );
  const [patchLog, setPatchLog] = useState<SpatialPatchLogItem[]>([]);
  const [isXRayOpen, setIsXRayOpen] = useState(false);

  // 6. Dual-Mode Stream Configuration
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

  const applyCompilerStep = useCallback(
    (step: GuardrailedStreamStepResult) => {
      setCurrentSpec({ ...step.spec });
      setHealedDiagnostics(step.healedDiagnostics);
    },
    []
  );

  const runGuardrailedJsonlStream = useCallback(
    (jsonlText: string) => {
      stopActiveTimer();
      setStreamError(null);

      const compiler = createGuardrailedStreamCompiler({
        catalog: spatialVerifiedCatalog,
        telemetryTracker,
      });
      compilerRef.current = compiler;
      setPatchLog([]);

      if (instantStreamForTest) {
        const lines = jsonlText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const logItems: SpatialPatchLogItem[] = lines.map((rawLine) => ({
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
    [applyCompilerStep, instantStreamForTest, telemetryTracker]
  );

  useEffect(() => {
    const initialPreset = SPATIAL_SCENARIO_PRESETS[0]!;
    const jsonl = specToJsonlStream(initialPreset.buildSpec());
    runGuardrailedJsonlStream(jsonl);
    return () => stopActiveTimer();
  }, [runGuardrailedJsonlStream]);

  const handleSelectScenario = (scenarioId: string) => {
    const preset = SPATIAL_SCENARIO_PRESETS.find((s) => s.id === scenarioId);
    if (!preset) return;
    setActiveScenarioId(preset.id);
    setPromptInput(preset.prompt);
    const jsonl = specToJsonlStream(preset.buildSpec());
    runGuardrailedJsonlStream(jsonl);
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    if (streamMode === "LIVE_API" && liveConfig.apiKey.trim().length > 0) {
      stopActiveTimer();
      setStreamError(null);
      setIsStreaming(true);
      setPatchLog([]);
      const compiler = createGuardrailedStreamCompiler({
        catalog: spatialVerifiedCatalog,
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

    const synthesizedJsonl = synthesizeSpatialJsonlFromPrompt(promptInput);
    runGuardrailedJsonlStream(synthesizedJsonl);
  };

  const handleInjectChaosPacket = useCallback(() => {
    stopActiveTimer();
    setIsStreaming(false);

    let compiler = compilerRef.current;
    if (!compiler) {
      compiler = createGuardrailedStreamCompiler({
        catalog: spatialVerifiedCatalog,
        telemetryTracker,
      });
      compilerRef.current = compiler;
    }

    const rootKey = currentSpec?.root || "warroom-shell-root";
    const chaosLines = buildSpatialChaosPackets(rootKey);
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
  }, [applyCompilerStep, currentSpec?.root, telemetryTracker]);

  const handleSimulateChaosSpike = () => {
    const services = {
      ...((timeTravelStore.get("/cluster/services") as Record<string, ServiceNodeData>) ?? {}),
    };
    const target = services["srv-api-gateway"];
    if (target) {
      target.rps += 12000;
      target.errorRatePercent = Math.min(100, target.errorRatePercent + 15);
      target.cpuSaturationPercent = Math.min(100, target.cpuSaturationPercent + 12);
      target.status = "CRITICAL_OUTAGE";
    }
    timeTravelStore.update({
      "/cluster/services": services,
    });
  };

  const summary = timeTravelStore.get("/cluster/summary") as
    | ClusterSummary
    | undefined;
  const snapshots = timeTravelStore.getHistory();
  const canUndo = timeTravelStore.canUndo();
  const canRedo = timeTravelStore.canRedo();

  return (
    <div
      className="min-h-screen bg-[#04060E] text-slate-100 flex flex-col font-sans"
      data-store-version={storeVersion}
    >
      {/* Top SRE Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4 px-5 py-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 font-mono text-sm font-bold text-cyan-300 shadow-inner">
              3D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-100">
                  Aegis 3D · Spatial Infrastructure War-Room
                </h1>
                <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                  @json-render/react-three-fiber
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400">
                14 Spatial Components · 16 Cluster Nodes · Dual-Viewport WebGL
              </p>
            </div>
          </div>

          {/* Quick App Switcher Navigation */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 font-mono text-xs">
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              title="Launch App 1: RevOps / FinOps Generative Command Center"
              className="rounded px-2.5 py-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition flex items-center gap-1"
            >
              App 1: FinOps Command ↗
            </a>
            <span className="rounded bg-cyan-500/20 px-2.5 py-1 font-semibold text-cyan-200 border border-cyan-500/40">
              App 2: Spatial War-Room (Active)
            </span>
          </div>

          {/* Cluster Telemetry Pill Strip */}
          <div className="hidden xl:flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/75 px-3.5 py-1.5 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">SEVERITY</span>
              <span
                className={`font-semibold ${
                  summary?.severity === "SEV-1" || summary?.severity === "SEV-0"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
                data-testid="header-cluster-severity"
              >
                {summary?.severity ?? "SEV-1"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block">GLOBAL ERROR RATE</span>
              <span
                className="font-semibold text-rose-300 tabular-nums"
                data-testid="header-global-error-rate"
              >
                {summary?.globalErrorRatePercent ?? 14.8}%
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block">THROUGHPUT</span>
              <span className="font-semibold text-slate-100 tabular-nums">
                {(summary?.globalRps ?? 68400).toLocaleString()} RPS
              </span>
            </div>
          </div>

          {/* Time-Travel Undo/Redo + Chaos + X-Ray */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 font-mono text-xs">
              <button
                type="button"
                disabled={!canUndo}
                onClick={() => timeTravelStore.undo()}
                data-testid="spatial-time-travel-undo-btn"
                title="Undo SRE mutation"
                className="rounded px-2.5 py-1 text-slate-200 hover:bg-slate-800 disabled:opacity-35 transition"
              >
                ↶ Undo
              </button>
              <span
                className="px-2 text-[11px] text-slate-400"
                data-testid="spatial-snapshot-count"
              >
                v{snapshots.length}
              </span>
              <button
                type="button"
                disabled={!canRedo}
                onClick={() => timeTravelStore.redo()}
                data-testid="spatial-time-travel-redo-btn"
                title="Redo SRE mutation"
                className="rounded px-2.5 py-1 text-slate-200 hover:bg-slate-800 disabled:opacity-35 transition"
              >
                ↷ Redo
              </button>
            </div>

            <button
              type="button"
              onClick={handleInjectChaosPacket}
              data-testid="header-inject-spatial-chaos-btn"
              className="rounded-lg border border-rose-500/45 bg-rose-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-rose-200 hover:bg-rose-500/25 transition"
            >
              ⚡ Inject Cascading Outage
            </button>

            <button
              type="button"
              onClick={() => setIsXRayOpen(true)}
              data-testid="open-spatial-xray-btn"
              className="rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 font-mono text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition"
            >
              🔬 Spatial X-Ray ({telemetry.patchCount} patches)
            </button>
          </div>
        </div>
      </header>

      {/* Operational Incident Bar & Scenario Triggers */}
      <section className="border-b border-slate-800/80 bg-slate-900/45">
        <div className="mx-auto max-w-[1680px] px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Incident Scenarios:
              </span>
              {SPATIAL_SCENARIO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectScenario(preset.id)}
                  data-testid={`spatial-scenario-${preset.id}`}
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
                onClick={handleSimulateChaosSpike}
                data-testid="simulate-traffic-spike-btn"
                className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-200 hover:bg-amber-500/20 transition"
              >
                + Simulate Ingress Traffic Surge
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

          {showApiConfig && (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-200">
                    Streaming Provider Configuration
                  </span>
                  <p className="text-slate-400">
                    Switch between Recorded Judge Replay and Live OpenAI-Compatible
                    SSE Streaming via <code>spatialVerifiedCatalog.prompt()</code>.
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
                  placeholder="sk-... (Optional)"
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                />
              </div>
            </div>
          )}

          {/* SRE Operational Intent Bar */}
          <form onSubmit={handlePromptSubmit} className="flex gap-2">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              aria-label="SRE incident intent prompt"
              placeholder="Type an SRE intent (e.g. 'Isolate the failing PostgreSQL node and prepare cross-region failover')..."
              className="flex-1 rounded-lg border border-slate-700/90 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              data-testid="spatial-prompt-submit-btn"
              className="rounded-lg bg-cyan-500 px-4 py-2 font-mono text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition shrink-0"
            >
              {isStreaming ? "Streaming Spatial Spec..." : "Stream War-Room ↵"}
            </button>
          </form>

          {streamError && (
            <div className="rounded border border-rose-500/40 bg-rose-950/30 px-3 py-2 font-mono text-xs text-rose-200">
              Stream Error: {streamError}
            </div>
          )}
        </div>
      </section>

      {/* Main Dual-Viewport Workspace Surface */}
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-5 py-6">
        <SpatialRuntimeContext.Provider value={{ timeTravelStore }}>
          <JSONUIProvider registry={safeRegistry} store={timeTravelStore}>
            <SafeGenUIRenderer
              spec={currentSpec}
              registry={safeRegistry}
              catalog={spatialVerifiedCatalog}
              loading={isStreaming}
              telemetryTracker={telemetryTracker}
              healedDiagnostics={healedDiagnostics}
            />
          </JSONUIProvider>
        </SpatialRuntimeContext.Provider>
      </main>

      {/* Spatial Spec & Telemetry X-Ray Drawer */}
      <SpatialXRayDrawer
        isOpen={isXRayOpen}
        onClose={() => setIsXRayOpen(false)}
        telemetry={telemetry}
        patchLog={patchLog}
        currentSpec={currentSpec}
        onInjectChaosPacket={handleInjectChaosPacket}
      />
    </div>
  );
};
