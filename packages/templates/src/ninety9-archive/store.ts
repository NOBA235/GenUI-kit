import { create } from "zustand";
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

export type Ninety9ViewId =
  | "home"
  | "archive"
  | "timeline"
  | "categories"
  | "about"
  | "dossier"
  | "random-transmit";

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

  setCrtMode: (mode: CRTMode) => void;
  cycleCrtMode: () => CRTMode;
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
    queryView === "dossier"
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

  return {
    activeView: "home",
    activeDossierSlug: DEFAULT_ENTRY_SLUG,
    selectedCategory: "all",
    selectedYear: "all",
  };
}

const initialRoute = readInitialRouteState();

export const useNinety9Store = create<Ninety9StoreState>((set, get) => ({
  crtMode: readPersistedCrtMode(),
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

  resetStoreForTest: () =>
    set({
      crtMode: "SUBTLE",
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
    }),
}));
