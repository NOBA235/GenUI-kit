import type { Spec, UIElement } from "@json-render/core";
import {
  createGuardrailedStreamCompiler,
  inspectSpecGraph,
  sanitizeSpecGraph,
  type GraphInspectionResult,
  type GraphIssue,
  type PropDiagnostic,
} from "@genui-studio/core";
import { getVerifiedCatalog, type AppCatalogKey } from "../catalogs/index.js";

export interface ValidateUiSpecInput {
  app?: "spatial";
  spec: unknown;
  autoFix?: boolean;
}

export interface ValidateUiSpecResult {
  valid: boolean;
  app: "spatial";
  catalogHash: string;
  graph: {
    hasCycles: boolean;
    maxObservedDepth: number;
    reachableElementCount: number;
    totalElementCount: number;
    issueCount: number;
    issues: readonly GraphIssue[];
  };
  diagnostics: readonly PropDiagnostic[];
  healedCount: number;
  rejectedCount: number;
  autoFixedSpec: Spec | null;
  autoFixSuggestions: string[];
  summary: string;
}

/**
 * Normalizes input: if it's a JSON string or JSONL stream, parses/compiles it.
 */
function normalizeSpecInput(
  rawInput: unknown,
  app: AppCatalogKey,
): { spec: Spec; parsingErrors: string[] } {
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    // 1. Try direct JSON parse
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.elements) {
          return { spec: parsed as Spec, parsingErrors: [] };
        }
      } catch {
        // Fall through to JSONL stream compiler
      }
    }

    // 2. Try JSONL stream compiler (or markdown fenced block)
    const verifiedCat = getVerifiedCatalog(app);
    const compiler = createGuardrailedStreamCompiler({ catalog: verifiedCat });
    compiler.push(rawInput);
    const finalStep = compiler.finalize();
    return {
      spec: finalStep.spec,
      parsingErrors: [],
    };
  }

  if (rawInput && typeof rawInput === "object") {
    const candidate = rawInput as Record<string, unknown>;
    const root = typeof candidate.root === "string" ? candidate.root : "root";
    const elements =
      candidate.elements && typeof candidate.elements === "object"
        ? (candidate.elements as Record<string, UIElement>)
        : {};
    const state =
      candidate.state && typeof candidate.state === "object"
        ? (candidate.state as Record<string, unknown>)
        : {};

    return {
      spec: { root, elements, state },
      parsingErrors: [],
    };
  }

  return {
    spec: { root: "root", elements: {} },
    parsingErrors: ["Input is not a valid Spec object or JSON/JSONL string."],
  };
}

export function handleValidateUiSpec(
  input: ValidateUiSpecInput,
): ValidateUiSpecResult {
  const app: AppCatalogKey = input.app ?? "spatial";
  const verifiedCat = getVerifiedCatalog(app);
  const autoFix = input.autoFix ?? true;

  const { spec, parsingErrors } = normalizeSpecInput(input.spec, app);
  const inspection: GraphInspectionResult = inspectSpecGraph(spec);

  // Validate elements against catalog schemas
  const propDiagnostics: PropDiagnostic[] = [];
  const autoFixSuggestions: string[] = [];
  let healedCount = 0;
  let rejectedCount = 0;

  const allowedComponents = new Set(verifiedCat.metadata.componentNames);
  const healedElements: Record<string, UIElement> = {};

  for (const [key, element] of Object.entries(spec.elements || {})) {
    if (!element || typeof element !== "object") continue;

    // Check unknown component
    if (!allowedComponents.has(element.type)) {
      autoFixSuggestions.push(
        `Element "${key}" specifies unknown component type "${element.type}". Available components: ${verifiedCat.metadata.componentNames.join(
          ", ",
        )}`,
      );
    }

    // Validate and heal props
    const healResult = verifiedCat.validateAndHealProps(
      key,
      element.type,
      element.props || {},
    );

    propDiagnostics.push(...healResult.diagnostics);
    healedCount += healResult.healedCount;
    rejectedCount += healResult.rejectedCount;

    for (const diag of healResult.diagnostics) {
      if (diag.status === "healed") {
        autoFixSuggestions.push(
          `Element "${key}" (${element.type}) prop "${diag.propName}" out-of-bounds: healed from ${JSON.stringify(
            diag.originalValue,
          )} to ${JSON.stringify(diag.resolvedValue)} (${diag.reason})`,
        );
      } else if (diag.status === "rejected") {
        autoFixSuggestions.push(
          `Element "${key}" (${element.type}) prop "${diag.propName}" invalid: rejected value ${JSON.stringify(
            diag.originalValue,
          )} (${diag.reason})`,
        );
      }
    }

    healedElements[key] = {
      type: element.type,
      props: healResult.props,
      children: element.children ? [...element.children] : undefined,
      slots: element.slots ? { ...element.slots } : undefined,
      visible: element.visible,
      on: element.on,
    };
  }

  // Handle graph structural issues
  for (const issue of inspection.issues) {
    if (issue.code === "cyclic_reference") {
      autoFixSuggestions.push(
        `Cyclic edge detected targeting element "${issue.targetKey}" from "${issue.elementKey}". Cycles must be severed into DAG.`,
      );
    } else if (issue.code === "missing_child") {
      autoFixSuggestions.push(
        `Dangling pointer detected: element "${issue.elementKey}" references non-existent child "${issue.targetKey}".`,
      );
    } else if (issue.code === "blocked_unsafe_path") {
      autoFixSuggestions.push(
        `Prototype pollution attempt blocked: forbidden key "${issue.path}" removed.`,
      );
    }
  }

  let autoFixedSpec: Spec | null = null;
  if (autoFix) {
    const preHealedSpec: Spec = {
      root: spec.root,
      elements: healedElements,
      state: spec.state,
    };
    const sanitized = sanitizeSpecGraph(preHealedSpec, {
      allowedComponents: verifiedCat.metadata.componentNames,
      pruneMissingChildren: true,
    });
    autoFixedSpec = sanitized.spec;
  }

  const isValid =
    inspection.valid &&
    !inspection.hasCycles &&
    parsingErrors.length === 0 &&
    propDiagnostics.every((d) => d.status === "valid");

  const summary = isValid
    ? `Spec is 100% valid DAG conforming to @genui-studio/${app} catalog (hash: ${verifiedCat.metadata.catalogHash.slice(
        0,
        12,
      )}).`
    : `Spec contains ${inspection.issues.length} structural issue(s) and ${propDiagnostics.length} prop diagnostic(s) (${healedCount} healed, ${rejectedCount} rejected). ${
        autoFix ? "Auto-fixed render-safe Spec generated." : ""
      }`;

  return {
    valid: isValid,
    app,
    catalogHash: verifiedCat.metadata.catalogHash,
    graph: {
      hasCycles: inspection.hasCycles,
      maxObservedDepth: inspection.maxObservedDepth,
      reachableElementCount: inspection.reachableElementCount,
      totalElementCount: inspection.totalElementCount,
      issueCount: inspection.issues.length,
      issues: inspection.issues,
    },
    diagnostics: propDiagnostics,
    healedCount,
    rejectedCount,
    autoFixedSpec,
    autoFixSuggestions,
    summary,
  };
}
