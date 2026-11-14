import React, { useEffect, useRef, useState } from "react";
import { defineRegistry } from "@json-render/react";
import { disposeAfterdarkSoundscape, getAfterdarkSoundscape } from "../audio/soundscape.js";
import { verifiedCatalog } from "../catalog.js";
import { readDebugQueryParam, useAfterdarkStore } from "../store.js";
import { CemeteryWorldCanvas } from "./CemeteryWorld.js";
import { SceneOverlays } from "./SceneOverlays.js";

function checkWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

const AfterdarkViewportExperience: React.FC<{
  readonly experienceTitle: string;
  readonly fogDensity: number;
  readonly darknessLevel: number;
  readonly windStrength: number;
  readonly lightningEnabled: boolean;
  readonly qualityPreset: "low" | "medium" | "high";
  readonly debugMode: boolean;
  readonly lightModeRestoredProp: boolean;
  readonly children?: React.ReactNode;
}> = ({
  fogDensity,
  darknessLevel,
  windStrength,
  lightningEnabled,
  qualityPreset,
  debugMode,
  lightModeRestoredProp,
  children,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const touchLookDeltaRef = useRef({ x: 0, y: 0 });
  const [webGLReady, setWebGLReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const lightModeRestored = useAfterdarkStore((s) => s.lightModeRestored);
  const phase = useAfterdarkStore((s) => s.phase);

  // Sync GenUI Catalog director props (including live RFC 6902 remixes) into Zustand store
  useEffect(() => {
    const urlDebug = readDebugQueryParam();
    useAfterdarkStore.getState().applyDirectorSettings({
      fogDensity,
      darknessLevel,
      windStrength,
      lightningEnabled,
      qualityPreset,
      debugMode: debugMode || urlDebug,
      lightModeRestored: lightModeRestoredProp,
    });
    getAfterdarkSoundscape().setWindIntensity(windStrength);
  }, [
    fogDensity,
    darknessLevel,
    windStrength,
    lightningEnabled,
    qualityPreset,
    debugMode,
    lightModeRestoredProp,
  ]);

  // Mount WebGL only on client browser environments; keep clean SSR fallback
  useEffect(() => {
    setWebGLReady(checkWebGLAvailable());
    return () => {
      disposeAfterdarkSoundscape();
    };
  }, []);

  // Enter key wakes Scene 01 shutdown sequence globally; genui:toggle-debug toggles ?debug=true HUD
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = useAfterdarkStore.getState();
      if (state.phase === "shutdown" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        getAfterdarkSoundscape().initAndStart();
        state.startSequence();
      }
    };
    const onToggleDebug = () => {
      useAfterdarkStore.getState().toggleDebug();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("genui:toggle-debug", onToggleDebug);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("genui:toggle-debug", onToggleDebug);
    };
  }, []);

  // Notify Studio Hub when Light Mode is restored or reset so HUD unlocks cleanly
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("genui:template-light-mode-restored", {
        detail: { slug: "afterdark-horror", restored: lightModeRestored },
      }),
    );
  }, [lightModeRestored]);

  const handleRequestPointerLock = () => {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      const res = canvas.requestPointerLock?.() as Promise<void> | undefined;
      if (res && typeof res.catch === "function") {
        res.catch(() => {});
      }
    } catch {
      // Ignore in unsupported environments
    }
  };

  if (lightModeRestored) {
    return (
      <div
        data-testid="afterdark-restored-editorial"
        className="min-h-dvh w-full bg-[#f8f5ef] text-zinc-900"
      >
        <div className="mx-auto max-w-5xl px-6 py-12 space-y-12">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      data-testid="afterdark-immersion-stage"
      data-phase={phase}
      className="relative h-dvh w-full overflow-hidden bg-[#000000] text-zinc-100"
    >
      {webGLReady && !contextLost ? (
        <CemeteryWorldCanvas
          touchLookDeltaRef={touchLookDeltaRef}
          onContextLost={() => setContextLost(true)}
        />
      ) : (
        <div
          data-testid="afterdark-webgl-fallback"
          className="flex h-full w-full items-center justify-center bg-[#000000] px-6 text-center font-mono text-xs text-zinc-500"
        >
          {contextLost
            ? "WEBGL CONTEXT INTERRUPTED — AUDIO & SEQUENCE STANDBY"
            : "3D CEMETERY ENGINE INITIALIZING"}
        </div>
      )}

      <SceneOverlays
        touchLookDeltaRef={touchLookDeltaRef}
        onRequestPointerLock={handleRequestPointerLock}
      />
    </div>
  );
};

