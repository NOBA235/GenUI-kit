import React, { useEffect, useRef, useState } from "react";
import { defineRegistry } from "@json-render/react";
import { disposeAfterdarkSoundscape, getAfterdarkSoundscape } from "../audio/soundscape.js";
import { verifiedCatalog } from "../catalog.js";
import { CLUE_RECORDS, ENCOUNTER_DEFINITIONS } from "../engine/world-data.js";
import { readDebugQueryParam, useAfterdarkStore } from "../store.js";
import type { LightingPreviewPreset } from "../types.js";
import { CemeteryWorldCanvas } from "./CemeteryWorld.js";
import { SceneOverlays } from "./SceneOverlays.js";

const ZONE_LORE_ARCHIVE = [
  {
    code: "ZONE A",
    zoneId: "gatehouse",
    title: "The Wrought-Iron Gatehouse",
    summary:
      "Twin stone sentinel pillars and iron hinges that seal behind the visitor after the 2:17 AM approach dolly.",
  },
  {
    code: "ZONE B",
    zoneId: "forgotten_graves",
    title: "Forgotten Graves & Lancet Rows",
    summary:
      "Instanced granite lancets, obelisks, Celtic crosses, and Clue 01 where The Watcher stalks between rows.",
  },
  {
    code: "ZONE C",
    zoneId: "dead_garden",
    title: "The Dead Garden Fountain",
    summary:
      "Shattered aqueduct centerpiece veiled in low fog, concealing the northern Caretaker lectern behind the basin.",
  },
  {
    code: "ZONE D",
    zoneId: "chapel_steps",
    title: "Abandoned Gothic Chapel",
    summary:
      "Enterable sanctuary nave lit by crimson stained glass, holding Clue 02 on the marble altar above the crypt stairs.",
  },
  {
    code: "ZONE E",
    zoneId: "crypt_entrance",
    title: "Subterranean Sarcophagi Crypt",
    summary:
      "Flood-prone limestone corridors housing four sealed sarcophagi and the concealed cast-iron LIGHT MODE breaker.",
  },
] as const;

const LIGHTING_PRESET_SPECS: Readonly<
  Record<
    LightingPreviewPreset,
    {
      readonly label: string;
      readonly swatchBg: string;
      readonly swatchFg: string;
      readonly fogDensity: string;
      readonly keyLight: string;
      readonly notes: string;
    }
  >
> = {
  storm: {
    label: "2:17 AM Storm Lightning",
    swatchBg: "#05070d",
    swatchFg: "#93c5fd",
    fogDensity: "0.056 Exp2",
    keyLight: "Cold Lunar #8DA6D6 + 7.5s Lightning Pulse",
    notes: "Maximum perimeter darkness with warm iron lantern pools anchored along Zone B.",
  },
  crypt: {
    label: "Subterranean Crypt Candle",
    swatchBg: "#120c08",
    swatchFg: "#f59e0b",
    fogDensity: "0.078 Exp2",
    keyLight: "Sub-Station Amber #D97706 + Wax Tapers",
    notes: "Blocked moonlight (-4.5m Y depth); damp stone glow radiating off the Zone E breaker box.",
  },
  dawn: {
    label: "Restored 06:14 AM Dawn",
    swatchBg: "#FAF9F5",
    swatchFg: "#0A0A0C",
    fogDensity: "0.008 Exp2",
    keyLight: "Warm Dawn Sun #FEF3C7 (1.75x) + Clear Sky",
    notes: "Full 10-Stage breaker surge dissolving volumetric fog into archival stone-white daylight.",
  },
};

function formatDurationMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

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
  const prevLightPropRef = useRef(lightModeRestoredProp);

  // Sync GenUI Catalog director props (including live RFC 6902 remixes) into Zustand store
  // Guard against initial mount overwriting localStorage-persisted lightModeRestored = true
  useEffect(() => {
    const urlDebug = readDebugQueryParam();
    const shouldSyncLightProp =
      lightModeRestoredProp === true ||
      (prevLightPropRef.current === true && lightModeRestoredProp === false);
    prevLightPropRef.current = lightModeRestoredProp;

    useAfterdarkStore.getState().applyDirectorSettings({
      fogDensity,
      darknessLevel,
      windStrength,
      lightningEnabled,
      qualityPreset,
      debugMode: debugMode || urlDebug,
      ...(shouldSyncLightProp ? { lightModeRestored: lightModeRestoredProp } : {}),
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
        className="min-h-dvh w-full bg-[#FAF9F5] text-[#0A0A0C]"
      >
        {/* Sticky Swiss Masthead with Physical-Style Plunge Back Into Darkness Switch */}
        <nav
          data-testid="afterdark-restored-header"
          className="sticky top-0 z-20 border-b border-[#0A0A0C]/15 bg-[#FAF9F5]/95 backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A0A0C]">
                AFTERDARK 2.0 // RAVENSHALLOW
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-900">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                LIGHT MODE: ON
              </span>
            </div>

            <button
              type="button"
              data-testid="afterdark-plunge-darkness-btn"
              onClick={() => useAfterdarkStore.getState().plungeBackIntoDarkness()}
              className="group inline-flex min-h-[40px] items-center gap-3 rounded-full border border-[#0A0A0C] bg-[#0A0A0C] px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F5] hover:bg-red-900 hover:border-red-900 transition cursor-pointer"
            >
              <span
                aria-hidden="true"
                className="flex h-4 w-8 items-center rounded-full bg-emerald-500/30 p-0.5 transition group-hover:bg-red-500/40"
              >
                <span className="h-3 w-3 translate-x-4 rounded-full bg-[#FAF9F5] transition-transform group-hover:translate-x-0" />
              </span>
              Plunge Back Into Darkness
            </button>
          </div>
        </nav>

        <div className="mx-auto max-w-6xl px-6 py-12 space-y-14">
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
      RestoredEditorialHero: ({ props }) => {
        const discoveredClues = useAfterdarkStore((s) => s.discoveredClues);
        const triggeredEncounters = useAfterdarkStore((s) => s.triggeredEncounters);
        const timeSpentDarkSeconds = useAfterdarkStore((s) => s.timeSpentDarkSeconds);
        const distanceWalkedMeters = useAfterdarkStore((s) => s.distanceWalkedMeters);

        return (
          <header className="space-y-10 border-b border-[#0A0A0C]/15 pb-12">
            <div className="space-y-4">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-red-900">
                {props.editionLabel}
              </div>
              <h1 className="afterdark-display text-4xl md:text-6xl font-black tracking-tight text-[#0A0A0C]">
                {props.headline}
              </h1>
              <p className="afterdark-display text-xl md:text-2xl font-bold tracking-tight text-red-900">
                BUT DID YOU REALLY LEAVE?
              </p>
              <p className="max-w-3xl text-base leading-relaxed text-zinc-700">
                {props.standfirst}
              </p>
            </div>

            {/* Interactive Survival Run Telemetry & Dossier */}
            <section
              data-testid="afterdark-run-dossier"
              aria-label="Survival Run Telemetry Dossier"
              className="rounded-xl border border-[#0A0A0C]/15 bg-white p-6 shadow-sm space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A0A0C]/10 pb-3">
                <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0A0A0C]">
                  SURVIVAL TELEMETRY &amp; INVESTIGATION DOSSIER
                </h2>
                <span className="font-mono text-[11px] text-zinc-500">
                  PERSISTED LOCAL ARCHIVE RECORD
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-[#0A0A0C]/10 bg-[#FAF9F5] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Time Spent in the Dark
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[#0A0A0C]">
                    {formatDurationMMSS(timeSpentDarkSeconds)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#0A0A0C]/10 bg-[#FAF9F5] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Clues Uncovered
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[#0A0A0C]">
                    {discoveredClues.length}/3
                  </div>
                </div>
                <div className="rounded-lg border border-[#0A0A0C]/10 bg-[#FAF9F5] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Encounters Witnessed
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[#0A0A0C]">
                    {triggeredEncounters.length}/5
                  </div>
                </div>
                <div className="rounded-lg border border-[#0A0A0C]/10 bg-[#FAF9F5] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Distance Walked
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[#0A0A0C]">
                    {distanceWalkedMeters.toFixed(1)} m
                  </div>
                </div>
              </div>

              {/* 3-Clue Deciphered Evidence Record */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CLUE_RECORDS.map((clue) => {
                  const found = discoveredClues.includes(clue.id);
                  return (
                    <div
                      key={clue.id}
                      className={`rounded-lg border p-3.5 text-xs space-y-1 ${
                        found
                          ? "border-amber-700/35 bg-amber-50/70 text-[#0A0A0C]"
                          : "border-[#0A0A0C]/10 bg-[#FAF9F5] text-zinc-500"
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                        <span>{clue.numberLabel}</span>
                        <span>{found ? "DECIPHERED" : "UNEXAMINED"}</span>
                      </div>
                      <div className="font-semibold text-[#0A0A0C]">{clue.title}</div>
                      <p className="italic leading-relaxed">
                        {found
                          ? `“${clue.inscription}”`
                          : "Located in " + clue.zoneLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Direct GenUI Live Remix & Zod Self-Healing Triggers */}
            <div
              data-testid="afterdark-restored-remix-bar"
              className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#0A0A0C]/15 bg-[#0A0A0C]/[0.03] p-4"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 mr-1">
                GENUI LIVE REMIX:
              </span>
              <button
                type="button"
                onClick={() => {
                  if (typeof window === "undefined") return;
                  window.dispatchEvent(
                    new CustomEvent("genui:stream-remix", {
                      detail: { prompt: "Remix Horror Preset: Blood Moon Storm" },
                    }),
                  );
                }}
                className="rounded-lg border border-[#0A0A0C]/20 bg-white px-3 py-1.5 font-mono text-[11px] font-semibold text-[#0A0A0C] hover:border-red-800 hover:text-red-900 transition cursor-pointer"
              >
                Remix Horror Preset: Blood Moon Storm
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window === "undefined") return;
                  window.dispatchEvent(
                    new CustomEvent("genui:stream-remix", {
                      detail: { prompt: "Remix Restored Site into Brutalist Archive" },
                    }),
                  );
                }}
                className="rounded-lg border border-[#0A0A0C]/20 bg-white px-3 py-1.5 font-mono text-[11px] font-semibold text-[#0A0A0C] hover:border-[#0A0A0C] transition cursor-pointer"
              >
                Remix Restored Site into Brutalist Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window === "undefined") return;
                  window.dispatchEvent(new CustomEvent("genui:inject-chaos"));
                }}
                className="rounded-lg border border-amber-700/40 bg-amber-50 px-3 py-1.5 font-mono text-[11px] font-semibold text-amber-950 hover:bg-amber-100 transition cursor-pointer"
              >
                Inject Corrupted Encounter Coordinate Packet
              </button>
            </div>

            <button
              type="button"
              onClick={() => useAfterdarkStore.getState().plungeBackIntoDarkness()}
              className="min-h-[44px] rounded border border-[#0A0A0C] bg-[#0A0A0C] px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-[#FAF9F5] hover:bg-red-900 hover:border-red-900 transition cursor-pointer"
            >
              {props.primaryActionLabel}
            </button>
          </header>
        );
      },

      EncounterArchiveGrid: ({ props }) => {
        const [activeTab, setActiveTab] = useState<"all" | "entities" | "zones">("all");
        const triggeredEncounters = useAfterdarkStore((s) => s.triggeredEncounters);
        const lightingPreview = useAfterdarkStore((s) => s.lightingPreview);
        const activePreset = LIGHTING_PRESET_SPECS[lightingPreview];

        return (
          <section className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="afterdark-display text-2xl font-bold text-[#0A0A0C]">
                  {props.sectionTitle}
                </h2>
                <p className="text-sm text-zinc-600">
                  Inspect all 5 Supernatural Entities, 5 Cemetery Zones (A–E), and 3D Lighting rigs.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-[#0A0A0C]/15 bg-white p-1 font-mono text-[11px]">
                {(
                  [
                    ["all", "All Archive"],
                    ["entities", "5 Entities"],
                    ["zones", "5 Zones (A–E)"],
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setActiveTab(tabKey)}
                    className={`rounded px-3 py-1 transition cursor-pointer ${
                      activeTab === tabKey
                        ? "bg-[#0A0A0C] text-[#FAF9F5] font-semibold"
                        : "text-zinc-600 hover:text-[#0A0A0C]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive 3D Lighting Preview Switcher */}
            <div className="rounded-xl border border-[#0A0A0C]/15 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  3D LIGHTING RIG PREVIEW ({activePreset.fogDensity})
                </div>
                <div className="text-sm font-bold text-[#0A0A0C]">
                  {activePreset.label} — {activePreset.keyLight}
                </div>
                <p className="text-xs text-zinc-600">{activePreset.notes}</p>
              </div>

              <div className="flex items-center gap-2">
                <div
                  aria-label={`Lighting swatch ${activePreset.label}`}
                  className="h-9 w-9 rounded-lg border border-[#0A0A0C]/20 flex items-center justify-center font-mono text-[10px] font-bold"
                  style={{
                    backgroundColor: activePreset.swatchBg,
                    color: activePreset.swatchFg,
                  }}
                >
                  FX
                </div>
                {(["storm", "crypt", "dawn"] as const).map((presetKey) => (
                  <button
                    key={presetKey}
                    type="button"
                    data-testid={`afterdark-lighting-toggle-${presetKey}`}
                    onClick={() =>
                      useAfterdarkStore.getState().setLightingPreview(presetKey)
                    }
                    className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase transition cursor-pointer ${
                      lightingPreview === presetKey
                        ? "border-[#0A0A0C] bg-[#0A0A0C] text-[#FAF9F5] font-semibold"
                        : "border-[#0A0A0C]/20 bg-[#FAF9F5] text-zinc-700 hover:border-[#0A0A0C]"
                    }`}
                  >
                    {presetKey}
                  </button>
                ))}
              </div>
            </div>

            {(activeTab === "all" || activeTab === "entities") && (
              <div className="space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-red-900">
                  CATALOGED SUPERNATURAL ENTITIES (5)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ENCOUNTER_DEFINITIONS.map((enc) => {
                    const seen = triggeredEncounters.includes(enc.id);
                    return (
                      <article
                        key={enc.id}
                        className="rounded-lg border border-[#0A0A0C]/15 bg-white p-4 space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                          <span className="text-red-900">{enc.code}</span>
                          <span
                            className={
                              seen ? "text-emerald-800" : "text-zinc-400"
                            }
                          >
                            {seen ? "WITNESSED" : "DORMANT"}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-[#0A0A0C]">
                          {enc.name}
                        </h4>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          “{enc.whisperLine}”
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {(activeTab === "all" || activeTab === "zones") && (
              <div className="space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#0A0A0C]">
                  CEMETERY ARCHITECTURAL ZONES (A–E)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ZONE_LORE_ARCHIVE.map((zone) => (
                    <article
                      key={zone.code}
                      className="rounded-lg border border-[#0A0A0C]/15 bg-white p-4 space-y-2 shadow-sm"
                    >
                      <div className="font-mono text-[10px] font-bold text-red-900">
                        {zone.code}
                      </div>
                      <h4 className="text-base font-bold text-[#0A0A0C]">
                        {zone.title}
                      </h4>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {zone.summary}
                      </p>
                    </article>
                  ))}
                  {props.entries.map((entry) => (
                    <article
                      key={entry.code}
                      className="rounded-lg border border-[#0A0A0C]/10 bg-[#FAF9F5] p-4 space-y-1.5"
                    >
                      <div className="font-mono text-[10px] font-bold text-zinc-500">
                        {entry.code}
                      </div>
                      <h4 className="text-sm font-bold text-[#0A0A0C]">
                        {entry.title}
                      </h4>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {entry.summary}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      },

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
            onClick={() => useAfterdarkStore.getState().plungeBackIntoDarkness()}
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
