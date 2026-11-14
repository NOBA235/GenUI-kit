import { getByPath, type StateModel } from "@json-render/core";
import {
  flattenToPointers,
  immutableSetByPath,
} from "@json-render/core/store-utils";
import {
  deepCloneAndSanitizeValue,
  isSafeJsonPointer,
  normalizeSafePointer,
  type DeepSanitizeCounters,
} from "../stream/dag-sanitizer.js";
import type { StateHistoryEntry, TimeTravelStateStore } from "../types.js";

export interface TimeTravelStateStoreOptions {
  /** Maximum number of snapshots retained in history (default: 128) */
  readonly maxHistory?: number;
  /** Maximum synchronous re-entrant cascade depth before circuit breaker trips (default: 10) */
  readonly maxCascadeDepth?: number;
  /** Optional callback invoked when the watch cascade circuit breaker trips */
  readonly onCascadeTrip?: (depth: number, path: string) => void;
}

function deepFreezeValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  // Short-circuit already-frozen branches so structural sharing stays O(changed-path).
  if (Object.isFrozen(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreezeValue(value[i]);
    }
    return Object.freeze(value);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    deepFreezeValue(record[key]);
  }
  return Object.freeze(value);
}

function sanitizeStateValue(value: unknown, pathContext: string): unknown {
  const counters: DeepSanitizeCounters = {
    healedNumbersCount: 0,
    blockedUrisCount: 0,
    blockedPathsCount: 0,
    issues: [],
  };
  return deepFreezeValue(
    deepCloneAndSanitizeValue(value, counters, pathContext),
  );
}

/**
 * Checks whether an ancestor along `pointer` in `root` is a non-object primitive.
 * If so, promotes intermediate primitives to plain objects before calling immutableSetByPath
 * so setting "/a/b" when "/a" was a primitive number doesn't throw a TypeError.
 */
function ensureObjectAncestors(root: StateModel, pointer: string): StateModel {
  if (pointer === "/" || pointer === "") return root;
  const segments = pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));

  let currentRoot = root;
  let cursor: unknown = currentRoot;
  let prefix = "";

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    prefix += `/${seg.replace(/~/g, "~0").replace(/\//g, "~1")}`;
    if (cursor !== null && cursor !== undefined && typeof cursor === "object") {
      cursor = Array.isArray(cursor)
        ? cursor[Number(seg)]
        : (cursor as Record<string, unknown>)[seg];
    } else {
      cursor = undefined;
    }

    if (cursor !== null && cursor !== undefined && typeof cursor !== "object") {
      // Intermediate segment is a primitive; promote it to an empty object first
      currentRoot = immutableSetByPath(currentRoot, prefix, {});
      cursor = {};
    }
  }

  return currentRoot;
}

/**
 * Creates an isolated, structural-sharing bidirectional StateStore with:
 * - RFC 6901 pointer validation & prototype pollution blocking
 * - Deterministic permutation-invariant batch `update()`
 * - Time-travel snapshot ring buffer (`undo`, `redo`, `jumpToSnapshot`)
 * - Synchronous `watch` cascade circuit breaker
 */
