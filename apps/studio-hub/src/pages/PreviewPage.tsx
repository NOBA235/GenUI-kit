import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Spec } from "@json-render/core";
import { JSONUIProvider } from "@json-render/react";
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
  wrapRegistryWithTelemetry,
} from "@genui-studio/core";
import { getTemplateBySlug } from "@genui-studio/templates";
import { ScopedTemplateContainer } from "../components/ScopedTemplateContainer.js";
import { StudioHud, type ViewportPreset } from "../components/StudioHud.js";
import { TemplateExportDialog } from "../components/TemplateExportDialog.js";
import {
  TemplateXRayDrawer,
  type HubPatchLogItem,
} from "../components/TemplateXRayDrawer.js";
import type { WireframeInitialScene } from "../components/WireframeArchitectCanvas.js";
import type { ExcalidrawCompileResult } from "../lib/excalidraw-compiler.js";
import { buildWireframeExport } from "../lib/wireframe-export.js";

const LazyWireframeArchitectCanvas = React.lazy(() =>
  import("../components/WireframeArchitectCanvas.js").then((mod) => ({
    default: mod.WireframeArchitectCanvas,
  })),
);

export interface PreviewPageProps {
  readonly slug: string;
  readonly initialSubPath?: string;
  readonly isFullscreen: boolean;
  readonly onToggleFullscreen: () => void;
  readonly onNavigateHome: () => void;
  readonly instantStreamForTest?: boolean;
  readonly initialWireframeMode?: boolean;
  /** Scene Wireframe Architect starts from (`?wireframe=sample` selects `sample`). */
  readonly initialWireframeScene?: WireframeInitialScene;
}

const VIEWPORT_WIDTH_CLASS: Record<ViewportPreset, string> = {
  desktop: "w-full max-w-none",
  tablet: "w-[768px] max-w-full",
  mobile: "w-[390px] max-w-full",
};

function defaultRemixSynthesizer(prompt: string, baseSpec: Spec): string {
  const keys = Object.keys(baseSpec.elements);
  const nextElements: Record<string, (typeof baseSpec.elements)[string]> = {
    ...baseSpec.elements,
  };

  for (const key of keys) {
    const el = nextElements[key];
    if (!el || !el.props) continue;
    if (typeof el.props.headline === "string") {
      nextElements[key] = {
        ...el,
        props: {
          ...el.props,
          headline: prompt.slice(0, 120),
        },
      };
      break;
    }
    if (typeof el.props.title === "string") {
      nextElements[key] = {
        ...el,
        props: {
          ...el.props,
          title: prompt.slice(0, 120),
        },
      };
      break;
    }
  }

  return specToJsonlStream({ ...baseSpec, elements: nextElements });
}

function resolveInitialPageId(
  pages: readonly { readonly id: string; readonly route: string }[] | undefined,
  subPath?: string,
): string {
  const defaultId = pages?.[0]?.id ?? "home";
  if (!subPath || !pages) return defaultId;
  const normalized = `/${subPath.replace(/^\/+|\/+$/g, "")}`;
  const exactMatch = pages.find((p) => p.route === normalized || p.id === subPath);
  if (exactMatch) return exactMatch.id;
  if (normalized.startsWith("/dossier/")) return "archive";
  return defaultId;
}

