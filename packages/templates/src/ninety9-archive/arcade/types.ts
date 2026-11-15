import type { ArchiveEntry } from "../lib/archive/types.js";

export type ArcadeCartridgeId = "serpent-98" | "break-grid" | "packet-invaders";

export type ArcadeGameStatus = "ready" | "playing" | "paused" | "gameover";

export type ArcadeDifficultyPreset = "zen-91" | "standard-1995" | "turbo-y2k";

export interface ArcadeRuntimeConfig {
  readonly difficultyPreset: ArcadeDifficultyPreset;
  readonly paddleWidth: number;
  readonly ballSpeed: number;
  readonly snakeGridSize: number;
  readonly invaderRows: number;
}

export interface ArcadePaletteColors {
  readonly surface: string;
  readonly ink: string;
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
}

export interface ArcadeCartridgeMeta {
  readonly id: ArcadeCartridgeId;
  readonly code: string;
  readonly title: string;
  readonly subtitle: string;
  readonly yearEra: string;
  readonly controlsHint: string;
  readonly linkedDossierSlug: ArchiveEntry["slug"];
  readonly linkedDossierLabel: string;
  readonly targetAchievementScore: number;
  readonly description: string;
}

export interface ArcadeAchievementDef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly requirement: string;
}

export const ARCADE_CANVAS_W = 480;
export const ARCADE_CANVAS_H = 360;

export const DEFAULT_ARCADE_PALETTE: ArcadePaletteColors = {
  surface: "#FFFFFF",
  ink: "#000000",
  light: "#D9D9D9",
  mid: "#808080",
  dark: "#292929",
};

export const ARCADE_CARTRIDGES: readonly ArcadeCartridgeMeta[] = [
  {
    id: "serpent-98",
    code: "CART-01",
    title: "SERPENT-98",
    subtitle: "NOKIA-ERA MATRIX STEERING",
    yearEra: "1998 // HANDHELD 1-BIT",
    controlsHint: "ARROW KEYS OR WASD TO STEER · COLLECT DATA PELLETS",
    linkedDossierSlug: "palmpilot-1000",
    linkedDossierLabel: "INSPECT POCKET HARDWARE DOSSIER",
    targetAchievementScore: 60,
    description:
      "Grid-locked monochrome serpent inspired by late-90s pocket LCD handsets. Speed increases with each harvested buffer block.",
  },
  {
    id: "break-grid",
    code: "CART-02",
    title: "BREAK-GRID",
    subtitle: "ARMOR SECTOR DEFLECTION",
    yearEra: "1995 // WORKSTATION DEFLECTOR",
    controlsHint: "LEFT/RIGHT OR A/D TO SLIDE · SPACE TO LAUNCH BALL",
    linkedDossierSlug: "sony-playstation",
    linkedDossierLabel: "INSPECT 32-BIT GAMING DOSSIER",
    targetAchievementScore: 150,
    description:
      "Five-tone monochrome armor blocks with 1-to-3 hit durability. Angle bounces cleanly off paddle edges to clear memory banks.",
  },
  {
    id: "packet-invaders",
    code: "CART-03",
    title: "PACKET INVADERS",
    subtitle: "Y2K CORRUPTED PACKET DEFENSE",
    yearEra: "1999 // CLOCK OVERFLOW DEFENSE",
    controlsHint: "LEFT/RIGHT OR A/D TO STRAFE · SPACE TO FIRE LASER",
    linkedDossierSlug: "y2k-bug-1999",
    linkedDossierLabel: "INSPECT Y2K EPOCH BUG DOSSIER",
    targetAchievementScore: 200,
    description:
      "Intercept descending Y2K glitch daemons before they breach the workstation firewall bunkers. Hit rogue clock UFOs for +100 pts.",
  },
] as const;

export const ARCADE_ACHIEVEMENTS: readonly ArcadeAchievementDef[] = [
  {
    id: "first-boot",
    code: "ACH-01",
    title: "FIRST CARTRIDGE BOOT",
    requirement: "Boot and log a session in any NINETY9 Arcade cartridge.",
  },
  {
    id: "serpent-survivor",
    code: "ACH-02",
    title: "HANDHELD GRID RUNNER",
    requirement: "Score 60+ PTS in SERPENT-98.",
  },
  {
    id: "grid-demolition",
    code: "ACH-03",
    title: "SECTOR DEFLECTOR",
    requirement: "Score 150+ PTS in BREAK-GRID.",
  },
  {
    id: "y2k-sentinel",
    code: "ACH-04",
    title: "Y2K PACKET SENTINEL",
    requirement: "Score 200+ PTS in PACKET INVADERS.",
  },
  {
    id: "arcade-trifecta",
    code: "ACH-05",
    title: "WORKSTATION TRIFECTA",
    requirement: "Record a score > 0 across all 3 arcade cartridges.",
  },
] as const;

export type ArcadeSfxEvent =
  | "boot"
  | "pickup"
  | "shoot"
  | "hit"
  | "clear"
  | "gameover";
