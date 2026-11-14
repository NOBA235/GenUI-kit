import React, {
  useCallback,
  useEffect,
  useId,
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
  TemplateExportModal,
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
  SreAuditEntry,
} from "./data/cluster-seed.js";
import {
  applyOtlpSnapshotToStore,
  buildDynamicOtlpSpec,
  createEmptyOtlpClusterState,
  LiveOtlpCollectorClient,
  liveMeshSimulator,
  telemetryBridge,
  type DynamicTopologySnapshot,
  type OtlpConnectionStatus,
} from "./telemetry/index.js";
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
  initialSourceMode?: "otlp" | "demo";
  otlpCollectorUrl?: string;
}

const copyTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
let lastCopyAnnouncement = "";

function legacyExecCommandCopy(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

function reportCopyOutcome(button: HTMLElement, ok: boolean): void {
  const tip = button.nextElementSibling;
  const existing = copyTimers.get(button);
  if (existing) clearTimeout(existing);

  button.removeAttribute("data-copied");
  button.removeAttribute("data-failed");

  let message = ok ? "Copied" : "Copy failed";
  if (message === lastCopyAnnouncement) {
    message += "\u00A0";
  }
  lastCopyAnnouncement = message;

  if (tip) tip.textContent = "";
  void button.offsetWidth;
  button.setAttribute(ok ? "data-copied" : "data-failed", "");

  if (tip) {
    requestAnimationFrame(() => {
      tip.textContent = message;
    });
  }

  copyTimers.set(
    button,
    setTimeout(() => {
      button.removeAttribute("data-copied");
      button.removeAttribute("data-failed");
      if (tip) tip.textContent = "";
    }, 2000)
  );
}

async function copyFromTargetElement(
  button: HTMLElement,
  target: HTMLElement
): Promise<void> {
  const text =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.value.trim()
      : (target.innerText || target.textContent || "").trim();
  if (!text) return;

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(text);
    reportCopyOutcome(button, true);
  } catch {
    if (legacyExecCommandCopy(text)) {
      reportCopyOutcome(button, true);
    } else {
      reportCopyOutcome(button, false);
    }
  }
}

function resolveDefaultCollectorUrl(explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  if (typeof window !== "undefined") {
    // In Vite dev (:5174), route through same-origin Vite proxy -> 127.0.0.1:4318
    if (window.location.port === "5174") {
      return window.location.origin;
    }
  }
  return "http://127.0.0.1:4318";
}

function resolveInitialSourceMode(
  explicit?: "otlp" | "demo"
): "otlp" | "demo" {
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    const param = new URLSearchParams(window.location.search).get("demo");
    if (param === "1" || param === "true") {
      return "demo";
    }
  }
  return "otlp";
}

const EMPTY_OTLP_SNAPSHOT: DynamicTopologySnapshot = {
  mode: "WAITING",
  totalIngestedSpans: 0,
  totalIngestedTraces: 0,
  totalIngestedLogs: 0,
  totalIngestedMetrics: 0,
  lastIngestedAt: null,
  services: {},
  edges: [],
  summary: createEmptyOtlpClusterState().cluster.summary,
  recentTraces: [],
  logs: [],
  bottleneckServiceId: null,
  bottleneckTraceId: null,
  criticalPathServiceIds: [],
};

