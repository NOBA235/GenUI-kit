import {
  autoFixSpec,
  validateSpec,
  type Spec,
  type UIElement,
} from "@json-render/core";
import type {
  GraphInspectionResult,
  GraphIssue,
  SanitizeGraphOptions,
  SanitizeGraphResult,
} from "../types.js";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const UNSAFE_URI_REGEX = /^\s*(javascript|vbscript|data\s*:\s*text\/html)\s*:/i;

/**
 * Checks whether a single key or path segment is a prototype pollution vector.
 */
export function isDangerousKey(segment: string): boolean {
  const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~").trim();
  return DANGEROUS_KEYS.has(segment) || DANGEROUS_KEYS.has(decoded);
}

/**
 * Checks whether an RFC 6901 JSON Pointer path is safe from prototype pollution
 * and has a valid leading slash (or is empty root "").
 */
export function isSafeJsonPointer(pointer: unknown): boolean {
  if (typeof pointer !== "string") return false;
  if (pointer === "") return true;
  if (!pointer.startsWith("/")) return false;
  const segments = pointer.slice(1).split("/");
  for (const seg of segments) {
    if (isDangerousKey(seg)) {
      return false;
    }
  }
  return true;
}

/**
 * Normalizes a potentially un-slashed state path into a valid RFC 6901 pointer,
 * or returns null if the path contains prototype pollution segments.
 */
export function normalizeSafePointer(rawPath: string): string | null {
  if (typeof rawPath !== "string") return null;
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!isSafeJsonPointer(withSlash)) {
    return null;
  }
  return withSlash;
}

export const DEFAULT_MAX_VALUE_DEPTH = 32;
export const DEFAULT_MAX_VALUE_NODES = 10_000;

export interface DeepSanitizeCounters {
  healedNumbersCount: number;
  blockedUrisCount: number;
  blockedPathsCount: number;
  issues: GraphIssue[];
  nodeCount?: number;
  limitReached?: boolean;
}

export interface DeepSanitizeLimits {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

/**
 * Deeply clones and sanitizes an arbitrary value:
 * - Strips `__proto__`, `constructor`, `prototype` own properties
 * - Canonicalizes `-0` to `0` and heals `NaN` / `±Infinity` to `0`
 * - Blocks `javascript:`, `vbscript:`, and `data:text/html` URIs
 * - Protects against circular JS object references via a `WeakSet`
 * - Enforces nesting depth (`maxDepth`) and total node budget (`maxNodes`)
 */
export function deepCloneAndSanitizeValue(
  value: unknown,
  counters: DeepSanitizeCounters,
  pathContext = "",
  elementKey?: string,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
  limits: DeepSanitizeLimits = {},
): unknown {
  const maxDepth = limits.maxDepth ?? DEFAULT_MAX_VALUE_DEPTH;
  const maxNodes = limits.maxNodes ?? DEFAULT_MAX_VALUE_NODES;

  counters.nodeCount = (counters.nodeCount ?? 0) + 1;
  if (counters.nodeCount > maxNodes) {
    if (!counters.limitReached) {
      counters.limitReached = true;
      counters.issues.push({
        severity: "error",
        code: "value_budget_exceeded",
        message: `Value node count exceeded maxNodes (${maxNodes}) at "${pathContext}".`,
        elementKey,
        path: pathContext,
      });
    }
    return null;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number") {
    if (Object.is(value, -0)) {
      return 0;
    }
    if (!Number.isFinite(value)) {
      counters.healedNumbersCount += 1;
      counters.issues.push({
        severity: "warning",
        code: "healed_non_finite_number",
        message: `Non-finite number (${String(value)}) at "${pathContext}" healed to 0.`,
        elementKey,
        path: pathContext,
      });
      return 0;
    }
    return value;
  }

  if (typeof value === "string") {
    if (UNSAFE_URI_REGEX.test(value)) {
      counters.blockedUrisCount += 1;
      counters.issues.push({
        severity: "error",
        code: "blocked_unsafe_uri",
        message: `Blocked unsafe URI scheme in "${pathContext}".`,
        elementKey,
        path: pathContext,
      });
      return "#blocked-unsafe-uri";
    }
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    counters.issues.push({
      severity: "error",
      code: "cyclic_reference",
      message: `Circular JavaScript object reference severed at "${pathContext}".`,
      elementKey,
      path: pathContext,
    });
    return null;
  }

  if (depth >= maxDepth) {
    counters.issues.push({
      severity: "error",
      code: "value_depth_exceeded",
      message: `Value nesting depth exceeds maxDepth (${maxDepth}) at "${pathContext}".`,
      elementKey,
      path: pathContext,
    });
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let idx = 0; idx < value.length; idx += 1) {
      if ((counters.nodeCount ?? 0) >= maxNodes) {
        if (!counters.limitReached) {
          counters.limitReached = true;
          counters.issues.push({
            severity: "error",
            code: "value_budget_exceeded",
            message: `Value node count exceeded maxNodes (${maxNodes}) at "${pathContext}".`,
            elementKey,
            path: pathContext,
          });
        }
        break;
      }
      out.push(
        deepCloneAndSanitizeValue(
          value[idx],
          counters,
          `${pathContext}/${idx}`,
          elementKey,
          seen,
          depth + 1,
          limits,
        ),
      );
    }
    seen.delete(value);
    return out;
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (isDangerousKey(key)) {
      counters.blockedPathsCount += 1;
      counters.issues.push({
        severity: "error",
        code: "blocked_unsafe_path",
        message: `Blocked prototype pollution key "${key}" at "${pathContext}".`,
        elementKey,
        path: `${pathContext}/${key}`,
      });
      continue;
    }
    if ((counters.nodeCount ?? 0) >= maxNodes) {
      if (!counters.limitReached) {
        counters.limitReached = true;
        counters.issues.push({
          severity: "error",
          code: "value_budget_exceeded",
          message: `Value node count exceeded maxNodes (${maxNodes}) at "${pathContext}".`,
          elementKey,
          path: pathContext,
        });
      }
      break;
    }
    const rawChild = (value as Record<string, unknown>)[key];
    out[key] = deepCloneAndSanitizeValue(
      rawChild,
      counters,
      `${pathContext}/${key}`,
      elementKey,
      seen,
      depth + 1,
      limits,
    );
  }

