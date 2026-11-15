import { useMemo, useSyncExternalStore } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { compileCmos, type ArtifactPath, type CmosCompilation } from "../lib/cmos/compiler.js";
import { createCmosStore, type CmosStore } from "../lib/cmos/engine.js";

/* ═══════════════════════════ Engine store (one per page) ═══════════════════════════ */

let sharedCmosStore: StoreApi<CmosStore> | null = null;

/** Shared CMOS store. Browsers persist to localStorage; SSR runs in memory. */
export function getCmosStore(): StoreApi<CmosStore> {
  if (!sharedCmosStore) {
    sharedCmosStore = createCmosStore({ persistence: typeof window === "undefined" ? null : undefined });
  }
  return sharedCmosStore;
}

/** Test hook: drop the shared store so the next render boots fresh. */
export function resetCmosStoreForTests(): void {
  sharedCmosStore = null;
  sharedUiStore = null;
}

export function useCmos<T>(selector: (state: CmosStore) => T): T {
  const store = getCmosStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/** Compile the live draft. Memoized on the frozen draft reference. */
export function useCompilation(projectName?: string): CmosCompilation {
  const draft = useCmos((s) => s.draft);
  return useMemo(() => compileCmos(draft, projectName ? { projectName } : {}), [draft, projectName]);
}

/* ═══════════════════════════ UI store (focus, mode, camera) ═══════════════════════════ */

export type WorkspaceMode = "setup" | "landing";
export const MENU_IDS = ["standard", "chipset", "peripherals", "power", "pnp", "compiler"] as const;
export type MenuId = (typeof MENU_IDS)[number];
export type BoardPart = "overview" | "cpu" | "ram" | "nvme" | "cache" | "pcie" | "battery" | "vrm";

export interface CmosUiState {
  readonly mode: WorkspaceMode;
  /** null = main menu. */
  readonly activeMenu: MenuId | null;
  readonly mainIndex: number;
  readonly rowIndex: number;
  /** Component the 3D camera frames; follows menu focus and pointer hover. */
  readonly focusPart: BoardPart;
  readonly hoverPart: BoardPart | null;
  readonly compilerTab: ArtifactPath;
  readonly showHelp: boolean;
  readonly audioMuted: boolean;
  readonly postEnabled: boolean;
  /** Shown after an invalid register packet triggers fail-safe recovery. */
  readonly recoveryNotice: string | null;
}

const INITIAL_UI: CmosUiState = {
  mode: "setup",
  activeMenu: null,
  mainIndex: 0,
  rowIndex: 0,
  focusPart: "overview",
  hoverPart: null,
  compilerTab: "docker-compose.yml",
  showHelp: false,
  audioMuted: false,
  postEnabled: true,
  recoveryNotice: null,
};

let sharedUiStore: StoreApi<CmosUiState> | null = null;

export function getCmosUiStore(): StoreApi<CmosUiState> {
  if (!sharedUiStore) sharedUiStore = createStore<CmosUiState>()(() => ({ ...INITIAL_UI }));
  return sharedUiStore;
}

export function useCmosUi<T>(selector: (state: CmosUiState) => T): T {
  const store = getCmosUiStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function setCmosUi(patch: Partial<CmosUiState>): void {
  getCmosUiStore().setState(patch);
}