export const { registry: templateComponents } = defineRegistry(
  verifiedCatalog.catalog,
  {
    components: {
      DarknessAndWeatherController: ({ props, children }) => (
        <AfterdarkViewportExperience
          experienceTitle={props.experienceTitle}
          fogDensity={props.fogDensity}
          darknessLevel={props.darknessLevel}
          windStrength={props.windStrength}
          lightningEnabled={props.lightningEnabled}
          qualityPreset={props.qualityPreset}
          debugMode={props.debugMode}
          lightModeRestoredProp={props.lightModeRestored}
        >
          {children}
        </AfterdarkViewportExperience>
      ),

      // World Director metadata nodes (render unobtrusively / active inside 3D world)
      CemeteryZoneCluster: () => null,
      ClueMonumentNode: () => null,
      SupernaturalEncounterTrigger: () => null,
      PhysicalLightModeSwitch: () => null,

      // Restored Illuminated Editorial Website Sections (active when Light Mode is restored)
      RestoredEditorialHero: ({ props }) => (
        <header className="space-y-4 border-b border-zinc-300 pb-8">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-red-800">
            {props.editionLabel}
          </div>
          <h1 className="afterdark-display text-3xl md:text-5xl font-bold tracking-tight text-zinc-950">
            {props.headline}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-zinc-700">
            {props.standfirst}
          </p>
          <button
            type="button"
            onClick={() => useAfterdarkStore.getState().resetExperience()}
            className="min-h-[44px] rounded border border-zinc-900 bg-zinc-900 px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-stone-100 hover:bg-red-900 hover:border-red-900 transition cursor-pointer"
          >
            {props.primaryActionLabel}
          </button>
        </header>
      ),

      EncounterArchiveGrid: ({ props }) => (
        <section className="space-y-4">
          <h2 className="afterdark-display text-xl font-bold text-zinc-900">
            {props.sectionTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {props.entries.map((entry) => (
              <article
                key={entry.code}
                className="rounded border border-zinc-300 bg-white p-5 space-y-2 shadow-sm"
              >
                <div className="font-mono text-[11px] font-bold text-red-800">
                  {entry.code}
                </div>
                <h3 className="text-base font-bold text-zinc-900">
                  {entry.title}
                </h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  {entry.summary}
                </p>
              </article>
            ))}
          </div>
        </section>
      ),

      InteractiveLoreTimeline: ({ props }) => (
        <section className="space-y-4">
          <h2 className="afterdark-display text-xl font-bold text-zinc-900">
            {props.heading}
          </h2>
          <ol className="space-y-4 border-l-2 border-red-800/40 pl-5">
            {props.milestones.map((item) => (
              <li key={item.year} className="space-y-1">
                <span className="font-mono text-xs font-bold text-red-800">
                  {item.year}
                </span>
                <h3 className="text-sm font-bold text-zinc-900">{item.event}</h3>
                <p className="text-sm text-zinc-600">{item.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      ),

      ExperienceReplayFooter: ({ props }) => (
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-300 pt-8 text-xs text-zinc-600">
          <div className="space-y-1">
            <p className="font-semibold text-zinc-800">{props.colophon}</p>
            <p className="font-mono text-[11px]">{props.hardwareNote}</p>
          </div>
          <button
            type="button"
            onClick={() => useAfterdarkStore.getState().resetExperience()}
            className="min-h-[44px] rounded border border-red-900/40 px-4 py-2 font-mono text-xs font-semibold text-red-900 hover:bg-red-900 hover:text-white transition cursor-pointer"
          >
            {props.replayButtonLabel}
          </button>
        </footer>
      ),
    },
    actions: {},
  },
);