  seen.delete(value);
  return out;
}

const WHITE = 0; // Unvisited
const GRAY = 1; // Visiting (currently on DFS stack)
const BLACK = 2; // Visited

/**
 * Inspects a Spec's element topology using 3-color DFS to detect:
 * - Direct self-loops (A -> A)
 * - Multi-hop cycles (A -> B -> C -> A)
 * - Slot cycles (layout.slots.header -> nav -> layout)
 * - Duplicate sibling keys & diamond multi-parent aliasing
 * - Exceeded depth or element count budgets
 * - Unknown component types
 */
export function inspectSpecGraph(
  spec: unknown,
  options: SanitizeGraphOptions = {},
): GraphInspectionResult {
  const maxDepth = options.maxDepth ?? 16;
  const maxElements = options.maxElements ?? 500;
  const allowedSet = options.allowedComponents
    ? new Set(options.allowedComponents)
    : null;

  const issues: GraphIssue[] = [];

  if (
    !spec ||
    typeof spec !== "object" ||
    Array.isArray(spec)
  ) {
    return {
      valid: false,
      hasCycles: false,
      maxObservedDepth: 0,
      reachableElementCount: 0,
      totalElementCount: 0,
      issues: [
        {
          severity: "error",
          code: "empty_spec",
          message: "Spec is null or not a valid plain object.",
        },
      ],
      topologicalOrder: [],
    };
  }

  const candidate = spec as Partial<Spec>;
  const rootKey = typeof candidate.root === "string" ? candidate.root : "";
  const rawElements =
    candidate.elements &&
    typeof candidate.elements === "object" &&
    !Array.isArray(candidate.elements)
      ? (candidate.elements as Record<string, UIElement>)
      : {};

  const elementKeys = Object.keys(rawElements).filter((k) => !isDangerousKey(k));
  const totalElementCount = elementKeys.length;

  if (!rootKey) {
    issues.push({
      severity: "error",
      code: "missing_root",
      message: "Spec is missing a valid string root key.",
    });
  } else if (!Object.prototype.hasOwnProperty.call(rawElements, rootKey)) {
    issues.push({
      severity: "error",
      code: "root_not_found",
      message: `Root element "${rootKey}" does not exist in spec.elements.`,
      elementKey: rootKey,
    });
  }

  if (totalElementCount > maxElements) {
    issues.push({
      severity: "error",
      code: "element_budget_exceeded",
      message: `Spec contains ${totalElementCount} elements, exceeding maxElements (${maxElements}).`,
    });
  }

  // Run @json-render/core's built-in structural checks first on a safe surface
  try {
    if (rootKey && Object.prototype.hasOwnProperty.call(rawElements, rootKey)) {
      const coreResult = validateSpec(
        {
          root: rootKey,
          elements: rawElements,
          ...(candidate.state && typeof candidate.state === "object"
            ? { state: candidate.state as Record<string, unknown> }
            : {}),
        },
        { checkOrphans: false },
      );
      for (const issue of coreResult.issues) {
        issues.push({
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          elementKey: issue.elementKey,
        });
      }
    }
  } catch {
    // If validateSpec throws on deeply corrupted structures, 3-color DFS below catches it
  }

  const color = new Map<string, number>();
  const mountedNodes = new Set<string>();
  const topologicalOrder: string[] = [];
  let hasCycles = false;
  let maxObservedDepth = 0;
  let reachableElementCount = 0;

  for (const key of elementKeys) {
    color.set(key, WHITE);
    const el = rawElements[key];
    if (el && typeof el === "object") {
      if (allowedSet && typeof el.type === "string" && !allowedSet.has(el.type)) {
        issues.push({
          severity: "error",
          code: "unknown_component",
          message: `Element "${key}" uses unknown component type "${el.type}".`,
          elementKey: key,
        });
      }
    }
  }

  function dfs(nodeKey: string, depth: number, fromRoot: boolean): void {
    color.set(nodeKey, GRAY);
    if (fromRoot) {
      reachableElementCount += 1;
      if (depth > maxObservedDepth) {
        maxObservedDepth = depth;
      }
    }

    if (depth > maxDepth) {
      issues.push({
        severity: "error",
        code: "depth_limit_exceeded",
        message: `Element "${nodeKey}" at depth ${depth} exceeds maxDepth (${maxDepth}).`,
        elementKey: nodeKey,
      });
      color.set(nodeKey, BLACK);
      topologicalOrder.push(nodeKey);
      return;
    }

    const el = rawElements[nodeKey];
    if (el && typeof el === "object") {
      const seenSiblings = new Set<string>();
      const edges: Array<{ target: string; edgePath: string }> = [];

      if (Array.isArray(el.children)) {
        el.children.forEach((child, idx) => {
          if (typeof child === "string") {
            edges.push({ target: child, edgePath: `children[${idx}]` });
          }
        });
      }

      if (el.slots && typeof el.slots === "object" && !Array.isArray(el.slots)) {
        for (const [slotName, slotChildren] of Object.entries(el.slots)) {
          if (Array.isArray(slotChildren)) {
            slotChildren.forEach((child, idx) => {
              if (typeof child === "string") {
                edges.push({
                  target: child,
                  edgePath: `slots.${slotName}[${idx}]`,
                });
              }
            });
          }
        }
      }

      for (const { target, edgePath } of edges) {
        if (!Object.prototype.hasOwnProperty.call(rawElements, target)) {
          continue; // Handled by missing_child
        }

        const targetColor = color.get(target) ?? WHITE;
        if (targetColor === GRAY) {
          hasCycles = true;
          issues.push({
            severity: "error",
            code: "cyclic_reference",
            message: `Cyclic reference detected: "${nodeKey}" -> "${target}" via ${edgePath}.`,
            elementKey: nodeKey,
            targetKey: target,
            path: edgePath,
          });
          continue;
        }

        if (seenSiblings.has(target)) {
          issues.push({
            severity: "warning",
            code: "duplicate_child_key",
            message: `Element "${nodeKey}" references child "${target}" multiple times (${edgePath}).`,
            elementKey: nodeKey,
            targetKey: target,
            path: edgePath,
          });
          continue;
        }
        seenSiblings.add(target);

        if (mountedNodes.has(target)) {
          issues.push({
            severity: "warning",
            code: "shared_node_aliasing",
            message: `Element "${target}" is referenced by multiple parents (including "${nodeKey}" via ${edgePath}).`,
            elementKey: nodeKey,
            targetKey: target,
            path: edgePath,
          });
          continue;
        }

        mountedNodes.add(target);
        if (targetColor === WHITE) {
          dfs(target, depth + 1, fromRoot);
        }
      }
    }

    color.set(nodeKey, BLACK);
    topologicalOrder.push(nodeKey);
  }

  if (rootKey && Object.prototype.hasOwnProperty.call(rawElements, rootKey)) {
    mountedNodes.add(rootKey);
    dfs(rootKey, 1, true);
  }

  // Also scan any disconnected subgraphs for cycles
  for (const key of elementKeys) {
    if ((color.get(key) ?? WHITE) === WHITE) {
      dfs(key, 1, false);
    }
  }

  const hasError = issues.some((i) => i.severity === "error");

  return {
    valid: !hasError && !hasCycles,
    hasCycles,
    maxObservedDepth,
    reachableElementCount,
    totalElementCount,
    issues,
    topologicalOrder: topologicalOrder.reverse(),
  };
}

