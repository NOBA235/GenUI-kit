import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ARCADE_ACHIEVEMENTS,
  ARCADE_CANVAS_H,
  ARCADE_CANVAS_W,
  ARCADE_CARTRIDGES,
  DEFAULT_ARCADE_PALETTE,
  createBreakGridState,
  createPacketInvadersState,
  createSerpentState,
  getSerpentTickMs,
  playArcadeSfx,
  queueSerpentDirection,
  renderBreakGridCanvas,
  renderPacketInvadersCanvas,
  renderSerpentCanvas,
  stepBreakGridState,
  stepPacketInvadersState,
  stepSerpentState,
  type ArcadeCartridgeId,
  type ArcadeDifficultyPreset,
  type ArcadeGameStatus,
  type ArcadePaletteColors,
  type BreakGridState,
  type PacketInvadersState,
  type SerpentDirection,
  type SerpentState,
} from "../arcade/index.js";
import { getEntryBySlug, getEntryPhoto } from "../lib/archive/api.js";
import { useNinety9OperatorName, useNinety9Store } from "../store.js";
import { ArchivalMediaPlate } from "./ArchivalMediaPlate.js";

export interface ArcadeCabinetSectionProps {
  readonly heading: string;
  readonly defaultGame: ArcadeCartridgeId;
  readonly difficultyPreset: ArcadeDifficultyPreset;
  readonly paddleWidth: number;
  readonly ballSpeed: number;
  readonly snakeGridSize: number;
  readonly invaderRows: number;
  readonly inkHex: string;
  readonly surfaceHex: string;
  readonly linkedDossierSlug: string;
}

const VALID_MONO_SET = new Set<string>([
  "#FFFFFF",
  "#000000",
  "#D9D9D9",
  "#808080",
  "#292929",
]);

function resolveArcadePalette(inkHex: string, surfaceHex: string): ArcadePaletteColors {
  const safeInk = VALID_MONO_SET.has(inkHex) ? inkHex : "#000000";
  let safeSurface = VALID_MONO_SET.has(surfaceHex) ? surfaceHex : "#FFFFFF";
  if (safeInk === safeSurface) {
    safeSurface = safeInk === "#000000" ? "#FFFFFF" : "#000000";
  }
  if (safeSurface === "#000000") {
    return {
      surface: "#000000",
      ink: "#FFFFFF",
      light: "#292929",
      mid: "#808080",
      dark: "#D9D9D9",
    };
  }
  return {
    ...DEFAULT_ARCADE_PALETTE,
    surface: safeSurface,
    ink: safeInk,
  };
}

