import fs from "node:fs";
import path from "node:path";
import {
  createGuardrailedStreamCompiler,
  inspectSpecGraph,
  sanitizeSpecGraph,
  type GraphIssue,
} from "@genui-studio/core";

type Spec = ReturnType<typeof sanitizeSpecGraph>["spec"];

export interface ValidateSpecOptions {
  /** Allowed catalog component names (optional allowlist check) */
  readonly allowedComponents?: readonly string[];
  /** Maximum permitted tree depth (default: 16) */
  readonly maxDepth?: number;
  /** Maximum permitted element count (default: 500) */
  readonly maxElements?: number;
  /** Maximum single line length in bytes (default: 524288) */
  readonly maxLineLength?: number;
  /** Maximum total stream bytes (default: 8388608) */
  readonly maxTotalStreamBytes?: number;
  /** Treat warnings (healed floats, pruned dangling refs, duplicate keys) as validation failures */
  readonly strict?: boolean;
}

export interface ValidateSpecResult {
  readonly valid: boolean;
  readonly format: "spec-json" | "jsonl" | "sse";
  readonly elementCount: number;
  readonly reachableElementCount: number;
  readonly maxObservedDepth: number;
  readonly hasCycles: boolean;
  readonly appliedPatches: number;
  readonly rejectedLines: readonly string[];
  readonly issues: readonly GraphIssue[];
  readonly sanitizedSpec: Spec;
}

function detectInputFormat(trimmed: string): "spec-json" | "jsonl" | "sse" {
  const nonEmptyLines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("```") && !l.startsWith("//"));

  if (
    nonEmptyLines.some(
      (l) =>
        /^data:/i.test(l) ||
        /^event:/i.test(l) ||
        l.startsWith(":"),
    )
  ) {
    return "sse";
  }

  if (nonEmptyLines.length === 1) {
    try {
      const parsed = JSON.parse(nonEmptyLines[0]!) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && !("op" in parsed)) {
        return "spec-json";
      }
    } catch {
      // Fall through to jsonl
    }
  } else {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && !("op" in parsed)) {
        return "spec-json";
      }
    } catch {
      // Multi-line JSONL patches
    }
  }

  return "jsonl";
}

function dedupeIssues(issues: readonly GraphIssue[]): GraphIssue[] {
  const seen = new Set<string>();
  const out: GraphIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.severity}|${issue.code}|${issue.elementKey ?? ""}|${issue.targetKey ?? ""}|${issue.path ?? ""}|${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(issue);
    }
  }
  return out;
}

/**
 * Validates a generative UI Spec JSON object, RFC 6902 JSONL patch stream, or SSE stream
 * against DAG topology invariants, prototype pollution / XSS guards, and optional component allowlists.
 */
