import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ArrowLeft, Download, ListTree } from "lucide-react";
import { useInteractionDrivers } from "@genui-studio/core";
import type { PlaytestFuzzReport } from "@genui-studio/core/testing";
import { FlowMapView } from "../components/FlowMapView.js";
import { PlayableExportDialog } from "../components/PlayableExportDialog.js";
import { PlayableStage } from "../components/PlayableStage.js";
import { PlaytestTimelineBar, type PlaytestMode } from "../components/PlaytestTimelineBar.js";
import { RuleInspectorDrawer } from "../components/RuleInspectorDrawer.js";
import { VibeReframeBar } from "../components/VibeReframeBar.js";
import { downloadBytes } from "../lib/download.js";
import { streamArchitectPatch, type FetchLike } from "../lib/llm-architect.js";
import { applyPivotMacro } from "../lib/pivot-macros.js";
import { createPlayableSession, verifyWinnability } from "../lib/playable-session.js";
import { createPlayableStarter, type PlayableBlueprint } from "../lib/playable-starter.js";
import { describeEvent } from "../lib/rule-describe.js";
import { specToExcalidrawScene } from "../lib/spec-to-excalidraw.js";
import { playableCatalog } from "../playable/catalog.js";

// One shared promise: the background preload and React.lazy fetch the chunk only once.
let excalidrawViewModule: Promise<typeof import("../components/ExcalidrawSourceView.js")> | null = null;
function loadExcalidrawSourceView() {
  excalidrawViewModule ??= import("../components/ExcalidrawSourceView.js");
  return excalidrawViewModule;
}

const LazyExcalidrawSourceView = React.lazy(() =>
  loadExcalidrawSourceView().then((mod) => ({ default: mod.ExcalidrawSourceView })),
);

/** Downloads the Excalidraw chunk ahead of time; failures are retried when the tab opens. */
function preloadExcalidrawSourceView(): void {
  loadExcalidrawSourceView().catch(() => {
    excalidrawViewModule = null;
  });
}

type StageTab = "preview" | "flow" | "excalidraw";

const TABS: readonly { id: StageTab; label: string }[] = [
  { id: "preview", label: "Playable Preview" },
  { id: "flow", label: "Live Flow Map" },
  { id: "excalidraw", label: "Excalidraw Source" },
];

const OUTCOME_PILL: Record<string, string> = {
  playing: "border-[#E4E4E7] bg-white text-[#52525B]",
  win: "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]",
  lose: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  complete: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
};

export interface PlayableWorkbenchPageProps {
  readonly onNavigateHome: () => void;
  /** Delay between events when auto-replaying the winning trace (0 = instant). */
  readonly replayStepMs?: number;
  readonly initialMuted?: boolean;
  /** Fetch override for the LLM stream (tests). */
  readonly fetchImpl?: FetchLike;
  readonly initialBlueprint?: PlayableBlueprint;
  /** Download the Excalidraw chunk in the background once the page is idle (default: true). */
  readonly preloadExcalidraw?: boolean;
}

/**
 * Playable workbench: a playable starter rendered through the interaction rule engine, a
 * live flow map, a one-way Excalidraw view, playtest timeline, rule inspector and exports.
 */