export const ArcadeView: React.FC<ArcadeCabinetSectionProps> = ({
  heading,
  defaultGame,
  difficultyPreset,
  paddleWidth,
  ballSpeed,
  snakeGridSize,
  invaderRows,
  inkHex,
  surfaceHex,
  linkedDossierSlug,
}) => {
  const operatorName = useNinety9OperatorName();
  const activeView = useNinety9Store((s) => s.activeView);
  const activeCartridge = useNinety9Store((s) => s.activeArcadeCartridge);
  const arcadeBootNonce = useNinety9Store((s) => s.arcadeBootNonce);
  const highScores = useNinety9Store((s) => s.arcadeHighScores);
  const achievements = useNinety9Store((s) => s.arcadeAchievements);
  const arcadeMuted = useNinety9Store((s) => s.arcadeMuted);
  const selectArcadeCartridge = useNinety9Store((s) => s.selectArcadeCartridge);
  const recordArcadeScore = useNinety9Store((s) => s.recordArcadeScore);
  const toggleArcadeMute = useNinety9Store((s) => s.toggleArcadeMute);
  const resetArcadeProgress = useNinety9Store((s) => s.resetArcadeProgress);
  const openDossier = useNinety9Store((s) => s.openDossier);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heldMoveRef = useRef<-1 | 0 | 1>(0);
  const fireQueuedRef = useRef<boolean>(false);

  const [serpentState, setSerpentState] = useState<SerpentState>(() =>
    createSerpentState({ gridSize: snakeGridSize, difficultyPreset })
  );
  const [breakState, setBreakState] = useState<BreakGridState>(() =>
    createBreakGridState({ paddleWidth, ballSpeed, difficultyPreset })
  );
  const [invadersState, setInvadersState] = useState<PacketInvadersState>(() =>
    createPacketInvadersState({ invaderRows, difficultyPreset })
  );

  const serpentRef = useRef(serpentState);
  const breakRef = useRef(breakState);
  const invadersRef = useRef(invadersState);
  serpentRef.current = serpentState;
  breakRef.current = breakState;
  invadersRef.current = invadersState;

  const [announcement, setAnnouncement] = useState<string>(
    "WORKSTATION ARCADE IDLE. SELECT CARTRIDGE AND PRESS BOOT CARTRIDGE."
  );

  // Sync cartridge selector when catalog defaultGame prop changes via GenUI Remix
  const prevDefaultGameRef = useRef<ArcadeCartridgeId>(defaultGame);
  useEffect(() => {
    if (prevDefaultGameRef.current !== defaultGame) {
      prevDefaultGameRef.current = defaultGame;
      selectArcadeCartridge(defaultGame);
    }
  }, [defaultGame, selectArcadeCartridge]);

  // Rebuild cartridges cleanly when GenUI Remix streams new physics/grid parameters
  useEffect(() => {
    setSerpentState(createSerpentState({ gridSize: snakeGridSize, difficultyPreset }));
    setBreakState(createBreakGridState({ paddleWidth, ballSpeed, difficultyPreset }));
    setInvadersState(createPacketInvadersState({ invaderRows, difficultyPreset }));
  }, [difficultyPreset, paddleWidth, ballSpeed, snakeGridSize, invaderRows]);

  const currentCartMeta =
    ARCADE_CARTRIDGES.find((c) => c.id === activeCartridge) ?? ARCADE_CARTRIDGES[0]!;
  const linkedEntry =
    getEntryBySlug(linkedDossierSlug) ?? getEntryBySlug(currentCartMeta.linkedDossierSlug);
  const linkedEntryPhoto = linkedEntry ? getEntryPhoto(linkedEntry.slug) : undefined;

  const activeStatus: ArcadeGameStatus =
    activeCartridge === "serpent-98"
      ? serpentState.status
      : activeCartridge === "break-grid"
        ? breakState.status
        : invadersState.status;

  const currentScore =
    activeCartridge === "serpent-98"
      ? serpentState.score
      : activeCartridge === "break-grid"
        ? breakState.score
        : invadersState.score;

  const currentWaveOrLevel =
    activeCartridge === "serpent-98"
      ? serpentState.level
      : activeCartridge === "break-grid"
        ? breakState.wave
        : invadersState.wave;

  const currentLives =
    activeCartridge === "serpent-98"
      ? serpentState.status === "gameover"
        ? 0
        : 1
      : activeCartridge === "break-grid"
        ? breakState.lives
        : invadersState.lives;

  const palette = resolveArcadePalette(inkHex, surfaceHex);

  // Draw current cartridge buffer to <canvas>
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activeCartridge === "serpent-98") {
      renderSerpentCanvas(ctx, serpentState, palette);
    } else if (activeCartridge === "break-grid") {
      renderBreakGridCanvas(ctx, breakState, palette);
    } else {
      renderPacketInvadersCanvas(ctx, invadersState, palette);
    }
  }, [activeCartridge, serpentState, breakState, invadersState, palette]);

  const emitScoreIfNeeded = useCallback(
    (cartridge: ArcadeCartridgeId, score: number, reason: string) => {
      const isRecord = recordArcadeScore(cartridge, score);
      setAnnouncement(
        isRecord
          ? `${reason}. NEW HIGH SCORE RECORDED: ${score} PTS.`
          : `${reason}. FINAL SCORE: ${score} PTS.`
      );
    },
    [recordArcadeScore]
  );

  const handleStartOrResume = useCallback(() => {
    playArcadeSfx("boot", arcadeMuted);
    if (activeCartridge === "serpent-98") {
      const prev = serpentRef.current;
      const next =
        prev.status === "ready" || prev.status === "gameover"
          ? {
              ...createSerpentState({ gridSize: snakeGridSize, difficultyPreset }),
              status: "playing" as const,
            }
          : { ...prev, status: "playing" as const };
      setSerpentState(next);
      recordArcadeScore("serpent-98", next.score);
      setAnnouncement("SERPENT-98 RUNNING. USE ARROW KEYS OR D-PAD TO STEER.");
      return;
    }

    if (activeCartridge === "break-grid") {
      const prev = breakRef.current;
      const next =
        prev.status === "ready" || prev.status === "gameover"
          ? {
              ...createBreakGridState({ paddleWidth, ballSpeed, difficultyPreset }),
              status: "playing" as const,
              launched: true,
            }
          : { ...prev, status: "playing" as const, launched: true };
      setBreakState(next);
      recordArcadeScore("break-grid", next.score);
      setAnnouncement("BREAK-GRID RUNNING. SLIDE PADDLE LEFT OR RIGHT.");
      return;
    }

    const prev = invadersRef.current;
    const next =
      prev.status === "ready" || prev.status === "gameover"
        ? {
            ...createPacketInvadersState({ invaderRows, difficultyPreset }),
            status: "playing" as const,
          }
        : { ...prev, status: "playing" as const };
    setInvadersState(next);
    recordArcadeScore("packet-invaders", next.score);
    setAnnouncement("PACKET INVADERS RUNNING. STRAFE AND FIRE LASER.");
  }, [
    activeCartridge,
    arcadeMuted,
    ballSpeed,
    difficultyPreset,
    invaderRows,
    paddleWidth,
    recordArcadeScore,
    snakeGridSize,
  ]);

  const handlePauseToggle = useCallback(() => {
    if (activeStatus === "playing") {
      if (activeCartridge === "serpent-98") {
        setSerpentState((s) => ({ ...s, status: "paused" }));
      } else if (activeCartridge === "break-grid") {
        setBreakState((s) => ({ ...s, status: "paused" }));
      } else {
        setInvadersState((s) => ({ ...s, status: "paused" }));
      }
      setAnnouncement(`${currentCartMeta.title} PAUSED.`);
      return;
    }
    handleStartOrResume();
  }, [activeCartridge, activeStatus, currentCartMeta.title, handleStartOrResume]);

  const handleResetCartridge = useCallback(() => {
    heldMoveRef.current = 0;
    fireQueuedRef.current = false;
    if (activeCartridge === "serpent-98") {
      setSerpentState(createSerpentState({ gridSize: snakeGridSize, difficultyPreset }));
    } else if (activeCartridge === "break-grid") {
      setBreakState(createBreakGridState({ paddleWidth, ballSpeed, difficultyPreset }));
    } else {
      setInvadersState(createPacketInvadersState({ invaderRows, difficultyPreset }));
    }
    setAnnouncement(`${currentCartMeta.title} RESET TO READY STATE.`);
  }, [
    activeCartridge,
    ballSpeed,
    currentCartMeta.title,
    difficultyPreset,
    invaderRows,
    paddleWidth,
    snakeGridSize,
  ]);

  const handleCartridgeSelect = useCallback(
    (id: ArcadeCartridgeId) => {
      // Pause currently active cartridge cleanly before switching slots
      if (activeStatus === "playing") {
        if (activeCartridge === "serpent-98") {
          setSerpentState((s) => ({ ...s, status: "paused" }));
        } else if (activeCartridge === "break-grid") {
          setBreakState((s) => ({ ...s, status: "paused" }));
        } else {
          setInvadersState((s) => ({ ...s, status: "paused" }));
        }
      }
      heldMoveRef.current = 0;
      fireQueuedRef.current = false;
      selectArcadeCartridge(id);
      const nextMeta = ARCADE_CARTRIDGES.find((c) => c.id === id);
      if (nextMeta) {
        setAnnouncement(`LOADED ${nextMeta.code}: ${nextMeta.title}. PRESS BOOT CARTRIDGE.`);
      }
    },
    [activeCartridge, activeStatus, selectArcadeCartridge]
  );

  // SERPENT-98 Discrete Tick Interval
  useEffect(() => {
    if (activeCartridge !== "serpent-98" || serpentState.status !== "playing") {
      return;
    }
    const tickMs = getSerpentTickMs(serpentState);
    const timer = window.setInterval(() => {
      const current = serpentRef.current;
      if (current.status !== "playing") return;
      const { nextState, sfx } = stepSerpentState(current);
      for (const ev of sfx) {
        playArcadeSfx(ev, arcadeMuted);
      }
      if (nextState.level > current.level) {
        setAnnouncement(`SERPENT-98 LEVEL ${nextState.level}. SPEED INCREASED.`);
      }
      if (nextState.status === "gameover") {
        emitScoreIfNeeded("serpent-98", nextState.score, "SERPENT-98 HALTED");
      } else if (nextState.score > current.score) {
        recordArcadeScore("serpent-98", nextState.score);
      }
      setSerpentState(nextState);
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [activeCartridge, arcadeMuted, emitScoreIfNeeded, recordArcadeScore, serpentState]);

  // BREAK-GRID & PACKET INVADERS Fixed 50ms Simulation Tick Loop (~20 FPS crisp workstation step)
  useEffect(() => {
    const isBreakPlaying =
      activeCartridge === "break-grid" && breakState.status === "playing";
    const isInvadersPlaying =
      activeCartridge === "packet-invaders" && invadersState.status === "playing";
    if (!isBreakPlaying && !isInvadersPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      if (activeCartridge === "break-grid") {
        const current = breakRef.current;
        if (current.status !== "playing") return;
        const launch = fireQueuedRef.current;
        fireQueuedRef.current = false;
        const { nextState, sfx } = stepBreakGridState(current, {
          move: heldMoveRef.current,
          launch,
        });
        for (const ev of sfx) {
          playArcadeSfx(ev, arcadeMuted);
        }
        if (nextState.wave > current.wave) {
          recordArcadeScore("break-grid", nextState.score);
          setAnnouncement(`BREAK-GRID WAVE ${nextState.wave} CLEARED.`);
        }
        if (nextState.status === "gameover") {
          emitScoreIfNeeded("break-grid", nextState.score, "BREAK-GRID GAME OVER");
        } else if (nextState.score > current.score) {
          recordArcadeScore("break-grid", nextState.score);
        }
        setBreakState(nextState);
        return;
      }

      if (activeCartridge === "packet-invaders") {
        const current = invadersRef.current;
        if (current.status !== "playing") return;
        const fire = fireQueuedRef.current;
        fireQueuedRef.current = false;
        const { nextState, sfx } = stepPacketInvadersState(current, {
          move: heldMoveRef.current,
          fire,
        });
        for (const ev of sfx) {
          playArcadeSfx(ev, arcadeMuted);
        }
        if (nextState.wave > current.wave) {
          recordArcadeScore("packet-invaders", nextState.score);
          setAnnouncement(`PACKET INVADERS WAVE ${nextState.wave} ENGAGED.`);
        }
        if (nextState.status === "gameover") {
          emitScoreIfNeeded("packet-invaders", nextState.score, "FIREWALL BREACHED");
        } else if (nextState.score > current.score) {
          recordArcadeScore("packet-invaders", nextState.score);
        }
        setInvadersState(nextState);
      }
    }, 34);

    return () => window.clearInterval(timer);
  }, [
    activeCartridge,
    arcadeMuted,
    breakState.status,
    emitScoreIfNeeded,
    invadersState.status,
    recordArcadeScore,
  ]);

  // Auto-boot active cartridge when Hero quick-launch triggers arcadeBootNonce
  const prevBootNonceRef = useRef<number>(arcadeBootNonce);
  useEffect(() => {
    if (arcadeBootNonce > prevBootNonceRef.current) {
      prevBootNonceRef.current = arcadeBootNonce;
      if (operatorName !== null) {
        handleStartOrResume();
      }
    }
  }, [arcadeBootNonce, handleStartOrResume, operatorName]);

  // Global Keyboard Control Scoped Away From Text Inputs
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (operatorName === null) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "p") {
        handlePauseToggle();
        return;
      }
      if (key === "r") {
        handleResetCartridge();
        return;
      }

      if (activeStatus !== "playing") {
        return;
      }

      if (
        key === "arrowup" ||
        key === "arrowdown" ||
        key === "arrowleft" ||
        key === "arrowright" ||
        key === " "
      ) {
        event.preventDefault();
      }

      if (activeCartridge === "serpent-98") {
        let nextDir: SerpentDirection | null = null;
        if (key === "arrowup" || key === "w") nextDir = "UP";
        else if (key === "arrowdown" || key === "s") nextDir = "DOWN";
        else if (key === "arrowleft" || key === "a") nextDir = "LEFT";
        else if (key === "arrowright" || key === "d") nextDir = "RIGHT";
        if (nextDir) {
          setSerpentState((s) => queueSerpentDirection(s, nextDir!));
        }
        return;
      }

      if (key === "arrowleft" || key === "a") {
        heldMoveRef.current = -1;
      } else if (key === "arrowright" || key === "d") {
        heldMoveRef.current = 1;
      } else if (key === " " || key === "arrowup" || key === "w") {
        fireQueuedRef.current = true;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        (key === "arrowleft" || key === "a") &&
        heldMoveRef.current === -1
      ) {
        heldMoveRef.current = 0;
      } else if (
        (key === "arrowright" || key === "d") &&
        heldMoveRef.current === 1
      ) {
        heldMoveRef.current = 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activeCartridge, activeStatus, handlePauseToggle, handleResetCartridge, operatorName]);

  const HeadingTag = activeView === "arcade" ? "h1" : "h2";

  const triggerDPadDirection = (dir: SerpentDirection) => {
    if (activeStatus !== "playing") {
      handleStartOrResume();
    }
    if (activeCartridge === "serpent-98") {
      setSerpentState((s) => queueSerpentDirection(s, dir));
      return;
    }
    if (dir === "LEFT") {
      if (activeCartridge === "break-grid") {
        setBreakState((s) => stepBreakGridState(s, { move: -1 }).nextState);
      } else {
        setInvadersState((s) => stepPacketInvadersState(s, { move: -1 }).nextState);
      }
    } else if (dir === "RIGHT") {
      if (activeCartridge === "break-grid") {
        setBreakState((s) => stepBreakGridState(s, { move: 1 }).nextState);
      } else {
        setInvadersState((s) => stepPacketInvadersState(s, { move: 1 }).nextState);
      }
    } else {
      fireQueuedRef.current = true;
    }
  };

  return (
    <section
      id="ninety9-arcade-bay"
      data-testid="ninety9-arcade-view"
      className="border-b-2 border-[#000000] n99-section-pad"
      style={{ backgroundColor: palette.surface, color: palette.ink }}
    >
      <div className="mx-auto max-w-[1380px] space-y-6 sm:space-y-8">
        {/* Top Arcade Header & Telemetry */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#000000] pb-4">
          <div className="n99-grid-cell space-y-1.5">
            <div className="inline-block border-2 border-[#000000] bg-[#000000] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#FFFFFF]">
              INTERACTIVE MODULE // 1-BIT MONOCHROME BAY
            </div>
            <HeadingTag className="n99-font-mono n99-display-h1 font-bold uppercase">
              {heading}
            </HeadingTag>
            <p className="max-w-3xl text-xs leading-relaxed text-[#292929] sm:text-sm">
              Three modular, zero-dependency HTML5 Canvas games synthesized inside strict
              #FFFFFF / #000000 workstation constraints. High scores and achievements
              persist to browser localStorage and respond live to GenUI Studio physics remixes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleArcadeMute()}
              data-testid="ninety9-arcade-sfx-toggle"
              aria-label={arcadeMuted ? "Enable 8-bit Web Audio SFX" : "Mute 8-bit Web Audio SFX"}
              className="n99-touch-btn border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#D9D9D9] cursor-pointer"
            >
              SFX: [{arcadeMuted ? "MUTED" : "WEB AUDIO ON"}]
            </button>
            <button
              type="button"
              onClick={() => {
                resetArcadeProgress();
                setAnnouncement("LOCAL ARCADE HIGH SCORES AND BADGES CLEARED.");
              }}
              data-testid="ninety9-arcade-clear-scores"
              className="n99-touch-btn border-2 border-[#000000] bg-[#D9D9D9] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] cursor-pointer"
            >
              CLEAR SCORES
            </button>
          </div>
        </div>

        {/* Single Centralized Screen-Reader Live Region */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="ninety9-arcade-live-status"
          className="n99-wrap-anywhere border-2 border-[#000000] bg-[#D9D9D9] px-3 py-1.5 font-mono text-[11px] font-bold uppercase text-[#000000]"
        >
          SYS_CONSOLE &gt; {announcement}
        </div>

        {/* 3 Cartridge Slot Switcher */}
        <div
          role="tablist"
          aria-label="Arcade Cartridges"
          className="n99-card-grid-3"
        >
          {ARCADE_CARTRIDGES.map((cart) => {
            const isSelected = activeCartridge === cart.id;
            const best = highScores[cart.id] ?? 0;
            return (
              <button
                key={cart.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`ninety9-arcade-tab-${cart.id}`}
                onClick={() => handleCartridgeSelect(cart.id)}
                className={`n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] p-4 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#000000] text-[#FFFFFF]"
                    : "bg-[#FFFFFF] text-[#000000] hover:bg-[#D9D9D9]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase">
                  <span>{cart.code} // {cart.yearEra}</span>
                  <span
                    className={`border px-1.5 py-0.5 ${
                      isSelected
                        ? "border-[#FFFFFF] bg-[#292929] text-[#FFFFFF]"
                        : "border-[#000000] bg-[#D9D9D9] text-[#000000]"
                    }`}
                  >
                    BEST: {best}
                  </span>
                </div>
                <div className="mt-2 font-mono text-lg font-bold uppercase">
                  {cart.title}
                </div>
                <div
                  className={`mt-1 text-xs leading-snug ${
                    isSelected ? "text-[#D9D9D9]" : "text-[#292929]"
                  }`}
                >
                  {cart.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Arcade Window + Controls + Scoreboard Split */}
        <div className="n99-split-12">
          {/* Left 7 Columns: Retro Computer Window + Canvas + Tactile Pad */}
          <div className="n99-grid-cell n99-lg-span-7 border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] n99-shadow-md">
            {/* NeXT/Mac Brutalist Title Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#000000] bg-[#000000] px-3 py-2 font-mono text-xs font-bold uppercase text-[#FFFFFF]">
              <span>
                WIN // {currentCartMeta.code} · {currentCartMeta.title}.EXE
              </span>
              <span>MODE: {difficultyPreset.toUpperCase()}</span>
            </div>

            {/* Scoreboard Telemetry Strip (2x2 on narrow mobile -> 4x1 on wider container) */}
            <div className="n99-scoreboard-4 font-mono text-xs text-[#000000]">
              <div className="bg-[#D9D9D9] p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#292929]">SCORE</div>
                <div data-testid="ninety9-arcade-score" className="text-base font-bold">
                  {currentScore}
                </div>
              </div>
              <div className="bg-[#D9D9D9] p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#292929]">HI-SCORE</div>
                <div data-testid="ninety9-arcade-highscore" className="text-base font-bold">
                  {Math.max(currentScore, highScores[activeCartridge] ?? 0)}
                </div>
              </div>
              <div className="bg-[#D9D9D9] p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#292929]">
                  {activeCartridge === "serpent-98" ? "LEVEL" : "WAVE"}
                </div>
                <div className="text-base font-bold">{currentWaveOrLevel}</div>
              </div>
              <div className="bg-[#D9D9D9] p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#292929]">LIVES</div>
                <div className="text-base font-bold">{currentLives}</div>
              </div>
            </div>

            {/* Canvas Viewport + Static State Overlay */}
            <div className="n99-halftone-light relative flex flex-col items-center justify-center p-4">
              <div className="relative w-full max-w-[480px] border-2 border-[#000000] bg-[#FFFFFF]">
                <canvas
                  ref={canvasRef}
                  width={ARCADE_CANVAS_W}
                  height={ARCADE_CANVAS_H}
                  role="img"
                  aria-label={`${currentCartMeta.title} arcade playfield canvas. Current score ${currentScore}, status ${activeStatus}.`}
                  data-testid="ninety9-arcade-canvas"
                  className="n99-pixel-canvas block h-auto w-full"
                />

                {activeStatus !== "playing" && (
                  <div
                    data-testid="ninety9-arcade-overlay"
                    className="absolute inset-0 flex flex-col items-center justify-center bg-[#FFFFFF]/90 p-6 text-center"
                  >
                    <div className="border-2 border-[#000000] bg-[#FFFFFF] p-5 n99-shadow-md space-y-3 max-w-xs w-full">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#292929]">
                        {activeStatus === "gameover"
                          ? "EXECUTION HALTED // FINAL LOG"
                          : activeStatus === "paused"
                            ? "SIGNAL SUSPENDED // PAUSED"
                            : `${currentCartMeta.code} READY TO BOOT`}
                      </div>
                      <h2 className="font-mono text-xl font-bold uppercase text-[#000000]">
                        {activeStatus === "gameover"
                          ? `SCORE: ${currentScore} PTS`
                          : currentCartMeta.title}
                      </h2>
                      <p className="font-mono text-[11px] leading-relaxed text-[#292929]">
                        {currentCartMeta.controlsHint}
                      </p>
                      <button
                        type="button"
                        onClick={handleStartOrResume}
                        data-testid="ninety9-arcade-boot-btn"
                        className="n99-shadow-sm min-h-[42px] w-full border-2 border-[#000000] bg-[#000000] px-4 py-2 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#292929] cursor-pointer"
                      >
                        {activeStatus === "paused"
                          ? "RESUME EXECUTION"
                          : activeStatus === "gameover"
                            ? "REBOOT CARTRIDGE"
                            : "BOOT CARTRIDGE [START]"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Controls & Accessible Tactile D-Pad */}
              <div className="mt-4 flex w-full max-w-[480px] flex-wrap items-center justify-between gap-3 border-2 border-[#000000] bg-[#FFFFFF] p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePauseToggle}
                    data-testid="ninety9-arcade-pause-btn"
                    className="n99-arcade-btn min-h-[40px] border-2 border-[#000000] bg-[#000000] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#292929] cursor-pointer"
                  >
                    {activeStatus === "playing" ? "PAUSE [P]" : "PLAY / RESUME"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCartridge}
                    data-testid="ninety9-arcade-reset-btn"
                    className="n99-arcade-btn min-h-[40px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#D9D9D9] cursor-pointer"
                  >
                    RESET [R]
                  </button>
                </div>

                {/* Accessible Touch / Click Directional Controls */}
                <div
                  role="group"
                  aria-label="On-screen Arcade Controls"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <button
                    type="button"
                    aria-label="Move Left"
                    onPointerDown={() => {
                      heldMoveRef.current = -1;
                    }}
                    onPointerUp={() => {
                      heldMoveRef.current = 0;
                    }}
                    onPointerLeave={() => {
                      heldMoveRef.current = 0;
                    }}
                    onClick={() => triggerDPadDirection("LEFT")}
                    className="n99-arcade-btn min-h-[40px] min-w-[42px] border-2 border-[#000000] bg-[#D9D9D9] px-2 font-mono text-xs font-bold text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] cursor-pointer"
                  >
                    ←
                  </button>
                  {activeCartridge === "serpent-98" && (
                    <>
                      <button
                        type="button"
                        aria-label="Move Up"
                        onClick={() => triggerDPadDirection("UP")}
                        className="n99-arcade-btn min-h-[40px] min-w-[42px] border-2 border-[#000000] bg-[#D9D9D9] px-2 font-mono text-xs font-bold text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] cursor-pointer"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move Down"
                        onClick={() => triggerDPadDirection("DOWN")}
                        className="n99-arcade-btn min-h-[40px] min-w-[42px] border-2 border-[#000000] bg-[#D9D9D9] px-2 font-mono text-xs font-bold text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] cursor-pointer"
                      >
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label="Move Right"
                    onPointerDown={() => {
                      heldMoveRef.current = 1;
                    }}
                    onPointerUp={() => {
                      heldMoveRef.current = 0;
                    }}
                    onPointerLeave={() => {
                      heldMoveRef.current = 0;
                    }}
                    onClick={() => triggerDPadDirection("RIGHT")}
                    className="n99-arcade-btn min-h-[40px] min-w-[42px] border-2 border-[#000000] bg-[#D9D9D9] px-2 font-mono text-xs font-bold text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] cursor-pointer"
                  >
                    →
                  </button>
                  {activeCartridge !== "serpent-98" && (
                    <button
                      type="button"
                      aria-label={
                        activeCartridge === "break-grid"
                          ? "Launch Ball"
                          : "Fire Laser"
                      }
                      onClick={() => triggerDPadDirection("UP")}
                      className="n99-arcade-btn min-h-[40px] border-2 border-[#000000] bg-[#000000] px-3 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#292929] cursor-pointer"
                    >
                      {activeCartridge === "break-grid" ? "LAUNCH" : "FIRE"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: GenUI Physics Params + High-Score Table + Achievements */}
          <div className="n99-grid-cell n99-lg-span-5 space-y-5">
            {/* Zod Runtime Parameters Card */}
            <div className="border-2 border-[#000000] bg-[#FFFFFF] p-4 text-[#000000] n99-shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b-2 border-[#000000] pb-2 font-mono text-xs font-bold uppercase">
                <h2>GENUI ZOD PHYSICS SPEC</h2>
                <span className="border border-[#000000] bg-[#D9D9D9] px-1.5 py-0.5 text-[10px]">
                  CLAMPED SAFE
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="border border-[#000000] p-2">
                  <dt className="text-[10px] font-bold text-[#808080]">SERPENT GRID</dt>
                  <dd className="font-bold">{snakeGridSize} × {snakeGridSize} CELLS</dd>
                </div>
                <div className="border border-[#000000] p-2">
                  <dt className="text-[10px] font-bold text-[#808080]">PADDLE WIDTH</dt>
                  <dd className="font-bold">{paddleWidth} PX</dd>
                </div>
                <div className="border border-[#000000] p-2">
                  <dt className="text-[10px] font-bold text-[#808080]">BALL VELOCITY</dt>
                  <dd className="font-bold">{ballSpeed} PX / TICK</dd>
                </div>
                <div className="border border-[#000000] p-2">
                  <dt className="text-[10px] font-bold text-[#808080]">INVADER ROWS</dt>
                  <dd className="font-bold">{invaderRows} × 8 FLEET</dd>
                </div>
              </dl>

              {linkedEntry && (
                <div className="border-t border-[#000000] pt-3 space-y-2.5">
                  {linkedEntryPhoto && (
                    <ArchivalMediaPlate
                      photo={linkedEntryPhoto}
                      fallbackSrc={linkedEntry.illustrationPath}
                      fallbackAlt={`${linkedEntry.title} archival reference`}
                      aspectClassName="h-28"
                      priority="deferred"
                      compact
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold uppercase text-[#292929]">
                      ERA LINK: {linkedEntry.serialNumber} ({linkedEntry.year})
                    </span>
                    <button
                      type="button"
                      onClick={() => openDossier(linkedEntry.slug)}
                      className="min-h-[36px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1 font-mono text-[11px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] cursor-pointer"
                    >
                      {currentCartMeta.linkedDossierLabel} →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Persistent Leaderboard Table */}
            <div className="border-2 border-[#000000] bg-[#FFFFFF] p-4 text-[#000000] n99-shadow-sm space-y-3">
              <h2 className="border-b-2 border-[#000000] pb-2 font-mono text-xs font-bold uppercase">
                WORKSTATION HIGH-SCORE LEDGER
              </h2>
              <div className="n99-table-scroll">
                <table className="w-full min-w-[260px] border-collapse font-mono text-xs">
                <caption className="sr-only">
                  Local workstation high scores for all three NINETY9 Arcade cartridges
                </caption>
                <thead>
                  <tr className="border-b-2 border-[#000000] bg-[#D9D9D9] text-left text-[10px] uppercase">
                    <th scope="col" className="p-2">CARTRIDGE</th>
                    <th scope="col" className="p-2">TARGET</th>
                    <th scope="col" className="p-2 text-right">BEST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#000000]">
                  {ARCADE_CARTRIDGES.map((cart) => {
                    const best = highScores[cart.id] ?? 0;
                    return (
                      <tr key={`score-${cart.id}`}>
                        <td className="p-2 font-bold">{cart.title}</td>
                        <td className="p-2 text-[#292929]">
                          {cart.targetAchievementScore} PTS
                        </td>
                        <td className="p-2 text-right font-bold">{best}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            {/* Unlockable Achievements */}
            <div className="border-2 border-[#000000] bg-[#FFFFFF] p-4 text-[#000000] n99-shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b-2 border-[#000000] pb-2 font-mono text-xs font-bold uppercase">
                <h2>UNLOCKABLE ARCHIVE BADGES</h2>
                <span>
                  {achievements.length} / {ARCADE_ACHIEVEMENTS.length}
                </span>
              </div>
              <ul className="space-y-2">
                {ARCADE_ACHIEVEMENTS.map((ach) => {
                  const unlocked = achievements.includes(ach.id);
                  return (
                    <li
                      key={ach.id}
                      className={`border border-[#000000] p-2.5 font-mono text-xs ${
                        unlocked ? "bg-[#000000] text-[#FFFFFF]" : "bg-[#D9D9D9] text-[#292929]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-bold uppercase">
                        <span>
                          {ach.code} // {ach.title}
                        </span>
                        <span>{unlocked ? "[UNLOCKED]" : "[LOCKED]"}</span>
                      </div>
                      <div className="mt-1 text-[11px]">{ach.requirement}</div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