export function validateSpecContent(
  content: string,
  options: ValidateSpecOptions = {},
): ValidateSpecResult {
  const trimmed = content.trim();
  const maxDepth = options.maxDepth ?? 16;
  const maxElements = options.maxElements ?? 500;
  const strict = Boolean(options.strict);

  if (!trimmed) {
    const emptySpec: Spec = { root: "", elements: {} };
    return {
      valid: false,
      format: "jsonl",
      elementCount: 0,
      reachableElementCount: 0,
      maxObservedDepth: 0,
      hasCycles: false,
      appliedPatches: 0,
      rejectedLines: [],
      issues: [
        {
          severity: "error",
          code: "malformed_patch_line",
          message: "Input spec or stream is empty.",
        },
      ],
      sanitizedSpec: emptySpec,
    };
  }

  const format = detectInputFormat(trimmed);

  if (format === "spec-json") {
    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(trimmed);
    } catch (err) {
      const emptySpec: Spec = { root: "", elements: {} };
      return {
        valid: false,
        format,
        elementCount: 0,
        reachableElementCount: 0,
        maxObservedDepth: 0,
        hasCycles: false,
        appliedPatches: 0,
        rejectedLines: [trimmed.slice(0, 512)],
        issues: [
          {
            severity: "error",
            code: "malformed_patch_line",
            message: err instanceof Error ? err.message : "Invalid JSON spec.",
          },
        ],
        sanitizedSpec: emptySpec,
      };
    }

    const candidateObj =
      rawParsed &&
      typeof rawParsed === "object" &&
      !Array.isArray(rawParsed) &&
      "spec" in rawParsed &&
      (rawParsed as Record<string, unknown>).spec &&
      typeof (rawParsed as Record<string, unknown>).spec === "object"
        ? ((rawParsed as Record<string, unknown>).spec as Spec)
        : (rawParsed as Spec);

    const rawInspection = inspectSpecGraph(candidateObj, {
      maxDepth,
      maxElements,
      pruneMissingChildren: true,
      allowedComponents: options.allowedComponents,
    });
    const sanitized = sanitizeSpecGraph(candidateObj, {
      maxDepth,
      maxElements,
      pruneMissingChildren: true,
      allowedComponents: options.allowedComponents,
    });

    const issues = dedupeIssues([
      ...rawInspection.issues,
      ...sanitized.inspection.issues,
    ]);

    if (
      !sanitized.spec.root ||
      !Object.prototype.hasOwnProperty.call(
        sanitized.spec.elements,
        sanitized.spec.root,
      )
    ) {
      issues.push({
        severity: "error",
        code: "malformed_patch_line",
        message: sanitized.spec.root
          ? `Spec root element "${sanitized.spec.root}" does not exist in elements map.`
          : "Spec is missing a valid non-empty root element key.",
      });
    }

    const hasErrors =
      rawInspection.hasCycles ||
      issues.some((i) => i.severity === "error") ||
      (strict && issues.some((i) => i.severity === "warning"));

    return {
      valid: !hasErrors,
      format,
      elementCount: sanitized.inspection.totalElementCount,
      reachableElementCount: sanitized.inspection.reachableElementCount,
      maxObservedDepth: Math.max(
        rawInspection.maxObservedDepth,
        sanitized.inspection.maxObservedDepth,
      ),
      hasCycles: rawInspection.hasCycles,
      appliedPatches: 0,
      rejectedLines: [],
      issues,
      sanitizedSpec: sanitized.spec,
    };
  }

  // JSONL or SSE stream validation through GuardrailedStreamCompiler
  const compiler = createGuardrailedStreamCompiler({
    maxDepth,
    maxElements,
    maxLineLength: options.maxLineLength,
    maxBufferBytes: options.maxLineLength,
    maxTotalStreamBytes: options.maxTotalStreamBytes,
  });

  const collectedIssues: GraphIssue[] = [];
  const stepResult = compiler.push(content);
  collectedIssues.push(...stepResult.issues);
  const finalResult = compiler.finalize();
  collectedIssues.push(...finalResult.issues);

  const sanitized = sanitizeSpecGraph(finalResult.spec, {
    maxDepth,
    maxElements,
    pruneMissingChildren: true,
    allowedComponents: options.allowedComponents,
  });
  collectedIssues.push(...sanitized.inspection.issues);

  const issues = dedupeIssues(collectedIssues);
  if (
    !sanitized.spec.root ||
    !Object.prototype.hasOwnProperty.call(
      sanitized.spec.elements,
      sanitized.spec.root,
    )
  ) {
    issues.push({
      severity: "error",
      code: "malformed_patch_line",
      message: sanitized.spec.root
        ? `Finalized spec root "${sanitized.spec.root}" does not exist in elements map.`
        : "Finalized stream produced an empty or missing root element.",
    });
  }

  const rejectedLines = compiler.getRejectedLines();
  const hasCycles = issues.some((i) => i.code === "cyclic_reference");
  const hasErrors =
    rejectedLines.length > 0 ||
    hasCycles ||
    issues.some((i) => i.severity === "error") ||
    (strict && issues.some((i) => i.severity === "warning"));

  return {
    valid: !hasErrors,
    format,
    elementCount: sanitized.inspection.totalElementCount,
    reachableElementCount: sanitized.inspection.reachableElementCount,
    maxObservedDepth: sanitized.inspection.maxObservedDepth,
    hasCycles,
    appliedPatches: compiler.getAppliedPatches().length,
    rejectedLines,
    issues,
    sanitizedSpec: sanitized.spec,
  };
}

/**
 * Loads an optional component allowlist JSON file (array of component names OR `{ components: { Name: ... } }`).
 */
export function loadAllowedComponentsFile(filePath: string): string[] {
  const abs = path.resolve(filePath);
  const parsed = JSON.parse(fs.readFileSync(abs, "utf-8")) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.filter((v): v is string => typeof v === "string");
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "components" in parsed &&
    (parsed as Record<string, unknown>).components &&
    typeof (parsed as Record<string, unknown>).components === "object"
  ) {
    return Object.keys(
      (parsed as Record<string, unknown>).components as Record<string, unknown>,
    );
  }
  throw new Error(
    `Catalog file "${filePath}" must be a JSON string array or an object with a "components" map.`,
  );
}

/**
 * Reads a `.json`, `.jsonl`, or `.sse` file from disk and validates it.
 */
export function validateSpecFile(
  filePath: string,
  options: ValidateSpecOptions = {},
): ValidateSpecResult {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Spec file not found: ${abs}`);
  }
  const content = fs.readFileSync(abs, "utf-8");
  return validateSpecContent(content, options);
}
