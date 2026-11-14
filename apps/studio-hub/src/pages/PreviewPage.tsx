import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export interface PreviewPageProps {
  readonly slug: string;
  readonly isFullscreen: boolean;
  readonly onToggleFullscreen: () => void;
  readonly onNavigateHome: () => void;
  readonly instantStreamForTest?: boolean;
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

export const PreviewPage: React.FC<PreviewPageProps> = ({
  slug,
  isFullscreen,
  onToggleFullscreen,
  onNavigateHome,
  instantStreamForTest = false,
}) => {
  const template = useMemo(() => getTemplateBySlug(slug), [slug]);

  const isImmersiveTemplate = Boolean(template?.manifest.immersiveExperience);
  const [viewport, setViewport] = useState<ViewportPreset>("desktop");
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [immersionHudOpen, setImmersionHudOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("hud") === "true";
  });
  const [lightModeRestored, setLightModeRestored] = useState(false);
  const wasPointerLockedRef = useRef(false);
  const [isRemixOpen, setIsRemixOpen] = useState(false);
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const firstPageId = template?.manifest.pages[0]?.id ?? "home";
  const [activePageId, setActivePageId] = useState<string>(firstPageId);

  useEffect(() => {
    setActivePageId(template?.manifest.pages[0]?.id ?? "home");
    setImmersionHudOpen(
      typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("hud") === "true",
    );
    setLightModeRestored(false);
    wasPointerLockedRef.current = false;
  }, [slug, template]);

  // Immersion Mode hotkeys ([Alt+G]), Pointer Lock ESC release recovery, and Light Mode reveal
  useEffect(() => {
    if (!isImmersiveTemplate || typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setImmersionHudOpen((v) => !v);
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

  const handleInjectChaosPacket = () => {
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
  };

  if (!template) {
    return (
      <div className="min-h-dvh bg-[#060911] text-slate-100 flex items-center justify-center p-8">
        <div
          data-testid="template-not-found"
          className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-4"
        >
          <h1 className="text-xl font-bold">Template &quot;{slug}&quot; Not Found</h1>
          <p className="text-sm text-slate-400">
            No Mode A native website or Mode B standalone project is registered
            under slug <code className="text-cyan-300">{slug}</code>.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="rounded-lg bg-cyan-500 px-4 py-2 font-mono text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition cursor-pointer"
          >
            ← Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const isImmersedHidden =
    isImmersiveTemplate && !immersionHudOpen && !lightModeRestored && !isFullscreen;
  const isFullBleedViewport = isFullscreen || isImmersedHidden;

  return (
    <div
      className={`min-h-dvh flex flex-col ${
        isFullBleedViewport
          ? "bg-[#000000] text-zinc-100"
          : "bg-[#060911] text-slate-100"
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
      ) : (
        <div
          data-testid="immersion-hud-indicator"
          className="fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-full border border-zinc-800/75 bg-black/75 px-3 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur-sm transition hover:border-red-900/70 hover:text-zinc-200"
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
        className={`flex-1 flex justify-center ${
          isFullBleedViewport ? "p-0" : "p-4 md:p-6 bg-slate-950/60"
        }`}
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
          className={`studio-viewport-stage overflow-hidden ${
            isFullBleedViewport
              ? "w-full min-h-dvh"
              : `${VIEWPORT_WIDTH_CLASS[viewport]} rounded-2xl border border-slate-800 shadow-2xl`
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
      />
    </div>
  );
};
