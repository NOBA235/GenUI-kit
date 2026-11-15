import { create } from "zustand";
import type { ArcadeCartridgeId } from "./arcade/types.js";
import { getAllEntries, getEntryBySlug, transmitRandomPacket } from "./lib/archive/api.js";
import {
  CRTModeSchema,
  type ArchiveEntryType,
  type ArchiveSortOption,
  type CategorySlug,
  type CRTMode,
  type TransmissionPacket,
} from "./lib/archive/types.js";

export const NINETY9_CRT_STORAGE_KEY = "ninety9-archive:crt-mode";
export const NINETY9_ARCADE_STORAGE_KEY = "ninety9-archive:arcade-v1";
export const OPERATOR_NAME_MAX_LENGTH = 32;

export interface OperatorValidationResult {
  readonly ok: boolean;
  readonly normalizedName: string;
  readonly error?: string;
}

/** Validates and normalizes an operator callsign entered in the COBOL boot terminal. */
export function validateOperatorName(raw: string): OperatorValidationResult {
  const normalizedName = raw.replace(/\s+/g, " ").trim();
  if (normalizedName.length === 0) {
    return {
      ok: false,
      normalizedName: "",
      error: "ERR-01 // WS-OPERATOR-NAME CANNOT BE SPACES OR EMPTY.",
    };
  }
  return {
    ok: true,
    normalizedName: normalizedName.slice(0, OPERATOR_NAME_MAX_LENGTH),
  };
}

export type Ninety9ViewId =
  | "home"
  | "archive"
  | "timeline"
  | "categories"
  | "about"
  | "dossier"
  | "random-transmit"
  | "arcade";

export type ArcadeHighScoresMap = Record<ArcadeCartridgeId, number>;

const DEFAULT_ARCADE_SCORES: ArcadeHighScoresMap = {
  "serpent-98": 0,
  "break-grid": 0,
  "packet-invaders": 0,
};

interface PersistedArcadeState {
  readonly highScores: ArcadeHighScoresMap;
  readonly achievements: readonly string[];
  readonly muted: boolean;
}

function readPersistedArcadeState(): PersistedArcadeState {
  if (typeof window === "undefined") {
    return {
      highScores: { ...DEFAULT_ARCADE_SCORES },
      achievements: [],
      muted: false,
    };
  }
  try {
    const raw = window.localStorage.getItem(NINETY9_ARCADE_STORAGE_KEY);
    if (!raw) {
      return {
        highScores: { ...DEFAULT_ARCADE_SCORES },
        achievements: [],
        muted: false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedArcadeState>;
    const hs: Partial<ArcadeHighScoresMap> = parsed.highScores ?? {};
    return {
      highScores: {
        "serpent-98":
          typeof hs["serpent-98"] === "number" && Number.isFinite(hs["serpent-98"])
            ? Math.max(0, Math.floor(hs["serpent-98"]))
            : 0,
        "break-grid":
          typeof hs["break-grid"] === "number" && Number.isFinite(hs["break-grid"])
            ? Math.max(0, Math.floor(hs["break-grid"]))
            : 0,
        "packet-invaders":
          typeof hs["packet-invaders"] === "number" &&
          Number.isFinite(hs["packet-invaders"])
            ? Math.max(0, Math.floor(hs["packet-invaders"]))
            : 0,
      },
      achievements: Array.isArray(parsed.achievements)
        ? parsed.achievements.filter((x): x is string => typeof x === "string")
        : [],
      muted: Boolean(parsed.muted),
    };
  } catch {
    return {
      highScores: { ...DEFAULT_ARCADE_SCORES },
      achievements: [],
      muted: false,
    };
  }
}

function writePersistedArcadeState(next: PersistedArcadeState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NINETY9_ARCADE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / privacy errors
  }
}

function computeUnlockedAchievements(
  scores: ArcadeHighScoresMap,
  existing: readonly string[],
  justBootedOrScored: boolean
): readonly string[] {
  const unlocked = new Set(existing);
  if (justBootedOrScored) {
    unlocked.add("first-boot");
  }
  if (scores["serpent-98"] >= 60) {
    unlocked.add("serpent-survivor");
  }
  if (scores["break-grid"] >= 150) {
    unlocked.add("grid-demolition");
  }
  if (scores["packet-invaders"] >= 200) {
    unlocked.add("y2k-sentinel");
  }
  if (
    scores["serpent-98"] > 0 &&
    scores["break-grid"] > 0 &&
    scores["packet-invaders"] > 0
  ) {
    unlocked.add("arcade-trifecta");
  }
  return Array.from(unlocked);
}

const CRT_CYCLE_ORDER: readonly CRTMode[] = ["SUBTLE", "ACTIVE", "OFF"];

function readPersistedCrtMode(): CRTMode {
  if (typeof window === "undefined") {
    return "SUBTLE";
  }
  try {
    const raw = window.localStorage.getItem(NINETY9_CRT_STORAGE_KEY);
    if (!raw) return "SUBTLE";
    const parsed = CRTModeSchema.safeParse(raw);
    return parsed.success ? parsed.data : "SUBTLE";
  } catch {
    return "SUBTLE";
  }
}

function writePersistedCrtMode(mode: CRTMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NINETY9_CRT_STORAGE_KEY, mode);
  } catch {
    // Ignore private/restricted storage failures
  }
}