export const PlayableWorkbenchPage: React.FC<PlayableWorkbenchPageProps> = ({
  onNavigateHome,
  replayStepMs = 450,
  initialMuted = false,
  fetchImpl,
  initialBlueprint,
  preloadExcalidraw = true,
}) => {
  const [session] = useState(() =>
    createPlayableSession(initialBlueprint ?? createPlayableStarter(), { muted: initialMuted }),
  );
  const view = useSyncExternalStore(session.subscribe, session.getView, session.getView);
  const blueprint = session.getBlueprint();

  const [tab, setTab] = useState<StageTab>("preview");
  // Once opened, the Excalidraw view stays mounted (hidden) so switching back is instant.
  const [excalidrawOpened, setExcalidrawOpened] = useState(false);
  const [mode, setMode] = useState<PlaytestMode>("play");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [fuzz, setFuzz] = useState<{ report: PlaytestFuzzReport; forBlueprint: PlayableBlueprint } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<string | null>(null);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<Record<StageTab, HTMLButtonElement | null>>({ preview: null, flow: null, excalidraw: null });

  // The report only applies to the blueprint it was computed for.
  const fuzzReport = fuzz && fuzz.forBlueprint === blueprint ? fuzz.report : null;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${blueprint.brief.title} · Workbench | WizFrame`;
    }
  }, [blueprint.brief.title]);

  useEffect(
    () => () => {
      if (replayTimer.current) clearTimeout(replayTimer.current);
      session.dispose();
    },
    [session],
  );

  useEffect(() => {
    if (tab === "excalidraw") setExcalidrawOpened(true);
  }, [tab]);

  // Fetch Excalidraw while the user plays, so the first open of the tab doesn't wait for it.
  useEffect(() => {
    if (!preloadExcalidraw || typeof window === "undefined") return;
    if (typeof window.requestIdleCallback === "function") {
      // Called on window: a detached requestIdleCallback throws "Illegal invocation".
      const id = window.requestIdleCallback(preloadExcalidrawSourceView, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(preloadExcalidrawSourceView, 1500);
    return () => clearTimeout(id);
  }, [preloadExcalidraw]);

  useInteractionDrivers({
    rules: blueprint.rules,
    dispatch: session.dispatch,
    enabled: mode === "play" && !isReplaying,
    shouldTick: () => session.getView().outcome === "playing",
  });

  const scene = useMemo(
    () =>
      specToExcalidrawScene({
        spec: blueprint.spec,
        rules: blueprint.rules,
        brief: blueprint.brief,
        catalog: playableCatalog,
      }),
    [blueprint],
  );
  const excalidrawJson = useMemo(() => JSON.stringify(scene, null, 2), [scene]);

  const stopReplay = useCallback(() => {
    if (replayTimer.current) clearTimeout(replayTimer.current);
    replayTimer.current = null;
    setIsReplaying(false);
  }, []);

  const runVerify = useCallback(() => {
    setIsVerifying(true);
    try {
      const report = verifyWinnability(session.getBlueprint());
      setFuzz({ report, forBlueprint: session.getBlueprint() });
    } finally {
      setIsVerifying(false);
    }
  }, [session]);

  const changeMode = (next: PlaytestMode) => {
    setMode(next);
    if (next !== "edit") setSelectedKey(null);
    if (next === "fuzz" && !fuzzReport) runVerify();
  };

  const replayWin = () => {
    const trace = fuzzReport?.shortestTraces.win;
    if (!trace || trace.length === 0) return;
    stopReplay();
    session.reset();
    setMode("play");
    setTab("preview");
    if (replayStepMs <= 0) {
      for (const event of trace) session.dispatch(event);
      return;
    }
    setIsReplaying(true);
    let index = 0;
    const step = () => {
      const event = trace[index];
      if (event) session.dispatch(event);
      index += 1;
      if (index < trace.length) {
        replayTimer.current = setTimeout(step, replayStepMs);
      } else {
        replayTimer.current = null;
        setIsReplaying(false);
      }
    };
    replayTimer.current = setTimeout(step, replayStepMs);
  };

  const applyMacro = (macroId: Parameters<typeof applyPivotMacro>[0]): string => {
    stopReplay();
    const current = session.getBlueprint();
    const result = applyPivotMacro(macroId, {
      spec: current.spec,
      rules: current.rules,
      catalog: playableCatalog,
    });
    if (result.changed) {
      session.load({ ...current, spec: result.spec, rules: result.rules });
    }
    return result.summary;
  };

  const submitPrompt: React.ComponentProps<typeof VibeReframeBar>["onSubmitPrompt"] = async ({
    prompt,
    mode: inputMode,
    config,
    signal,
  }) => {
    stopReplay();
    const current = session.getBlueprint();
    setIsStreaming(true);
    setStreamProgress(null);
    try {
      const result = await streamArchitectPatch({
        prompt,
        mode: inputMode,
        config,
        currentSpec: current.spec,
        currentRules: current.rules,
        currentBrief: current.brief,
        catalog: playableCatalog,
        signal,
        ...(fetchImpl ? { fetchImpl } : {}),
        onProgress: (p) =>
          setStreamProgress(
            `Streaming: ${p.appliedPatchesCount} patches, ${Object.keys(p.spec.elements).length} elements, ${p.rules.length} rules`,
          ),
      });
      session.load({
        brief: result.brief,
        spec: result.spec,
        rules: result.rules,
        initialScene: result.brief.scenes[0] ?? "main",
        audit: result.audit,
      });
      if (result.audit) setInspectorOpen(true);
      return `Applied ${result.appliedPatchesCount} patches: ${Object.keys(result.spec.elements).length} elements, ${result.rules.length} rules.`;
    } finally {
      setIsStreaming(false);
      setStreamProgress(null);
    }
  };

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = TABS[(index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAFAFA] text-[#09090B]" data-testid="playable-workbench">
      <header className="sticky top-0 z-30 border-b border-[#E4E4E7] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={onNavigateHome}
            data-testid="playable-back-home-btn"
            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            WizFrame
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-sm font-semibold tracking-tight">
              {blueprint.brief.title}
              <span className="ml-2 font-mono text-[0.6875rem] font-normal text-[#71717A]">WizFrame Workbench</span>
            </h1>
            <p className="m-0 truncate text-xs text-[#52525B]">{blueprint.brief.elevatorPitch}</p>
          </div>
          <span
            data-testid="playable-outcome-pill"
            data-outcome={view.outcome}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] font-semibold ${OUTCOME_PILL[view.outcome] ?? OUTCOME_PILL.playing}`}
          >
            {view.outcome} · {view.scene}
          </span>
          <button
            type="button"
            onClick={() => setInspectorOpen((v) => !v)}
            aria-expanded={inspectorOpen}
            data-testid="open-rule-inspector-btn"
            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 text-xs font-medium hover:bg-[#FAFAFA]"
          >
            <ListTree aria-hidden="true" className="h-3.5 w-3.5" />
            Rules ({blueprint.rules.length})
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            data-testid="open-playable-export-btn"
            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-lg bg-[#09090B] px-3 text-xs font-medium text-white hover:bg-[#18181B]"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-3 px-4 py-4 sm:px-6">
        <VibeReframeBar
          onSubmitPrompt={submitPrompt}
          onApplyMacro={applyMacro}
          isStreaming={isStreaming}
          streamProgress={streamProgress}
          devProxyAvailable={Boolean(import.meta.env?.DEV)}
        />

        <section aria-label="Center stage" className="hub-card overflow-hidden">
          <div role="tablist" aria-label="Center stage view" className="hub-scroll-row gap-1 border-b border-[#E4E4E7] bg-white px-3 pt-2">
            {TABS.map(({ id, label }, index) => (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                type="button"
                role="tab"
                id={`stage-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`stage-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
                onPointerEnter={id === "excalidraw" && preloadExcalidraw ? preloadExcalidrawSourceView : undefined}
                onFocus={id === "excalidraw" && preloadExcalidraw ? preloadExcalidrawSourceView : undefined}
                data-testid={`stage-tab-${id}`}
                className={`-mb-px min-h-[36px] cursor-pointer border-b-2 px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563EB] ${
                  tab === id ? "border-[#09090B] text-[#09090B]" : "border-transparent text-[#71717A] hover:text-[#09090B]"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto self-center pb-1 font-mono text-[0.6875rem] text-[#71717A]">
              {mode === "play" ? "Play: interactions and timers live" : mode === "edit" ? "Edit: click an element to inspect" : "Fuzz: preview paused"}
            </span>
          </div>

          <div
            role="tabpanel"
            id="stage-panel-preview"
            aria-labelledby="stage-tab-preview"
            hidden={tab !== "preview"}
            className="bg-[#E4E4E7]/40 p-3 sm:p-4"
          >
            <PlayableStage
              session={session}
              view={view}
              interactive={mode === "play" && !isReplaying}
              selectedElementKey={selectedKey}
              onSelectElement={
                mode === "edit"
                  ? (key) => {
                      setSelectedKey(key);
                      setInspectorOpen(true);
                    }
                  : undefined
              }
            />
          </div>

          {tab === "flow" ? (
            <div role="tabpanel" id="stage-panel-flow" aria-labelledby="stage-tab-flow" className="p-3 sm:p-4">
              <FlowMapView
                spec={blueprint.spec}
                rules={blueprint.rules}
                brief={blueprint.brief}
                lastFired={view.lastFired}
                pulseId={view.pulseId}
                outcome={view.outcome}
                scene={view.scene}
                firedCounts={view.firedCounts}
              />
            </div>
          ) : null}

          {excalidrawOpened || tab === "excalidraw" ? (
            <div
              role="tabpanel"
              id="stage-panel-excalidraw"
              aria-labelledby="stage-tab-excalidraw"
              hidden={tab !== "excalidraw"}
              className="space-y-3 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#52525B]">
                <span>
                  One-way export of the current spec ({scene.elements.length} Excalidraw elements). Edits here are not
                  read back.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    downloadBytes(`${blueprint.brief.slug}.excalidraw.json`, excalidrawJson, "application/json")
                  }
                  data-testid="download-excalidraw-btn"
                  className="inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2.5 text-xs font-medium text-[#09090B] hover:bg-[#FAFAFA]"
                >
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  {blueprint.brief.slug}.excalidraw.json
                </button>
              </div>
              <Suspense
                fallback={
                  <div className="flex h-[560px] items-center justify-center rounded-xl border border-[#E4E4E7] font-mono text-xs text-[#52525B]">
                    Loading Excalidraw…
                  </div>
                }
              >
                <LazyExcalidrawSourceView scene={scene} visible={tab === "excalidraw"} />
              </Suspense>
            </div>
          ) : null}
        </section>

        <PlaytestTimelineBar
          view={view}
          mode={mode}
          onModeChange={changeMode}
          onScrub={(index) => {
            stopReplay();
            session.scrubTo(index);
          }}
          onUndo={() => {
            stopReplay();
            session.undo();
          }}
          onRedo={() => session.redo()}
          onReset={() => {
            stopReplay();
            session.reset();
          }}
          onToggleMute={() => session.setMuted(!view.muted)}
          onVerify={runVerify}
          onReplayWin={replayWin}
          onStopReplay={stopReplay}
          fuzzReport={fuzzReport}
          isVerifying={isVerifying}
          isReplaying={isReplaying}
        />

        {fuzzReport ? (
          <section
            aria-label="Fuzz report"
            data-testid="fuzz-report"
            data-passed={fuzzReport.passed ? "true" : "false"}
            data-win-reachable={fuzzReport.shortestTraces.win ? "true" : "false"}
            className="hub-card space-y-2 p-3 text-xs"
          >
            <p className="m-0 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-[0.6875rem] font-semibold ${
                  fuzzReport.passed ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FEF2F2] text-[#B91C1C]"
                }`}
              >
                {fuzzReport.passed ? "WIN REACHABLE" : "WIN NOT REACHED"}
              </span>
              <span className="text-[#52525B]">
                {fuzzReport.totalRuns} sessions · {fuzzReport.totalEventsDispatched} events ·{" "}
                {fuzzReport.unhandledExceptions} exceptions · {fuzzReport.circuitBreakerTrips} breaker trips ·{" "}
                {fuzzReport.durationMs} ms
              </span>
            </p>
            <p className="m-0 font-mono text-[0.6875rem] text-[#52525B]">
              Sessions ending in: win {fuzzReport.outcomesReached.win} · lose {fuzzReport.outcomesReached.lose} · complete{" "}
              {fuzzReport.outcomesReached.complete} · still playing {fuzzReport.outcomesReached.playing}
            </p>
            {(["win", "lose", "complete"] as const).map((outcome) => {
              const trace = fuzzReport.shortestTraces[outcome];
              if (!trace) return null;
              return (
                <p key={outcome} className="m-0 text-[#09090B]" data-testid={`shortest-trace-${outcome}`}>
                  <span className="font-semibold">Shortest {outcome}</span> ({trace.length} events):{" "}
                  <span className="text-[#52525B]">{trace.map(describeEvent).join(" → ")}</span>
                </p>
              );
            })}
            {fuzzReport.deadRules.length > 0 ? (
              <p className="m-0 text-[#92400E]">
                Never fired: {fuzzReport.deadRules.map((r) => r.label).join(", ")}
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      <RuleInspectorDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        rules={blueprint.rules}
        onChangeRules={(rules) => session.setRules(rules)}
        firedCounts={view.firedCounts}
        selectedElementKey={selectedKey}
        onClearSelection={() => setSelectedKey(null)}
        audit={blueprint.audit ?? null}
        preservedConstraints={blueprint.brief.preservedConstraints ?? []}
        fuzzReport={fuzzReport}
      />

      <PlayableExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        blueprint={blueprint}
        excalidrawJson={excalidrawJson}
      />
    </div>
  );
};