/**
 * Deterministically sanitizes an arbitrary or adversarial Spec into a cycle-free,
 * depth-bounded, prototype-safe DAG.
 *
 * Guarantees idempotence:
 * `sanitizeSpecGraph(sanitizeSpecGraph(s, opts).spec, opts).spec` deeply equals `sanitizeSpecGraph(s, opts).spec`.
 */
export function sanitizeSpecGraph(
  rawSpec: unknown,
  options: SanitizeGraphOptions = {},
): SanitizeGraphResult {
  const maxDepth = options.maxDepth ?? 16;
  const maxElements = options.maxElements ?? 500;
  const pruneMissingChildren = options.pruneMissingChildren ?? true;

  const counters: DeepSanitizeCounters = {
    healedNumbersCount: 0,
    blockedUrisCount: 0,
    blockedPathsCount: 0,
    issues: [],
  };

  if (!rawSpec || typeof rawSpec !== "object" || Array.isArray(rawSpec)) {
    const emptySpec: Spec = { root: "", elements: {} };
    return {
      spec: emptySpec,
      inspection: inspectSpecGraph(emptySpec, options),
      severedCyclesCount: 0,
      healedNumbersCount: 0,
      blockedUrisCount: 0,
      blockedPathsCount: 0,
      autoFixes: [],
    };
  }

  const inputObj = rawSpec as Record<string, unknown>;
  const rawRoot = typeof inputObj.root === "string" && !isDangerousKey(inputObj.root)
    ? inputObj.root
    : "";

  const rawElementsMap =
    inputObj.elements &&
    typeof inputObj.elements === "object" &&
    !Array.isArray(inputObj.elements)
      ? (inputObj.elements as Record<string, unknown>)
      : {};

  // 1. Enforce element budget deterministically (always keeping root first if present)
  const allSafeKeys = Object.keys(rawElementsMap).filter((key) => {
    if (isDangerousKey(key)) {
      counters.blockedPathsCount += 1;
      counters.issues.push({
        severity: "error",
        code: "blocked_unsafe_path",
        message: `Blocked prototype pollution element key "${key}".`,
        elementKey: key,
      });
      return false;
    }
    return true;
  });

  let budgetedKeys = allSafeKeys;
  if (allSafeKeys.length > maxElements) {
    counters.issues.push({
      severity: "error",
      code: "element_budget_exceeded",
      message: `Truncated elements from ${allSafeKeys.length} to maxElements (${maxElements}).`,
    });
    const orderedKeys =
      rawRoot && allSafeKeys.includes(rawRoot)
        ? [rawRoot, ...allSafeKeys.filter((k) => k !== rawRoot)]
        : allSafeKeys;
    budgetedKeys = orderedKeys.slice(0, maxElements);
  }

  // 2. Normalize each element structure and deep-sanitize props/state
  const cleanElements: Record<string, UIElement> = {};
  for (const key of budgetedKeys) {
    const rawEl = rawElementsMap[key];
    if (!rawEl || typeof rawEl !== "object" || Array.isArray(rawEl)) {
      continue;
    }
    const elRecord = rawEl as Record<string, unknown>;
    const type =
      typeof elRecord.type === "string" && elRecord.type.trim().length > 0
        ? elRecord.type.trim()
        : "Unknown";

    const rawProps =
      elRecord.props &&
      typeof elRecord.props === "object" &&
      !Array.isArray(elRecord.props)
        ? (elRecord.props as Record<string, unknown>)
        : {};

    const sanitizedProps = deepCloneAndSanitizeValue(
      rawProps,
      counters,
      `/elements/${key}/props`,
      key,
    ) as Record<string, unknown>;

    const children = Array.isArray(elRecord.children)
      ? elRecord.children.filter(
          (c): c is string => typeof c === "string" && !isDangerousKey(c),
        )
      : [];

    let sanitizedSlots: Record<string, string[]> | undefined;
    if (
      elRecord.slots &&
      typeof elRecord.slots === "object" &&
      !Array.isArray(elRecord.slots)
    ) {
      sanitizedSlots = {};
      for (const [slotName, slotArr] of Object.entries(
        elRecord.slots as Record<string, unknown>,
      )) {
        if (isDangerousKey(slotName)) {
          counters.blockedPathsCount += 1;
          continue;
        }
        if (Array.isArray(slotArr)) {
          sanitizedSlots[slotName] = slotArr.filter(
            (c): c is string => typeof c === "string" && !isDangerousKey(c),
          );
        }
      }
    }

    const cleanEl: UIElement = {
      type,
      props: sanitizedProps,
      children,
      ...(sanitizedSlots ? { slots: sanitizedSlots } : {}),
      ...(elRecord.visible !== undefined
        ? {
            visible: deepCloneAndSanitizeValue(
              elRecord.visible,
              counters,
              `/elements/${key}/visible`,
              key,
            ) as UIElement["visible"],
          }
        : {}),
      ...(elRecord.on &&
      typeof elRecord.on === "object" &&
      !Array.isArray(elRecord.on)
        ? {
            on: deepCloneAndSanitizeValue(
              elRecord.on,
              counters,
              `/elements/${key}/on`,
              key,
            ) as UIElement["on"],
          }
        : {}),
      ...(elRecord.repeat &&
      typeof elRecord.repeat === "object" &&
      !Array.isArray(elRecord.repeat)
        ? {
            repeat: deepCloneAndSanitizeValue(
              elRecord.repeat,
              counters,
              `/elements/${key}/repeat`,
              key,
            ) as UIElement["repeat"],
          }
        : {}),
      ...(elRecord.watch &&
      typeof elRecord.watch === "object" &&
      !Array.isArray(elRecord.watch)
        ? {
            watch: deepCloneAndSanitizeValue(
              elRecord.watch,
              counters,
              `/elements/${key}/watch`,
              key,
            ) as UIElement["watch"],
          }
        : {}),
    };

    cleanElements[key] = cleanEl;
  }

  const sanitizedState =
    inputObj.state &&
    typeof inputObj.state === "object" &&
    !Array.isArray(inputObj.state)
      ? (deepCloneAndSanitizeValue(
          inputObj.state,
          counters,
          "/state",
        ) as Record<string, unknown>)
      : undefined;

  let workingSpec: Spec = {
    root: rawRoot,
    elements: cleanElements,
    ...(sanitizedState !== undefined ? { state: sanitizedState } : {}),
  };

  // 3. Apply @json-render/core's autoFixSpec (hoisting misplaced visible/on/repeat/watch from props)
  let autoFixes: string[] = [];
  try {
    const fixedResult = autoFixSpec(workingSpec, {
      lossy: pruneMissingChildren,
    });
    workingSpec = fixedResult.spec;
    autoFixes = fixedResult.fixes;
  } catch {
    // Continue with our own graph sanitizer
  }

  // 4. 3-color DFS + single-parent tree enforcement to sever cycles, deduplicate siblings, and bound depth
  const color = new Map<string, number>();
  const mountedNodes = new Set<string>();
  let severedCyclesCount = 0;

  for (const key of Object.keys(workingSpec.elements)) {
    color.set(key, WHITE);
  }

  function sanitizeNode(nodeKey: string, depth: number): void {
    color.set(nodeKey, GRAY);
    const el = workingSpec.elements[nodeKey];
    if (!el) {
      color.set(nodeKey, BLACK);
      return;
    }

    const filterChildList = (list: string[], edgeContext: string): string[] => {
      const kept: string[] = [];
      for (const childKey of list) {
        const exists = Object.prototype.hasOwnProperty.call(
          workingSpec.elements,
          childKey,
        );
        if (!exists) {
          if (pruneMissingChildren) {
            counters.issues.push({
              severity: "warning",
              code: "missing_child",
              message: `Pruned missing child "${childKey}" from "${nodeKey}" (${edgeContext}).`,
              elementKey: nodeKey,
              targetKey: childKey,
            });
            continue;
          }
          kept.push(childKey);
          continue;
        }

        const childColor = color.get(childKey) ?? WHITE;
        if (childColor === GRAY) {
          // Cycle detected! Sever back-edge
          severedCyclesCount += 1;
          counters.issues.push({
            severity: "error",
            code: "cyclic_reference",
            message: `Severed cyclic back-edge "${nodeKey}" -> "${childKey}" at ${edgeContext}.`,
            elementKey: nodeKey,
            targetKey: childKey,
            path: edgeContext,
          });
          continue;
        }

        if (depth + 1 > maxDepth) {
          counters.issues.push({
            severity: "error",
            code: "depth_limit_exceeded",
            message: `Severed child "${childKey}" on "${nodeKey}" because depth ${depth + 1} exceeds maxDepth (${maxDepth}).`,
            elementKey: nodeKey,
            targetKey: childKey,
            path: edgeContext,
          });
          continue;
        }

        if (mountedNodes.has(childKey)) {
          // Already mounted either as a sibling or under another branch (diamond aliasing)
          counters.issues.push({
            severity: "warning",
            code: "duplicate_child_key",
            message: `Deduplicated shared/repeated child reference "${childKey}" on "${nodeKey}" (${edgeContext}).`,
            elementKey: nodeKey,
            targetKey: childKey,
            path: edgeContext,
          });
          continue;
        }

        mountedNodes.add(childKey);
        kept.push(childKey);
        if (childColor === WHITE) {
          sanitizeNode(childKey, depth + 1);
        }
      }
      return kept;
    };

    if (Array.isArray(el.children)) {
      el.children = filterChildList(el.children, "children");
    } else {
      el.children = [];
    }

    if (el.slots && typeof el.slots === "object") {
      const nextSlots: Record<string, string[]> = {};
      for (const [slotName, slotList] of Object.entries(el.slots)) {
        if (Array.isArray(slotList)) {
          nextSlots[slotName] = filterChildList(slotList, `slots.${slotName}`);
        }
      }
      el.slots = nextSlots;
    }

    color.set(nodeKey, BLACK);
  }

  if (
    workingSpec.root &&
    Object.prototype.hasOwnProperty.call(workingSpec.elements, workingSpec.root)
  ) {
    mountedNodes.add(workingSpec.root);
    sanitizeNode(workingSpec.root, 1);
  }

  // Also sanitize any unreachable islands so the entire elements map is guaranteed cycle-free
  for (const key of Object.keys(workingSpec.elements)) {
    if ((color.get(key) ?? WHITE) === WHITE) {
      mountedNodes.add(key);
      sanitizeNode(key, 1);
    }
  }

  const finalInspection = inspectSpecGraph(workingSpec, options);
  const combinedIssues: GraphIssue[] = [
    ...counters.issues,
    ...finalInspection.issues,
  ];

  return {
    spec: workingSpec,
    inspection: {
      ...finalInspection,
      issues: combinedIssues,
    },
    severedCyclesCount,
    healedNumbersCount: counters.healedNumbersCount,
    blockedUrisCount: counters.blockedUrisCount,
    blockedPathsCount: counters.blockedPathsCount,
    autoFixes,
  };
}