export interface Ninety9NavigateOptions {
  readonly dossierSlug?: string;
  readonly category?: CategorySlug | "all";
  readonly year?: number | "all";
  readonly query?: string;
  readonly sortBy?: ArchiveSortOption;
}

export interface Ninety9StoreState {
  crtMode: CRTMode;
  operatorName: string | null;
  activeView: Ninety9ViewId;
  activeDossierSlug: string;
  searchQuery: string;
  selectedYear: number | "all";
  timelineYear: number | "all";
  selectedCategory: CategorySlug | "all";
  selectedType: ArchiveEntryType | "all";
  sortBy: ArchiveSortOption;
  transmitPacket: TransmissionPacket;
  transmissionCount: number;
  activeRemixBanner: string | null;
  activeArcadeCartridge: ArcadeCartridgeId;
  arcadeBootNonce: number;
  arcadeHighScores: ArcadeHighScoresMap;
  arcadeAchievements: readonly string[];
  arcadeMuted: boolean;

  setCrtMode: (mode: CRTMode) => void;
  cycleCrtMode: () => CRTMode;
  authenticateOperator: (rawName: string) => OperatorValidationResult;
  lockWorkstation: () => void;
  navigateTo: (view: Ninety9ViewId, options?: Ninety9NavigateOptions) => void;
  openDossier: (slug: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedYear: (year: number | "all") => void;
  setTimelineYear: (year: number | "all") => void;
  setSelectedCategory: (category: CategorySlug | "all") => void;
  setSelectedType: (entryType: ArchiveEntryType | "all") => void;
  setSortBy: (sort: ArchiveSortOption) => void;
  resetArchiveFilters: () => void;
  retransmitRandomPacket: (seed?: number) => TransmissionPacket;
  setActiveRemixBanner: (banner: string | null) => void;
  syncFromCatalogView: (defaultView: Ninety9ViewId, category?: CategorySlug | "all", year?: number | "all", dossierSlug?: string) => void;
  selectArcadeCartridge: (cartridge: ArcadeCartridgeId) => void;
  requestImmediateArcadeBoot: (cartridge?: ArcadeCartridgeId) => void;
  recordArcadeScore: (cartridge: ArcadeCartridgeId, score: number) => boolean;
  toggleArcadeMute: () => boolean;
  resetArcadeProgress: () => void;
  resetStoreForTest: () => void;
}

const DEFAULT_PACKET = transmitRandomPacket({ seed: 1994 });
const DEFAULT_ENTRY_SLUG = getAllEntries()[0]?.slug ?? "nirvana-nevermind";

function readInitialRouteState(): {
  activeView: Ninety9ViewId;
  activeDossierSlug: string;
  selectedCategory: CategorySlug | "all";
  selectedYear: number | "all";
} {
  if (typeof window === "undefined") {
    return {
      activeView: "home",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }

  const pathname = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const queryView = params.get("view");
  const queryEntry = params.get("entry");

  if (queryEntry && getEntryBySlug(queryEntry)) {
    return {
      activeView: "dossier",
      activeDossierSlug: queryEntry,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }

  if (
    queryView === "archive" ||
    queryView === "timeline" ||
    queryView === "categories" ||
    queryView === "about" ||
    queryView === "random-transmit" ||
    queryView === "dossier" ||
    queryView === "arcade"
  ) {
    return {
      activeView: queryView,
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }

  const dossierPathMatch = /\/dossier\/([a-z0-9-]+)\/?$/i.exec(pathname);
  if (dossierPathMatch?.[1] && getEntryBySlug(dossierPathMatch[1])) {
    return {
      activeView: "dossier",
      activeDossierSlug: dossierPathMatch[1],
      selectedCategory: "all",
      selectedYear: "all",
    };
  }

  if (pathname.endsWith("/archive")) {
    return {
      activeView: "archive",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }
  if (pathname.endsWith("/timeline")) {
    return {
      activeView: "timeline",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }
  if (pathname.endsWith("/categories")) {
    return {
      activeView: "categories",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }
  if (pathname.endsWith("/about")) {
    return {
      activeView: "about",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }
  if (pathname.endsWith("/random-transmit")) {
    return {
      activeView: "random-transmit",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }
  if (pathname.endsWith("/arcade")) {
    return {
      activeView: "arcade",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      selectedCategory: "all",
      selectedYear: "all",
    };
  }

  return {
    activeView: "home",
    activeDossierSlug: DEFAULT_ENTRY_SLUG,
    selectedCategory: "all",
    selectedYear: "all",
  };
}

const initialRoute = readInitialRouteState();
const initialArcade = readPersistedArcadeState();

export const useNinety9Store = create<Ninety9StoreState>((set, get) => ({
  crtMode: readPersistedCrtMode(),
  operatorName: null,
  activeView: initialRoute.activeView,
  activeDossierSlug: initialRoute.activeDossierSlug,
  searchQuery: "",
  selectedYear: initialRoute.selectedYear,
  timelineYear: 1991,
  selectedCategory: initialRoute.selectedCategory,
  selectedType: "all",
  sortBy: "chronological-asc",
  transmitPacket: DEFAULT_PACKET,
  transmissionCount: 1,
  activeRemixBanner: null,
  activeArcadeCartridge: "packet-invaders",
  arcadeBootNonce: 0,
  arcadeHighScores: initialArcade.highScores,
  arcadeAchievements: initialArcade.achievements,
  arcadeMuted: initialArcade.muted,

  setCrtMode: (mode) => {
    writePersistedCrtMode(mode);
    set({ crtMode: mode });
  },

  cycleCrtMode: () => {
    const current = get().crtMode;
    const idx = CRT_CYCLE_ORDER.indexOf(current);
    const next = CRT_CYCLE_ORDER[(idx + 1) % CRT_CYCLE_ORDER.length] ?? "SUBTLE";
    writePersistedCrtMode(next);
    set({ crtMode: next });
    return next;
  },

  authenticateOperator: (rawName) => {
    const validation = validateOperatorName(rawName);
    if (!validation.ok) {
      return validation;
    }
    set({ operatorName: validation.normalizedName });
    return validation;
  },

  lockWorkstation: () => set({ operatorName: null }),

  navigateTo: (view, options) => {
    set((state) => {
      const nextSlug =
        options?.dossierSlug && getEntryBySlug(options.dossierSlug)
          ? options.dossierSlug
          : state.activeDossierSlug;
      return {
        activeView: view,
        activeDossierSlug: nextSlug,
        selectedCategory:
          options?.category !== undefined ? options.category : state.selectedCategory,
        selectedYear: options?.year !== undefined ? options.year : state.selectedYear,
        searchQuery: options?.query !== undefined ? options.query : state.searchQuery,
        sortBy: options?.sortBy !== undefined ? options.sortBy : state.sortBy,
      };
    });
  },

  openDossier: (slug) => {
    const resolved = getEntryBySlug(slug) ?? getAllEntries()[0];
    if (!resolved) return;
    set({
      activeView: "dossier",
      activeDossierSlug: resolved.slug,
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedYear: (year) => set({ selectedYear: year }),
  setTimelineYear: (year) => set({ timelineYear: year }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSelectedType: (entryType) => set({ selectedType: entryType }),
  setSortBy: (sort) => set({ sortBy: sort }),

  resetArchiveFilters: () =>
    set({
      searchQuery: "",
      selectedYear: "all",
      selectedCategory: "all",
      selectedType: "all",
      sortBy: "chronological-asc",
    }),

  retransmitRandomPacket: (seed) => {
    const currentSlug = get().transmitPacket.entry.slug;
    const packet = transmitRandomPacket({
      excludeSlug: currentSlug,
      seed,
    });
    set((state) => ({
      transmitPacket: packet,
      transmissionCount: state.transmissionCount + 1,
    }));
    return packet;
  },

  setActiveRemixBanner: (banner) => set({ activeRemixBanner: banner }),

  syncFromCatalogView: (defaultView, category, year, dossierSlug) => {
    set((state) => ({
      activeView: defaultView,
      selectedCategory: category !== undefined ? category : state.selectedCategory,
      selectedYear: year !== undefined ? year : state.selectedYear,
      activeDossierSlug:
        dossierSlug && getEntryBySlug(dossierSlug)
          ? dossierSlug
          : state.activeDossierSlug,
    }));
  },

  selectArcadeCartridge: (cartridge) => set({ activeArcadeCartridge: cartridge }),

  requestImmediateArcadeBoot: (cartridge) =>
    set((state) => ({
      activeArcadeCartridge: cartridge ?? state.activeArcadeCartridge,
      arcadeBootNonce: state.arcadeBootNonce + 1,
    })),

  recordArcadeScore: (cartridge, score) => {
    const cleanScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
    const state = get();
    const prevBest = state.arcadeHighScores[cartridge] ?? 0;
    const isNewRecord = cleanScore > prevBest;
    const nextHighScores: ArcadeHighScoresMap = {
      ...state.arcadeHighScores,
      [cartridge]: Math.max(prevBest, cleanScore),
    };
    const nextAchievements = computeUnlockedAchievements(
      nextHighScores,
      state.arcadeAchievements,
      true
    );
    writePersistedArcadeState({
      highScores: nextHighScores,
      achievements: nextAchievements,
      muted: state.arcadeMuted,
    });
    set({
      arcadeHighScores: nextHighScores,
      arcadeAchievements: nextAchievements,
    });
    return isNewRecord;
  },

  toggleArcadeMute: () => {
    const state = get();
    const nextMuted = !state.arcadeMuted;
    writePersistedArcadeState({
      highScores: state.arcadeHighScores,
      achievements: state.arcadeAchievements,
      muted: nextMuted,
    });
    set({ arcadeMuted: nextMuted });
    return nextMuted;
  },

  resetArcadeProgress: () => {
    const nextState: PersistedArcadeState = {
      highScores: { ...DEFAULT_ARCADE_SCORES },
      achievements: [],
      muted: get().arcadeMuted,
    };
    writePersistedArcadeState(nextState);
    set({
      arcadeHighScores: nextState.highScores,
      arcadeAchievements: [],
    });
  },

  resetStoreForTest: () =>
    set({
      crtMode: "SUBTLE",
      operatorName: null,
      activeView: "home",
      activeDossierSlug: DEFAULT_ENTRY_SLUG,
      searchQuery: "",
      selectedYear: "all",
      timelineYear: 1991,
      selectedCategory: "all",
      selectedType: "all",
      sortBy: "chronological-asc",
      transmitPacket: DEFAULT_PACKET,
      transmissionCount: 1,
      activeRemixBanner: null,
      activeArcadeCartridge: "packet-invaders",
      arcadeBootNonce: 0,
      arcadeHighScores: { ...DEFAULT_ARCADE_SCORES },
      arcadeAchievements: [],
      arcadeMuted: false,
    }),
}));

/** Reads operatorName safely across both client Zustand subscriptions and SSR state mutations. */
export function useNinety9OperatorName(): string | null {
  const subscribed = useNinety9Store((s) => s.operatorName);
  return typeof window === "undefined"
    ? useNinety9Store.getState().operatorName
    : subscribed;
}
