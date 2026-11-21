import type { TimeTravelStateStore } from "../types.js";
import { MAX_GUARD_DEPTH, type InteractionGuard } from "./rule-types.js";

/**
 * Compares primitive values (including Object.is equality) or plain JSON structures safely.
 */
export function deepEqualInteractionValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Pure, bounded JSON predicate evaluator over RFC 6901 state pointers.
 * Zero `eval`, zero dynamic code execution, and depth-capped at `MAX_GUARD_DEPTH`.
 */
export function evaluateInteractionGuard(
  guard: InteractionGuard,
  store: Pick<TimeTravelStateStore, "get">,
  depth = 0,
): boolean {
  if (depth > MAX_GUARD_DEPTH) {
    return false;
  }

  switch (guard.op) {
    case "and":
      return guard.guards.every((child) =>
        evaluateInteractionGuard(child, store, depth + 1),
      );
    case "or":
      return guard.guards.some((child) =>
        evaluateInteractionGuard(child, store, depth + 1),
      );
    case "not":
      return !evaluateInteractionGuard(guard.guard, store, depth + 1);
    case "truthy":
      return Boolean(store.get(guard.path));
    case "falsy":
      return !store.get(guard.path);
    case "eq":
      return deepEqualInteractionValue(store.get(guard.path), guard.value);
    case "neq":
      return !deepEqualInteractionValue(store.get(guard.path), guard.value);
    case "in": {
      const actual = store.get(guard.path);
      return guard.values.some((candidate) =>
        deepEqualInteractionValue(actual, candidate),
      );
    }
    case "gt": {
      const a = store.get(guard.path);
      const b = guard.value;
      return typeof a === "number" && typeof b === "number" && a > b;
    }
    case "gte": {
      const a = store.get(guard.path);
      const b = guard.value;
      return typeof a === "number" && typeof b === "number" && a >= b;
    }
    case "lt": {
      const a = store.get(guard.path);
      const b = guard.value;
      return typeof a === "number" && typeof b === "number" && a < b;
    }
    case "lte": {
      const a = store.get(guard.path);
      const b = guard.value;
      return typeof a === "number" && typeof b === "number" && a <= b;
    }
    default:
      return false;
  }
}