export function createTimeTravelStateStore(
  initialState: StateModel = {},
  options: TimeTravelStateStoreOptions = {},
): TimeTravelStateStore {
  const maxHistory = Math.max(2, options.maxHistory ?? 128);
  const maxCascadeDepth = Math.max(1, options.maxCascadeDepth ?? 10);

  let currentSnapshot: StateModel = deepFreezeValue(
    (sanitizeStateValue(initialState, "/initial") ?? {}) as StateModel,
  );

  let history: StateHistoryEntry[] = [
    Object.freeze({
      index: 0,
      timestamp: Date.now(),
      label: "Initial State",
      changedPaths: Object.freeze([]),
      snapshot: currentSnapshot,
    }),
  ];
  let historyCursor = 0;
  let reentrantDepth = 0;
  let cascadeTripCount = 0;

  const listeners = new Set<() => void>();

  function notifyListeners(): void {
    reentrantDepth += 1;
    try {
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          // Isolate listener errors
        }
      }
    } finally {
      reentrantDepth -= 1;
    }
  }

  function pushHistorySnapshot(
    nextSnapshot: StateModel,
    label: string,
    changedPaths: string[],
  ): void {
    // Truncate any redo branch ahead of historyCursor
    const activeBranch = history.slice(0, historyCursor + 1);
    const nextEntry: StateHistoryEntry = {
      index: activeBranch.length,
      timestamp: Date.now(),
      label,
      changedPaths,
      snapshot: nextSnapshot,
    };

    const combined = [...activeBranch, nextEntry];
    if (combined.length > maxHistory) {
      const sliced = combined.slice(combined.length - maxHistory);
      history = sliced.map((entry, idx) => ({
        ...entry,
        index: idx,
      }));
      historyCursor = history.length - 1;
    } else {
      history = combined;
      historyCursor = history.length - 1;
    }
  }

  return {
    get(path: string): unknown {
      const safePath = normalizeSafePointer(path);
      if (!safePath) return undefined;
      if (safePath === "/") return currentSnapshot;
      return getByPath(currentSnapshot, safePath);
    },

    set(path: string, value: unknown): void {
      const safePath = normalizeSafePointer(path);
      if (!safePath || safePath === "/") {
        return;
      }

      if (reentrantDepth >= maxCascadeDepth) {
        cascadeTripCount += 1;
        options.onCascadeTrip?.(reentrantDepth, safePath);
        return;
      }

      const cleanValue = sanitizeStateValue(value, safePath);
      const existingValue = getByPath(currentSnapshot, safePath);

      // Idempotency guard: if reference (or primitive value) is identical, no-op
      if (Object.is(existingValue, cleanValue)) {
        return;
      }

      const preparedRoot = ensureObjectAncestors(currentSnapshot, safePath);
      const nextSnapshot = immutableSetByPath(
        preparedRoot,
        safePath,
        cleanValue,
      );

      if (nextSnapshot === currentSnapshot) {
        return;
      }

      currentSnapshot = deepFreezeValue(nextSnapshot);
      pushHistorySnapshot(currentSnapshot, `set ${safePath}`, [safePath]);
      notifyListeners();
    },

    update(updates: Record<string, unknown>): void {
      if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
        return;
      }

      if (reentrantDepth >= maxCascadeDepth) {
        cascadeTripCount += 1;
        options.onCascadeTrip?.(reentrantDepth, "/batch-update");
        return;
      }

      // Sort paths by depth (shallowest first) and then lexicographically so key insertion order
      // NEVER changes the resulting state snapshot (Fixes BUG-PBT-04)
      const validEntries: Array<{ path: string; depth: number; value: unknown }> = [];
      for (const rawKey of Object.keys(updates)) {
        const safePath = normalizeSafePointer(rawKey);
        if (!safePath || safePath === "/") continue;
        const depth = safePath.slice(1).split("/").length;
        validEntries.push({
          path: safePath,
          depth,
          value: sanitizeStateValue(updates[rawKey], safePath),
        });
      }

      validEntries.sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.path.localeCompare(b.path);
      });

      let workingSnapshot = currentSnapshot;
      const changedPaths: string[] = [];

      for (const entry of validEntries) {
        const existingValue = getByPath(workingSnapshot, entry.path);
        if (Object.is(existingValue, entry.value)) {
          continue;
        }
        const preparedRoot = ensureObjectAncestors(workingSnapshot, entry.path);
        const updated = immutableSetByPath(
          preparedRoot,
          entry.path,
          entry.value,
        );
        if (updated !== workingSnapshot) {
          workingSnapshot = updated;
          changedPaths.push(entry.path);
        }
      }

      if (changedPaths.length === 0 || workingSnapshot === currentSnapshot) {
        return;
      }

      currentSnapshot = deepFreezeValue(workingSnapshot);
      pushHistorySnapshot(
        currentSnapshot,
        `update (${changedPaths.length} paths)`,
        changedPaths,
      );
      notifyListeners();
    },

    getSnapshot(): StateModel {
      if (!Object.isFrozen(currentSnapshot)) {
        currentSnapshot = deepFreezeValue(currentSnapshot);
      }
      return currentSnapshot;
    },

    getServerSnapshot(): StateModel {
      if (!Object.isFrozen(currentSnapshot)) {
        currentSnapshot = deepFreezeValue(currentSnapshot);
      }
      return currentSnapshot;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    undo(): boolean {
      if (historyCursor <= 0) return false;
      historyCursor -= 1;
      currentSnapshot = history[historyCursor]!.snapshot;
      notifyListeners();
      return true;
    },

    redo(): boolean {
      if (historyCursor >= history.length - 1) return false;
      historyCursor += 1;
      currentSnapshot = history[historyCursor]!.snapshot;
      notifyListeners();
      return true;
    },

    jumpToSnapshot(index: number): boolean {
      if (!Number.isInteger(index) || index < 0 || index >= history.length) {
        return false;
      }
      if (index === historyCursor) return true;
      historyCursor = index;
      currentSnapshot = history[historyCursor]!.snapshot;
      notifyListeners();
      return true;
    },

    canUndo(): boolean {
      return historyCursor > 0;
    },

    canRedo(): boolean {
      return historyCursor < history.length - 1;
    },

    getCurrentHistoryIndex(): number {
      return historyCursor;
    },

    getHistory(): readonly StateHistoryEntry[] {
      return Object.freeze(
        history.map((entry) =>
          Object.freeze({
            ...entry,
            changedPaths: Object.freeze([...entry.changedPaths]),
            snapshot: deepFreezeValue(entry.snapshot),
          }),
        ),
      );
    },

    getCascadeTripCount(): number {
      return cascadeTripCount;
    },

    reset(nextInitialState: StateModel = {}): void {
      currentSnapshot = (sanitizeStateValue(
        nextInitialState,
        "/reset",
      ) ?? {}) as StateModel;
      history = [
        {
          index: 0,
          timestamp: Date.now(),
          label: "Initial State",
          changedPaths: [],
          snapshot: currentSnapshot,
        },
      ];
      historyCursor = 0;
      reentrantDepth = 0;
      cascadeTripCount = 0;
      notifyListeners();
    },
  };
}

export { flattenToPointers, immutableSetByPath, isSafeJsonPointer };