export const PreviewPage: React.FC<PreviewPageProps> = ({
  slug,
  initialSubPath,
  isFullscreen,
  onToggleFullscreen,
  onNavigateHome,
  instantStreamForTest = false,
  initialWireframeMode = false,
  initialWireframeScene = "template",
}) => {
  const template = useMemo(() => getTemplateBySlug(slug), [slug]);

  const isImmersiveTemplate = Boolean(template?.manifest.immersiveExperience);
  const isMonochromeArchive = slug === "ninety9-archive";
  const isCmosBios = slug === "cmos-cloud-bios";
  const isChimeraLab = slug === "neuro-chimera-synth";
  const [viewport, setViewport] = useState<ViewportPreset>("desktop");
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [immersionHudOpen, setImmersionHudOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("hud") === "true";
  });
  const [lightModeRestored, setLightModeRestored] = useState(false);
  const wasPointerLockedRef = useRef(false);
  const [isRemixOpen, setIsRemixOpen] = useState(false);
  const [isWireframeMode, setIsWireframeMode] = useState(initialWireframeMode);
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const firstPageId = resolveInitialPageId(template?.manifest.pages, initialSubPath);
  const [activePageId, setActivePageId] = useState<string>(firstPageId);

  useEffect(() => {
    setActivePageId(resolveInitialPageId(template?.manifest.pages, initialSubPath));
    setImmersionHudOpen(
      typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("hud") === "true",
    );
    setLightModeRestored(false);
    setIsWireframeMode(initialWireframeMode);
    wasPointerLockedRef.current = false;
  }, [slug, template, initialSubPath, initialWireframeMode]);

  // Immersion Mode hotkeys ([Alt+G]), Pointer Lock ESC release recovery, and Light Mode reveal
  useEffect(() => {
    if (!isImmersiveTemplate || typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setImmersionHudOpen((prev) => {
          const next = !prev;
          if (next && isMonochromeArchive) {
            setIsRemixOpen(true);
          }
          return next;
        });
      }
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement !== null;
      if (locked) {
        wasPointerLockedRef.current = true;
      } else if (wasPointerLockedRef.current) {
        // Releasing Pointer Lock (ESC) brings back Studio controls without trapping the user
        wasPointerLockedRef.current = false;
        setImmersionHudOpen(true);
      }
    };

    const onLightModeRestored = (ev: Event) => {
      const custom = ev as CustomEvent<{ slug?: string; restored?: boolean }>;
      if (custom.detail?.slug === slug) {
        setLightModeRestored(Boolean(custom.detail.restored));
        if (custom.detail.restored) {
          setImmersionHudOpen(true);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("genui:template-light-mode-restored", onLightModeRestored);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("genui:template-light-mode-restored", onLightModeRestored);
    };
  }, [isImmersiveTemplate, slug]);

  const timeTravelStore = useMemo(
    () => createTimeTravelStateStore(template?.initialState ?? {}),
    [template],
  );
  const telemetryTracker = useMemo(() => createTelemetryTracker(), [template]);

  const safeRegistry = useMemo(() => {
    if (!template) return {};
    return wrapRegistryWithTelemetry(template.catalog, template.registry, {
      telemetryTracker,
      showHealedBadges: true,
    });
  }, [template, telemetryTracker]);

  const [telemetry, setTelemetry] = useState<StreamTelemetrySnapshot>(() =>
    telemetryTracker.getSnapshot(),
  );
  useEffect(() => {
    setTelemetry(telemetryTracker.getSnapshot());
    return telemetryTracker.subscribe(() => {
      setTelemetry(telemetryTracker.getSnapshot());
    });
  }, [telemetryTracker]);

  const compilerRef = useRef<GuardrailedStreamCompiler | null>(null);
  const patchIdRef = useRef(0);
  // Bumped whenever a new spec source takes over the preview (template stream or wireframe
  // compile) so an in-flight line-by-line stream stops overwriting it.
  const streamGenerationRef = useRef(0);
  const [wireframeSnapshot, setWireframeSnapshot] = useState<{
    readonly result: ExcalidrawCompileResult;
    readonly sceneElements: readonly unknown[];
  } | null>(null);
  const [currentSpec, setCurrentSpec] = useState<Spec | null>(() => {
    if ((!instantStreamForTest && !isImmersiveTemplate) || !template) {
      return null;
    }
    const baseSpec =
      template.pageSpecs[firstPageId] ?? Object.values(template.pageSpecs)[0];
    if (!baseSpec) return null;
    const compiler = createGuardrailedStreamCompiler({
      catalog: template.catalog,
      telemetryTracker,
    });
    compiler.push(specToJsonlStream(baseSpec));
    return { ...compiler.finalize().spec };
  });
  const [specHistory, setSpecHistory] = useState<Spec[]>([]);
  const [healedDiagnostics, setHealedDiagnostics] =
    useState<HealedDiagnosticsByElement>({});
  const [patchLog, setPatchLog] = useState<HubPatchLogItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const applyStep = useCallback(
    (step: GuardrailedStreamStepResult, recordHistory = true) => {
      const next = { ...step.spec };
      setCurrentSpec(next);
      setHealedDiagnostics(step.healedDiagnostics);
      if (recordHistory && next.root) {
        setSpecHistory((prev) => [...prev.slice(-24), next]);
      }
    },
    [],
  );

  const streamSpecJsonl = useCallback(
    (jsonl: string, isChaos = false) => {
      if (!template) return;
      const compiler =
        isChaos && compilerRef.current
          ? compilerRef.current
          : createGuardrailedStreamCompiler({
              catalog: template.catalog,
              telemetryTracker,
            });
      compilerRef.current = compiler;

      const lines = jsonl
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (!isChaos) {
        // A template / remix stream replaces the preview, so the last wireframe compile
        // is no longer what the user sees and must not be exported.
        setWireframeSnapshot(null);
      }
      const generation = ++streamGenerationRef.current;

      if (instantStreamForTest || isChaos || isImmersiveTemplate) {
        const step = compiler.push(jsonl);
        const finalStep = isChaos ? step : compiler.finalize();
        applyStep(finalStep);
        setPatchLog((prev) => [
          ...lines.map((rawLine) => ({
            id: ++patchIdRef.current,
            rawLine,
            timestamp: new Date().toISOString().slice(11, 23),
            isChaos,
          })),
          ...(isChaos ? prev : []),
        ]);
        setIsStreaming(false);
        return;
      }

      setIsStreaming(true);
      setPatchLog([]);
      let idx = 0;
      const pushNext = () => {
        if (generation !== streamGenerationRef.current) {
          return;
        }
        if (idx >= lines.length) {
          const finalStep = compiler.finalize();
          applyStep(finalStep);
          setIsStreaming(false);
          return;
        }
        const line = lines[idx++]!;
        const step = compiler.push(line + "\n");
        applyStep(step, false);
        setPatchLog((prev) => [
          {
            id: ++patchIdRef.current,
            rawLine: line,
            timestamp: new Date().toISOString().slice(11, 23),
            isChaos,
          },
          ...prev,
        ]);
        setTimeout(pushNext, 16);
      };
      pushNext();
    },
    [template, telemetryTracker, instantStreamForTest, isImmersiveTemplate, applyStep],
  );

  // Load page spec when template or activePageId changes
  useEffect(() => {
    if (!template) return;
    const baseSpec =
      template.pageSpecs[activePageId] ??
      Object.values(template.pageSpecs)[0] ??
      null;
    if (!baseSpec) return;
    setSpecHistory([]);
    streamSpecJsonl(specToJsonlStream(baseSpec));
  }, [template, activePageId, streamSpecJsonl]);

  const handleSubmitRemixPrompt = useCallback(
    (prompt: string) => {
      if (!template) return;
      const base =
        currentSpec ??
        template.pageSpecs[activePageId] ??
        Object.values(template.pageSpecs)[0];
      if (!base) return;
      const jsonl = template.buildRemixJsonl
        ? template.buildRemixJsonl(prompt, base)
        : defaultRemixSynthesizer(prompt, base);
      streamSpecJsonl(jsonl);
    },
    [template, currentSpec, activePageId, streamSpecJsonl],
  );

  const handleUndoRemix = () => {
    if (specHistory.length < 2) return;
    const previous = specHistory[specHistory.length - 2]!;
    setSpecHistory((prev) => prev.slice(0, -1));
    setCurrentSpec(previous);
  };

  const handleResetSpec = () => {
    if (!template) return;
    const baseSpec =
      template.pageSpecs[activePageId] ?? Object.values(template.pageSpecs)[0];
    if (!baseSpec) return;
    streamSpecJsonl(specToJsonlStream(baseSpec));
  };

  const handleWireframeCompiled = useCallback(
    (result: ExcalidrawCompileResult, sceneElements: readonly unknown[]) => {
      streamGenerationRef.current += 1;
      setIsStreaming(false);
      setWireframeSnapshot({ result, sceneElements });
      const next = { ...result.spec };
      setCurrentSpec(next);
      // Surface props the catalog healed during compile as <DiagnosticHealedBadge /> in the preview.
      const healedByElement: Record<string, (typeof result.propDiagnostics)[number][]> = {};
      for (const d of result.propDiagnostics) {
        if (d.status !== "healed") continue;
        (healedByElement[d.elementKey] ??= []).push(d);
      }
      setHealedDiagnostics(healedByElement);
      setSpecHistory((prev) => [...prev.slice(-24), next]);
      if (result.spec.state?.wireframeBindings) {
        timeTravelStore.set(
          "/wireframeBindings",
          result.spec.state.wireframeBindings,
        );
      }
      setPatchLog((prev) => [
        {
          id: ++patchIdRef.current,
          rawLine: JSON.stringify({
            op: "wireframe_compile",
            nodes: result.compiledNodeCount,
            stateBindings: result.stateBindings.length,
            root: result.spec.root,
          }),
          timestamp: new Date().toISOString().slice(11, 23),
        },
        ...prev.slice(0, 60),
      ]);
    },
    [timeTravelStore],
  );

  const wireframeExport = useMemo(
    () =>
      wireframeSnapshot && template
        ? buildWireframeExport({
            result: wireframeSnapshot.result,
            sceneElements: wireframeSnapshot.sceneElements,
            slug: template.manifest.slug,
            title: template.manifest.title,
          })
        : null,
    [wireframeSnapshot, template],
  );

  const handleInjectChaosPacket = useCallback(() => {
    if (!template) return;
    const rootKey = currentSpec?.root ?? "site-shell";
    const lines = template.buildChaosPackets
      ? template.buildChaosPackets(rootKey)
      : [
          JSON.stringify({
            op: "add",
            path: "/elements/chaos-cycle-node",
            value: {
              type: template.catalog.metadata.componentNames[0] ?? "SiteShell",
              props: {},
              children: ["chaos-cycle-node"],
            },
          }),
          JSON.stringify({
            op: "add",
            path: `/elements/${rootKey}/children/-`,
            value: "chaos-cycle-node",
          }),
        ];
    streamSpecJsonl(lines.join("\n") + "\n", true);
  }, [template, currentSpec, streamSpecJsonl]);

  // Allow Restored Website / immersive widgets to trigger Live Remix or Chaos Self-Healing
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStreamRemix = (ev: Event) => {
      const custom = ev as CustomEvent<{ prompt?: string }>;
      if (custom.detail?.prompt) {
        handleSubmitRemixPrompt(custom.detail.prompt);
      }
    };
    const onInjectChaos = () => {
      handleInjectChaosPacket();
    };
    window.addEventListener("genui:stream-remix", onStreamRemix);
    window.addEventListener("genui:inject-chaos", onInjectChaos);
    return () => {
      window.removeEventListener("genui:stream-remix", onStreamRemix);
      window.removeEventListener("genui:inject-chaos", onInjectChaos);
    };
  }, [handleSubmitRemixPrompt, handleInjectChaosPacket]);

  if (!template) {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] text-[#0B1221] flex items-center justify-center p-4 sm:p-8">
        <div
          data-testid="template-not-found"
          className="hub-bento-card w-full max-w-md p-6 text-center space-y-4 sm:p-8"
        >
          <h1 className="text-xl font-bold text-[#0B1221]">
            Template &quot;{slug}&quot; Not Found
          </h1>
          <p className="text-sm text-[#5B6B82]">
            No Mode A native website or Mode B standalone project is registered
            under slug{" "}
            <code className="font-mono text-xs text-[#2563EB]">{slug}</code>.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[#0B1324] px-5 py-2 font-mono text-xs font-semibold text-white hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            ← Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const templateBaseSpec =
    template.pageSpecs[activePageId] ??
    Object.values(template.pageSpecs)[0] ??
    null;

  const isImmersedHidden =
    isImmersiveTemplate &&
    !immersionHudOpen &&
    !lightModeRestored &&
    !isFullscreen &&
    !isWireframeMode;
  const isFullBleedViewport =
    (isFullscreen || isImmersedHidden) && !isWireframeMode;

  return (
    <div
      className={`min-h-dvh flex flex-col ${
        isFullBleedViewport
          ? isMonochromeArchive
            ? "bg-[#FFFFFF] text-[#000000]"
            : "bg-[#000000] text-zinc-100"
          : "bg-[#F8FAFC] text-[#0B1221]"
      }`}
    >
      {!isImmersedHidden ? (
        <StudioHud
          manifest={template.manifest}
          activePageId={activePageId}
          onSelectPage={setActivePageId}
          viewport={viewport}
          onChangeViewport={setViewport}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          isCollapsed={isHudCollapsed}
          onToggleCollapsed={() => setIsHudCollapsed((v) => !v)}
          isRemixOpen={isRemixOpen}
          onToggleRemix={() => setIsRemixOpen((v) => !v)}
          isWireframeMode={isWireframeMode}
          onToggleWireframe={() => setIsWireframeMode((v) => !v)}
          onOpenXRay={() => setIsXRayOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          onNavigateHome={onNavigateHome}
          patchCount={telemetry.patchCount}
          isStreaming={isStreaming}
          canUndo={specHistory.length > 1}
          onUndo={handleUndoRemix}
          onResetSpec={handleResetSpec}
          onSubmitRemixPrompt={handleSubmitRemixPrompt}
        />
      ) : isCmosBios ? (
        <div
          data-testid="immersion-hud-indicator"
          data-hub-own-design=""
          className="fixed top-2 right-2 z-40 flex max-w-[calc(100vw-1rem)] items-center border-4 border-double border-[#FFFFFF] bg-[#0000AA] px-2 py-0.5 font-mono text-[11px] uppercase text-[#FFFF55] shadow-[4px_4px_0px_#000000]"
        >
          <button
            type="button"
            onClick={() => {
              setImmersionHudOpen(true);
              setIsRemixOpen(true);
            }}
            data-testid="open-immersion-hud-btn"
            aria-label="Open GenUI Studio HUD and export (Alt+G)"
            className="truncate text-left hover:bg-[#AA0000] cursor-pointer"
          >
            [ALT+G] GENUI STUDIO // EXPORT CMOS
          </button>
        </div>
      ) : isChimeraLab ? (
        <div
          data-testid="immersion-hud-indicator"
          data-hub-own-design=""
          className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center rounded-full border border-[rgba(0,245,184,0.25)] bg-[rgba(2,18,24,0.78)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#00F5B8] backdrop-blur-md sm:text-[11px]"
        >
          <button
            type="button"
            onClick={() => {
              setImmersionHudOpen(true);
              setIsRemixOpen(true);
            }}
            data-testid="open-immersion-hud-btn"
            aria-label="Open GenUI Studio HUD and export (Alt+G)"
            className="truncate text-left hover:text-[#FFB000] cursor-pointer"
          >
            [ALT+G] GENUI STUDIO // EXPORT CHIMERA + KIRO CREW APP
          </button>
        </div>
      ) : isMonochromeArchive ? (
        <div
          data-testid="immersion-hud-indicator"
          data-hub-own-design=""
          className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#000000] shadow-[2px_2px_0px_#000000] sm:text-[11px]"
        >
          <button
            type="button"
            onClick={() => {
              setImmersionHudOpen(true);
              setIsRemixOpen(true);
            }}
            data-testid="open-immersion-hud-btn"
            className="truncate text-left hover:underline cursor-pointer"
          >
            [ALT+G] GENUI STUDIO // EXPORT ARCHIVE
          </button>
        </div>
      ) : (
        <div
          data-testid="immersion-hud-indicator"
          data-hub-own-design=""
          className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-full border border-zinc-800/75 bg-black/75 px-3 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur-sm transition hover:border-red-900/70 hover:text-zinc-200"
        >
          <button
            type="button"
            onClick={() => setImmersionHudOpen(true)}
            data-testid="open-immersion-hud-btn"
            className="text-left hover:text-white cursor-pointer"
          >
            Press [Alt+G] for GenUI Studio / Export | [?debug=true] for Debug
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("genui:toggle-debug"));
              }
            }}
            data-testid="toggle-immersion-debug-btn"
            className="rounded border border-zinc-800 bg-zinc-950/90 px-1.5 py-0.5 text-[9px] text-zinc-300 hover:border-red-500/60 hover:text-red-300 cursor-pointer"
          >
            Debug
          </button>
        </div>
      )}

      <main
        className={`flex-1 flex justify-center min-w-0 ${
          isFullBleedViewport ? "p-0" : "p-3 sm:p-5 lg:p-6 bg-[#F8FAFC]"
        }`}
      >
        <div
          className={
            isWireframeMode
              ? "grid w-full max-w-[1760px] grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-5 items-start"
              : "contents"
          }
        >
          {isWireframeMode && (
            <div className="xl:col-span-6 min-w-0">
              <Suspense
                fallback={
                  <div
                    data-testid="wireframe-architect-loading"
                    className="hub-bento-card flex min-h-[640px] items-center justify-center font-mono text-xs text-[#2563EB]"
                  >
                    Loading Wireframe Architect (@excalidraw/excalidraw)...
                  </div>
                }
              >
                <LazyWireframeArchitectCanvas
                  slug={template.manifest.slug}
                  templateTitle={template.manifest.title}
                  catalog={template.catalog}
                  baseSpec={templateBaseSpec}
                  colorScheme={
                    lightModeRestored
                      ? "light"
                      : template.manifest.theme.defaultColorScheme
                  }
                  initialScene={initialWireframeScene}
                  onCompiledSpec={handleWireframeCompiled}
                />
              </Suspense>
            </div>
          )}

          <div
            className={
              isWireframeMode
                ? "xl:col-span-6 flex justify-center min-w-0 w-full"
                : "contents"
            }
          >
            <div
              data-testid="viewport-stage"
              data-viewport={
                isFullscreen
                  ? "fullscreen"
                  : isImmersedHidden
                    ? "immersion"
                    : viewport
              }
              className={`studio-viewport-stage min-w-0 overflow-hidden ${
                isFullBleedViewport
                  ? "w-full min-h-dvh"
                  : `${VIEWPORT_WIDTH_CLASS[viewport]} rounded-2xl border border-[#DCE4F0] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.14)]`
              }`}
            >
              <ScopedTemplateContainer
                slug={template.manifest.slug}
                themeCss={template.themeCss}
                theme={template.manifest.theme}
                colorSchemeOverride={lightModeRestored ? "light" : undefined}
              >
                <JSONUIProvider registry={safeRegistry} store={timeTravelStore}>
                  <SafeGenUIRenderer
                    spec={currentSpec}
                    registry={safeRegistry}
                    catalog={template.catalog}
                    loading={isStreaming}
                    telemetryTracker={telemetryTracker}
                    healedDiagnostics={healedDiagnostics}
                  />
                </JSONUIProvider>
              </ScopedTemplateContainer>
            </div>
          </div>
        </div>
      </main>

      <TemplateXRayDrawer
        isOpen={isXRayOpen}
        onClose={() => setIsXRayOpen(false)}
        templateTitle={template.manifest.title}
        templateSlug={template.manifest.slug}
        catalog={template.catalog}
        telemetry={telemetry}
        patchLog={patchLog}
        currentSpec={currentSpec}
        onInjectChaosPacket={handleInjectChaosPacket}
      />

      <TemplateExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        template={template}
        wireframeExport={wireframeExport}
      />
    </div>
  );
};