export const App: React.FC<AppProps> = ({
  instantStreamForTest = false,
  initialSourceMode,
  otlpCollectorUrl,
}) => {
  const [dataSourceMode, setDataSourceMode] = useState<"otlp" | "demo">(() =>
    resolveInitialSourceMode(initialSourceMode)
  );

  const effectiveCollectorUrl = useMemo(
    () => resolveDefaultCollectorUrl(otlpCollectorUrl),
    [otlpCollectorUrl]
  );

  // 1. Initialize Time-Travel State Store cleanly (empty OTLP standby by default; seeded only in explicit demo mode)
  const timeTravelStore = useMemo(
    () =>
      createTimeTravelStateStore(
        (resolveInitialSourceMode(initialSourceMode) === "demo"
          ? createInitialClusterState()
          : createEmptyOtlpClusterState()) as unknown as Record<string, unknown>
      ),
    [initialSourceMode]
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
  const otlpClientRef = useRef<LiveOtlpCollectorClient | null>(null);
  const otlpSnippetId = useId();
  const filterSearchId = useId();
  const filterTierId = useId();
  const filterStatusId = useId();

  const [otlpFilters, setOtlpFilters] = useState<{
    tierFilter: string;
    statusFilter: string;
    searchQuery: string;
    criticalPathOnly: boolean;
  }>({
    tierFilter: "ALL",
    statusFilter: "ALL",
    searchQuery: "",
    criticalPathOnly: false,
  });
  const otlpFiltersRef = useRef(otlpFilters);
  otlpFiltersRef.current = otlpFilters;
  const otlpSnapshotRef = useRef(EMPTY_OTLP_SNAPSHOT);

  const [currentSpec, setCurrentSpec] = useState<Spec | null>(null);
  const [healedDiagnostics, setHealedDiagnostics] =
    useState<HealedDiagnosticsByElement>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    SPATIAL_SCENARIO_PRESETS[0]!.id
  );
  const [promptInput, setPromptInput] = useState<string>("");
  const [patchLog, setPatchLog] = useState<SpatialPatchLogItem[]>([]);
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Live OTLP Receiver State
  const [otlpStatus, setOtlpStatus] = useState<OtlpConnectionStatus>("CONNECTING");
  const [otlpStatusDetail, setOtlpStatusDetail] = useState<string | undefined>(undefined);
  const [otlpSnapshot, setOtlpSnapshot] = useState<DynamicTopologySnapshot>(
    EMPTY_OTLP_SNAPSHOT
  );
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>(undefined);
  const [otlpActionBusy, setOtlpActionBusy] = useState(false);

  // Dual-Mode LLM Stream Configuration
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
    (jsonlText: string, instantOverride = false) => {
      stopActiveTimer();
      setStreamError(null);

      const compiler = createGuardrailedStreamCompiler({
        catalog: spatialVerifiedCatalog,
        telemetryTracker,
      });
      compilerRef.current = compiler;
      setPatchLog([]);

      if (instantStreamForTest || instantOverride) {
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

  // Accessible Copy Button Invoker Commands + fallback handler
  useEffect(() => {
    const onCommand = (evt: Event) => {
      const cmdEvt = evt as Event & {
        command?: string;
        source?: HTMLElement | null;
      };
      if (
        typeof cmdEvt.command === "string" &&
        cmdEvt.command.startsWith("--copy") &&
        cmdEvt.source instanceof HTMLElement &&
        cmdEvt.target instanceof HTMLElement
      ) {
        void copyFromTargetElement(cmdEvt.source, cmdEvt.target);
      }
    };

    document.addEventListener("command", onCommand, true);

    let onFallbackClick: ((evt: MouseEvent) => void) | null = null;
    if (typeof window !== "undefined" && !("CommandEvent" in window)) {
      onFallbackClick = (evt: MouseEvent) => {
        const el = evt.target;
        if (!(el instanceof Element)) return;
        const btn = el.closest('button[command^="--copy"]');
        if (!(btn instanceof HTMLElement)) return;
        const targetId = btn.getAttribute("commandfor");
        if (!targetId) return;
        const target = document.getElementById(targetId);
        if (target) {
          void copyFromTargetElement(btn, target);
        }
      };
      document.addEventListener("click", onFallbackClick);
    }

    return () => {
      document.removeEventListener("command", onCommand, true);
      if (onFallbackClick) {
        document.removeEventListener("click", onFallbackClick);
      }
    };
  }, []);

  // Lifecycle effect coordinating Live OTLP Collector Mode vs Explicit Demo Simulation Mode
  useEffect(() => {
    if (dataSourceMode === "demo") {
      otlpClientRef.current?.disconnect();
      otlpClientRef.current = null;

      const seeded = createInitialClusterState();
      timeTravelStore.update({
        "/cluster": seeded.cluster,
      });

      telemetryBridge.attachToStore(timeTravelStore);
      if (!instantStreamForTest) {
        liveMeshSimulator.startEmitting(3500);
      }

      const initialPreset = SPATIAL_SCENARIO_PRESETS[0]!;
      setActiveScenarioId(initialPreset.id);
      setPromptInput(initialPreset.prompt);
      const jsonl = specToJsonlStream(initialPreset.buildSpec());
      runGuardrailedJsonlStream(jsonl);

      return () => {
        liveMeshSimulator.stopEmitting();
        telemetryBridge.detach();
        stopActiveTimer();
      };
    }

    // Live OTLP Mode (default)
    liveMeshSimulator.stopEmitting();
    telemetryBridge.detach();

    // Render empty waiting topology immediately while collector connects
    otlpSnapshotRef.current = EMPTY_OTLP_SNAPSHOT;
    const initialSpec = buildDynamicOtlpSpec(EMPTY_OTLP_SNAPSHOT);
    applyOtlpSnapshotToStore(timeTravelStore, EMPTY_OTLP_SNAPSHOT);
    runGuardrailedJsonlStream(specToJsonlStream(initialSpec), true);

    const client = new LiveOtlpCollectorClient(
      {
        onSnapshot: (snapshot) => {
          otlpSnapshotRef.current = snapshot;
          setOtlpSnapshot(snapshot);
          applyOtlpSnapshotToStore(timeTravelStore, snapshot);
          setSelectedTraceId((prevTraceId) => {
            const stillExists =
              prevTraceId &&
              snapshot.recentTraces.some((t) => t.traceId === prevTraceId);
            const activeTrace = stillExists ? prevTraceId : undefined;
            const dynamicSpec = buildDynamicOtlpSpec(
              snapshot,
              activeTrace,
              otlpFiltersRef.current
            );
            runGuardrailedJsonlStream(specToJsonlStream(dynamicSpec), true);
            return activeTrace;
          });
        },
        onStatusChange: (status, detail) => {
          setOtlpStatus(status);
          setOtlpStatusDetail(detail);
        },
      },
      effectiveCollectorUrl
    );

    otlpClientRef.current = client;
    void client.connect();

    return () => {
      client.disconnect();
      if (otlpClientRef.current === client) {
        otlpClientRef.current = null;
      }
      stopActiveTimer();
    };
  }, [
    dataSourceMode,
    effectiveCollectorUrl,
    instantStreamForTest,
    runGuardrailedJsonlStream,
    timeTravelStore,
  ]);

  const applyOtlpFilters = useCallback(
    (
      next: {
        tierFilter: string;
        statusFilter: string;
        searchQuery: string;
        criticalPathOnly: boolean;
      },
      traceIdOverride?: string
    ) => {
      setOtlpFilters(next);
      otlpFiltersRef.current = next;
      timeTravelStore.update({
        "/cluster/filters": {
          tierFilter: next.tierFilter,
          regionFilter: "ALL",
          searchQuery: next.searchQuery,
        },
      });
      const dynamicSpec = buildDynamicOtlpSpec(
        otlpSnapshotRef.current,
        traceIdOverride ?? selectedTraceId,
        next
      );
      runGuardrailedJsonlStream(specToJsonlStream(dynamicSpec), true);
    },
    [runGuardrailedJsonlStream, selectedTraceId, timeTravelStore]
  );

  const handleSelectTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    const dynamicSpec = buildDynamicOtlpSpec(
      otlpSnapshot,
      traceId,
      otlpFiltersRef.current
    );
    runGuardrailedJsonlStream(specToJsonlStream(dynamicSpec), true);
  };

  const handleSendSampleOtlp = async (faulty: boolean) => {
    if (!otlpClientRef.current) return;
    setOtlpActionBusy(true);
    setStreamError(null);
    try {
      await otlpClientRef.current.sendSampleOtlpTrace(faulty);
    } catch (err) {
      setStreamError(
        err instanceof Error
          ? err.message
          : "Failed to POST /v1/traces to local collector (:4318)"
      );
    } finally {
      setOtlpActionBusy(false);
    }
  };

  const handleResetOtlp = async () => {
    if (!otlpClientRef.current) return;
    setOtlpActionBusy(true);
    setStreamError(null);
    try {
      setSelectedTraceId(undefined);
      await otlpClientRef.current.resetTraces();
    } catch (err) {
      setStreamError(
        err instanceof Error ? err.message : "Failed to reset OTLP collector"
      );
    } finally {
      setOtlpActionBusy(false);
    }
  };

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

    if (dataSourceMode === "otlp") {
      const liveSpec = buildDynamicOtlpSpec(
        otlpSnapshot,
        selectedTraceId,
        otlpFiltersRef.current
      );
      const rootKey = liveSpec.root;
      const rootEl = liveSpec.elements[rootKey];
      if (rootEl) {
        liveSpec.elements[rootKey] = {
          ...rootEl,
          props: {
            ...rootEl.props,
            incidentTitle: `OTLP View: "${promptInput.slice(0, 100)}"`,
          },
        };
      }
      runGuardrailedJsonlStream(specToJsonlStream(liveSpec));
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

    const rootKey = currentSpec?.root || "warroom-shell-otlp";
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

  const handleMutationExecuted = useCallback(
    (entry: SreAuditEntry) => {
      if (dataSourceMode !== "demo") {
        // In Live OTLP mode, mutations stay cleanly isolated to the local TimeTravelStateStore
        return;
      }
      const actionMap: Record<
        string,
        | "tripCircuitBreaker"
        | "triggerRegionalFailover"
        | "scaleServiceReplicas"
        | "rollbackDeployment"
      > = {
        TRIP_CIRCUIT_BREAKER: "tripCircuitBreaker",
        TRIGGER_REGIONAL_FAILOVER: "triggerRegionalFailover",
        SCALE_SERVICE_REPLICAS: "scaleServiceReplicas",
        ROLLBACK_DEPLOYMENT: "rollbackDeployment",
      };
      const mappedAction = actionMap[entry.actionType];
      if (mappedAction) {
        telemetryBridge.executeRemediation({
          action: mappedAction,
          targetServiceId: entry.targetServiceId,
          operator: entry.operator,
        });
      }
    },
    [dataSourceMode]
  );

  const handleInjectLiveChaos = useCallback(() => {
    if (dataSourceMode === "otlp") {
      void handleSendSampleOtlp(true);
      return;
    }
    telemetryBridge.injectDbPoolChaos();
    const preset = SPATIAL_SCENARIO_PRESETS[0]!;
    setActiveScenarioId(preset.id);
    setPromptInput(
      "Diagnose Postgres connection pool saturation and propose mitigation playbook"
    );
    const jsonl = specToJsonlStream(preset.buildSpec());
    runGuardrailedJsonlStream(jsonl);
  }, [dataSourceMode, runGuardrailedJsonlStream]);

  const handleClearLiveChaos = useCallback(() => {
    if (dataSourceMode === "otlp") {
      void handleResetOtlp();
      return;
    }
    telemetryBridge.clearChaos();
  }, [dataSourceMode]);

  const handleSimulateChaosSpike = () => {
    const services = {
      ...((timeTravelStore.get("/cluster/services") as Record<
        string,
        ServiceNodeData
      >) ?? {}),
    };
    const firstId = Object.keys(services)[0];
    const target = services["srv-api-gateway"] ?? (firstId ? services[firstId] : undefined);
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

  const severityToneClass =
    summary?.severity === "SEV-1" || summary?.severity === "SEV-0"
      ? "text-rose-400"
      : summary?.severity === "SEV-2"
        ? "text-amber-400"
        : "text-emerald-400";

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
                  SpatialOps · Live OTLP 3D Topology Workbench
                </h1>
                <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                  OTLP :4318
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400">
                {dataSourceMode === "otlp"
                  ? `Local OpenTelemetry Receiver (${otlpSnapshot.totalIngestedTraces} traces · ${otlpSnapshot.totalIngestedSpans} spans)`
                  : "Sample Simulation Mode · Synthetic Service Mesh"}
              </p>
            </div>
          </div>

          {/* Workspace Mode Switcher & Template Export */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDataSourceMode((m) => (m === "otlp" ? "demo" : "otlp"))
              }
              data-testid="toggle-source-mode-btn"
              className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition cursor-pointer ${
                dataSourceMode === "otlp"
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  : "border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
              }`}
            >
              {dataSourceMode === "otlp"
                ? "Load Sample Demo"
                : "← Switch to Live OTLP :4318"}
            </button>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1 font-mono text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition cursor-pointer shadow-sm shadow-purple-950/50"
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-purple-400"
                aria-hidden="true"
              />
              Export 3D Pack
            </button>
          </div>

          {/* Cluster Telemetry Pill Strip */}
          <div className="hidden xl:flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/75 px-3.5 py-1.5 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">SEVERITY</span>
              <span
                className={`font-semibold ${severityToneClass}`}
                data-testid="header-cluster-severity"
              >
                {summary?.severity ?? "NOMINAL"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block">
                GLOBAL ERROR RATE
              </span>
              <span
                className={`font-semibold tabular-nums ${
                  (summary?.globalErrorRatePercent ?? 0) > 5
                    ? "text-rose-300"
                    : "text-emerald-300"
                }`}
                data-testid="header-global-error-rate"
              >
                {summary?.globalErrorRatePercent ?? 0}%
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block">THROUGHPUT</span>
              <span className="font-semibold text-slate-100 tabular-nums">
                {(summary?.globalRps ?? 0).toLocaleString()} RPS
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
                className="rounded px-2.5 py-1 text-slate-200 hover:bg-slate-800 disabled:opacity-35 transition"
              >
                ↷ Redo
              </button>
            </div>

            <button
              type="button"
              onClick={handleInjectLiveChaos}
              disabled={otlpActionBusy}
              data-testid="header-inject-live-chaos-btn"
              className="rounded-lg border border-rose-500/60 bg-rose-500/20 px-3 py-1.5 font-mono text-xs font-semibold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50 transition shadow-sm shadow-rose-950 flex items-center gap-1.5 cursor-pointer"
            >
              <span
                className="h-2 w-2 rounded-full bg-rose-400"
                aria-hidden="true"
              />
              {dataSourceMode === "otlp"
                ? "Send Slow DB OTLP Trace"
                : "Inject Demo Chaos"}
            </button>

            <button
              type="button"
              onClick={handleClearLiveChaos}
              disabled={otlpActionBusy}
              data-testid="header-recover-chaos-btn"
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition flex items-center gap-1 cursor-pointer"
            >
              <span>
                {dataSourceMode === "otlp"
                  ? "Reset OTLP Buffer"
                  : "Remediate & Recover"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsXRayOpen(true)}
              data-testid="open-spatial-xray-btn"
              className="rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 font-mono text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition cursor-pointer"
            >
              Spatial X-Ray ({telemetry.patchCount} patches)
            </button>
          </div>
        </div>
      </header>

      {/* Operational Receiver / Scenario Bar */}
      <section className="border-b border-slate-800/80 bg-slate-900/45">
        <div className="mx-auto max-w-[1680px] px-5 py-4 space-y-3">
          {dataSourceMode === "otlp" ? (
            <div
              className="rounded-lg border border-slate-800 bg-slate-950/90 p-3.5 space-y-3"
              data-testid="otlp-receiver-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-semibold ${
                      otlpStatus === "STREAMING"
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : otlpStatus === "LISTENING"
                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                          : otlpStatus === "CONNECTING"
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                            : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                    }`}
                    data-testid="otlp-connection-status"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        otlpStatus === "STREAMING"
                          ? "bg-emerald-400"
                          : otlpStatus === "LISTENING"
                            ? "bg-cyan-400"
                            : otlpStatus === "CONNECTING"
                              ? "bg-amber-400"
                              : "bg-rose-400"
                      }`}
                      aria-hidden="true"
                    />
                    OTLP :4318 {otlpStatus}
                  </span>
                  <span className="text-slate-300">
                    Nodes:{" "}
                    <strong>{Object.keys(otlpSnapshot.services).length}</strong> · Edges:{" "}
                    <strong>{otlpSnapshot.edges.length}</strong> · Traces:{" "}
                    <strong>{otlpSnapshot.totalIngestedTraces}</strong> · Spans:{" "}
                    <strong>{otlpSnapshot.totalIngestedSpans}</strong> · Logs:{" "}
                    <strong>{otlpSnapshot.totalIngestedLogs ?? 0}</strong> · Metrics:{" "}
                    <strong>{otlpSnapshot.totalIngestedMetrics ?? 0}</strong>
                  </span>
                  {otlpStatus === "OFFLINE" && otlpStatusDetail && (
                    <span className="text-rose-300/90 text-[11px]">
                      ({otlpStatusDetail} — run <code>pnpm dev</code> or{" "}
                      <code>pnpm collector</code>)
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => void handleSendSampleOtlp(false)}
                    disabled={otlpActionBusy}
                    data-testid="send-sample-otlp-btn"
                    className="rounded border border-cyan-500/50 bg-cyan-500/15 px-2.5 py-1 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50 transition cursor-pointer"
                  >
                    + Send Healthy OTLP Trace
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApiConfig((s) => !s)}
                    className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    {streamMode === "LIVE_API"
                      ? "Mode: Live LLM SSE"
                      : "LLM / Collector Settings"}
                  </button>
                </div>
              </div>

              {/* Copyable OTLP SDK Env Config (/v1/traces, /v1/logs, /v1/metrics) */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800/90 bg-slate-900/70 px-3 py-2">
                <pre className="overflow-x-auto text-[11px] text-cyan-200">
                  <code id={otlpSnippetId}>
                    OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
                    {" "}OTEL_EXPORTER_OTLP_PROTOCOL=http/json
                  </code>
                </pre>
                <span className="text-[10px] font-mono text-slate-400">
                  POST /v1/traces · /v1/logs · /v1/metrics
                </span>
                <span className="copy-wrap">
                  <button
                    type="button"
                    className="copy-button inline-flex items-center justify-center rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 cursor-pointer"
                    aria-label="Copy OpenTelemetry OTLP environment variables"
                    {...({
                      command: "--copy",
                      commandfor: otlpSnippetId,
                    } as Record<string, string>)}
                  >
                    <svg
                      className="icon-copy h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <svg
                      className="icon-check h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="ml-1.5">Copy</span>
                  </button>
                  <span className="copy-tip" role="status" />
                </span>
              </div>

              {/* Semantic Search & Topology Filter Toolbar */}
              {Object.keys(otlpSnapshot.services).length > 0 && (
                <search aria-label="Filter discovered OTLP topology services">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      applyOtlpFilters({ ...otlpFilters });
                    }}
                    className="flex flex-wrap items-end gap-2.5 rounded border border-slate-800/90 bg-slate-900/60 px-3 py-2 font-mono text-xs"
                  >
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={filterSearchId}
                        className="text-[10px] uppercase tracking-wider text-slate-400"
                      >
                        Service Filter
                      </label>
                      <input
                        id={filterSearchId}
                        name="serviceQuery"
                        type="search"
                        value={otlpFilters.searchQuery}
                        onChange={(e) =>
                          applyOtlpFilters({
                            ...otlpFilters,
                            searchQuery: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (
                              e.nativeEvent.isComposing ||
                              e.keyCode === 229
                            ) {
                              return;
                            }
                            applyOtlpFilters({ ...otlpFilters });
                          }
                        }}
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="search"
                        placeholder="gateway, postgres, us-east..."
                        className="otlp-filter-control w-52 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={filterTierId}
                        className="text-[10px] uppercase tracking-wider text-slate-400"
                      >
                        Tier
                      </label>
                      <select
                        id={filterTierId}
                        name="tierFilter"
                        value={otlpFilters.tierFilter}
                        onChange={(e) =>
                          applyOtlpFilters({
                            ...otlpFilters,
                            tierFilter: e.target.value,
                          })
                        }
                        className="otlp-filter-control rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                      >
                        <option value="ALL">All Tiers</option>
                        <option value="INGRESS">Ingress</option>
                        <option value="GATEWAY">Gateway</option>
                        <option value="SERVICE">Service</option>
                        <option value="DATABASE">Database</option>
                        <option value="CACHE">Cache</option>
                        <option value="BROKER">Broker</option>
                        <option value="WORKER">Worker</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={filterStatusId}
                        className="text-[10px] uppercase tracking-wider text-slate-400"
                      >
                        Health
                      </label>
                      <select
                        id={filterStatusId}
                        name="statusFilter"
                        value={otlpFilters.statusFilter}
                        onChange={(e) =>
                          applyOtlpFilters({
                            ...otlpFilters,
                            statusFilter: e.target.value,
                          })
                        }
                        className="otlp-filter-control rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                      >
                        <option value="ALL">All Health</option>
                        <option value="UNHEALTHY">Unhealthy Only</option>
                        <option value="CRITICAL_OUTAGE">Critical Outage</option>
                        <option value="DEGRADED">Degraded</option>
                        <option value="NOMINAL">Nominal</option>
                      </select>
                    </div>

                    {otlpSnapshot.criticalPathServiceIds &&
                      otlpSnapshot.criticalPathServiceIds.length > 0 && (
                        <button
                          type="button"
                          aria-pressed={otlpFilters.criticalPathOnly}
                          onClick={() =>
                            applyOtlpFilters({
                              ...otlpFilters,
                              criticalPathOnly: !otlpFilters.criticalPathOnly,
                            })
                          }
                          data-testid="toggle-critical-path-btn"
                          className={`otlp-filter-control rounded border px-2.5 py-1 text-xs transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 ${
                            otlpFilters.criticalPathOnly
                              ? "border-rose-500/70 bg-rose-500/20 text-rose-100"
                              : "border-slate-700 bg-slate-950 text-slate-300 hover:border-rose-500/50"
                          }`}
                        >
                          Critical Path ({otlpSnapshot.criticalPathServiceIds.length})
                        </button>
                      )}

                    {(otlpFilters.tierFilter !== "ALL" ||
                      otlpFilters.statusFilter !== "ALL" ||
                      otlpFilters.searchQuery.trim() !== "" ||
                      otlpFilters.criticalPathOnly) && (
                      <button
                        type="button"
                        onClick={() =>
                          applyOtlpFilters({
                            tierFilter: "ALL",
                            statusFilter: "ALL",
                            searchQuery: "",
                            criticalPathOnly: false,
                          })
                        }
                        className="otlp-filter-control rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300 hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    )}

                    <span
                      role="status"
                      aria-live="polite"
                      className="ml-auto text-[11px] text-slate-400"
                    >
                      Visible nodes:{" "}
                      <strong className="text-slate-200">
                        {currentSpec
                          ? Object.values(currentSpec.elements).filter(
                              (el) => el.type === "ServiceMeshNode3D"
                            ).length
                          : Object.keys(otlpSnapshot.services).length}
                      </strong>
                      /{Object.keys(otlpSnapshot.services).length}
                    </span>
                  </form>
                </search>
              )}

              {/* Recent Real OTLP Trace Selector */}
              {otlpSnapshot.recentTraces.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] mr-1">
                    Captured Traces:
                  </span>
                  {otlpSnapshot.recentTraces.slice(0, 8).map((tr) => {
                    const isSelected =
                      selectedTraceId === tr.traceId ||
                      (!selectedTraceId &&
                        otlpSnapshot.recentTraces[0]?.traceId === tr.traceId);
                    return (
                      <button
                        key={tr.traceId}
                        type="button"
                        onClick={() => handleSelectTrace(tr.traceId)}
                        className={`rounded border px-2 py-0.5 transition cursor-pointer ${
                          isSelected
                            ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
                            : tr.hasError
                              ? "border-rose-500/40 bg-rose-950/30 text-rose-200 hover:border-rose-400"
                              : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {tr.traceId.slice(0, 8)} · {tr.rootSpan.operationName.slice(0, 26)} (
                        {Math.round(tr.totalDurationMs)}ms)
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
                  Demo Scenarios (Simulated):
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
                    ? "Mode: Live LLM SSE"
                    : "Mode: Recorded Demo Replay"}
                </button>
              </div>
            </div>
          )}

          {showApiConfig && (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-200">
                    Streaming Provider Configuration
                  </span>
                  <p className="text-slate-400">
                    Switch between local OTLP / Recorded spec compilation and Live
                    OpenAI-Compatible SSE Streaming via{" "}
                    <code>spatialVerifiedCatalog.prompt()</code>.
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
                    Local Compiler Mode
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
              placeholder={
                dataSourceMode === "otlp"
                  ? "Annotate view or stream OpenAI-compatible 3D war-room intent over live OTLP topology..."
                  : "Type an SRE intent (e.g. 'Isolate the failing PostgreSQL node and prepare cross-region failover')..."
              }
              className="flex-1 rounded-lg border border-slate-700/90 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              data-testid="spatial-prompt-submit-btn"
              className="rounded-lg bg-cyan-500 px-4 py-2 font-mono text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition shrink-0 cursor-pointer"
            >
              {isStreaming ? "Streaming Spatial Spec..." : "Apply Spatial Intent ↵"}
            </button>
          </form>

          {streamError && (
            <div className="rounded border border-rose-500/40 bg-rose-950/30 px-3 py-2 font-mono text-xs text-rose-200">
              {streamError}
            </div>
          )}
        </div>
      </section>

      {/* Main Dual-Viewport Workspace Surface */}
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-5 py-6">
        <SpatialRuntimeContext.Provider
          value={{ timeTravelStore, onMutationExecuted: handleMutationExecuted }}
        >
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

      {/* Commercial 3D Template Pack Exporter Modal */}
      <TemplateExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        packId="spatial-ops-3d-pro"
      />
    </div>
  );
};
