import type {
  Catalog,
  PromptOptions,
  SchemaDefinition,
  Spec,
  SpecIssue,
  SpecStreamLine,
  StateModel,
  StateStore,
} from "@json-render/core";

/**
 * Granular diagnostic emitted when a component prop is healed or rejected
 * at the catalog schema boundary.
 */
export interface PropDiagnostic {
  readonly elementKey: string;
  readonly componentType: string;
  readonly propName: string;
  readonly status: "valid" | "healed" | "rejected";
  readonly originalValue: unknown;
  readonly resolvedValue: unknown;
  readonly reason: string;
}

/**
 * Fault record captured when an element fails schema validation in strict mode
 * or throws a runtime exception inside its React Error Boundary.
 */
export interface ElementFaultRecord {
  readonly id: string;
  readonly elementKey: string;
  readonly componentType: string;
  readonly phase: "schema_validation" | "prop_resolution" | "react_render";
  readonly message: string;
  readonly diagnostics?: readonly PropDiagnostic[];
  readonly timestamp: number;
}

/**
 * Machine-readable codes for graph & security issues detected by the DAG Sanitizer.
 */
export type GraphIssueCode =
  | SpecIssue["code"]
  | "cyclic_reference"
  | "duplicate_child_key"
  | "shared_node_aliasing"
  | "depth_limit_exceeded"
  | "element_budget_exceeded"
  | "blocked_unsafe_path"
  | "blocked_unsafe_uri"
  | "healed_non_finite_number"
  | "unknown_component"
  | "malformed_patch_line";

/**
 * Extended structural / security issue reported by @genui-studio/core.
 */
export interface GraphIssue {
  readonly severity: "error" | "warning" | "info";
  readonly code: GraphIssueCode;
  readonly message: string;
  readonly elementKey?: string;
  readonly targetKey?: string;
  readonly path?: string;
}

/**
 * Result of inspecting a Spec's element topology via 3-color DFS.
 */
export interface GraphInspectionResult {
  readonly valid: boolean;
  readonly hasCycles: boolean;
  readonly maxObservedDepth: number;
  readonly reachableElementCount: number;
  readonly totalElementCount: number;
  readonly issues: readonly GraphIssue[];
  readonly topologicalOrder: readonly string[];
}

/**
 * Options for DAG inspection and sanitization.
 */
export interface SanitizeGraphOptions {
  /** Maximum allowed tree depth from root (default: 16) */
  readonly maxDepth?: number;
  /** Maximum allowed total elements in spec (default: 500) */
  readonly maxElements?: number;
  /** Whether to prune missing child/slot references (default: true on finalize, false while streaming) */
  readonly pruneMissingChildren?: boolean;
  /** Optional list of allowed component names from catalog */
  readonly allowedComponents?: readonly string[];
}

/**
 * Result returned by sanitizeSpecGraph().
 */
export interface SanitizeGraphResult {
  readonly spec: Spec;
  readonly inspection: GraphInspectionResult;
  readonly severedCyclesCount: number;
  readonly healedNumbersCount: number;
  readonly blockedUrisCount: number;
  readonly blockedPathsCount: number;
  readonly autoFixes: readonly string[];
}

/**
 * Live observability snapshot exposed by TelemetryTracker.
 */
export interface StreamTelemetrySnapshot {
  /** Estimated LLM token throughput (tokens / sec, ~4 chars per token) */
  readonly tokensPerSec: number;
  /** Total characters processed across the stream */
  readonly totalCharsProcessed: number;
  /** Number of valid RFC 6902 JSONL patches applied */
  readonly patchCount: number;
  /** Number of malformed or unsafe patches rejected */
  readonly rejectedPatchCount: number;
  /** Most recent validation + sanitization pass latency in milliseconds */
  readonly lastValidationLatencyMs: number;
  /** Rolling average validation latency in milliseconds */
  readonly avgValidationLatencyMs: number;
  /** Cumulative validation latency in milliseconds */
  readonly totalValidationLatencyMs: number;
  /** Ratio (0.0 to 1.0) of compliant elements/props to total evaluated */
  readonly schemaComplianceRate: number;
  /** Total props evaluated against catalog Zod schemas */
  readonly evaluatedPropsCount: number;
  /** Total props automatically healed (coerced, clamped, or finite-normalized) */
  readonly healedPropsCount: number;
  /** Total props or elements rejected at the schema boundary */
  readonly rejectedPropsCount: number;
  /** Total DAG cycles severed during stream compilation */
  readonly severedCyclesCount: number;
  /** Active element faults isolated by the Error Boundary */
  readonly activeFaults: readonly ElementFaultRecord[];
  /** Recent prop diagnostics (bounded ring buffer) */
  readonly recentDiagnostics: readonly PropDiagnostic[];
  /** Recent structural & security issues */
  readonly recentIssues: readonly GraphIssue[];
  /** Stream lifecycle status */
  readonly status: "idle" | "streaming" | "complete" | "error";
}

/**
 * Deterministic metadata attached to a VerifiedCatalog.
 */
export interface CatalogContractMetadata {
  readonly catalogHash: string;
  readonly componentNames: readonly string[];
  readonly actionNames: readonly string[];
  readonly builtInActionNames: readonly string[];
  readonly componentDescriptions: Readonly<Record<string, string>>;
  readonly createdAt: string;
}

/**
 * Audit report verifying 1:1 synchronization between a Catalog and a ComponentRegistry.
 */
export interface CatalogAuditReport {
  readonly synchronized: boolean;
  readonly catalogHash: string;
  readonly missingComponents: readonly string[];
  readonly extraComponents: readonly string[];
  readonly missingDescriptions: readonly string[];
  readonly missingActions: readonly string[];
  readonly issues: readonly string[];
}

/**
 * A verified catalog wrapper around @json-render/core Catalog.
 */
export interface VerifiedCatalog<
  TDef extends SchemaDefinition = SchemaDefinition,
  TCatalog = unknown,
> {
  readonly catalog: Catalog<TDef, TCatalog>;
  readonly metadata: CatalogContractMetadata;
  /** Generate a 100% deterministic, key-order-invariant system prompt */
  prompt(options?: PromptOptions): string;
  /** Get the Zod schema for a specific component name */
  getComponentZodSchema(componentName: string): unknown;
  /** Validate and heal element props against the component's Zod schema */
  validateAndHealProps(
    elementKey: string,
    componentName: string,
    rawProps: Record<string, unknown>,
  ): {
    readonly ok: boolean;
    readonly props: Record<string, unknown>;
    readonly diagnostics: readonly PropDiagnostic[];
    readonly healedCount: number;
    readonly rejectedCount: number;
  };
  /** Validate a full Spec against both the catalog and DAG topology rules */
  validateFull(
    spec: unknown,
    options?: SanitizeGraphOptions,
  ): {
    readonly valid: boolean;
    readonly sanitizedSpec: Spec;
    readonly issues: readonly GraphIssue[];
    readonly propDiagnostics: readonly PropDiagnostic[];
  };
}

/**
 * Immutable snapshot entry in TimeTravelStateStore's ring buffer.
 */
export interface StateHistoryEntry {
  readonly index: number;
  readonly timestamp: number;
  readonly label: string;
  readonly changedPaths: readonly string[];
  readonly snapshot: StateModel;
}

/**
 * Extended StateStore with time-travel undo/redo and watch cascade protection.
 */
export interface TimeTravelStateStore extends StateStore {
  /** Undo the most recent state mutation */
  undo(): boolean;
  /** Redo a previously undone state mutation */
  redo(): boolean;
  /** Jump directly to a snapshot index in history */
  jumpToSnapshot(index: number): boolean;
  /** Whether undo is available */
  canUndo(): boolean;
  /** Whether redo is available */
  canRedo(): boolean;
  /** Current position in the history ring buffer */
  getCurrentHistoryIndex(): number;
  /** Read all recorded history entries */
  getHistory(): readonly StateHistoryEntry[];
  /** Number of times the synchronous watch cascade circuit breaker tripped */
  getCascadeTripCount(): number;
  /** Reset the store to a new initial state and clear history */
  reset(nextInitialState?: StateModel): void;
}

/**
 * Step result returned when pushing a chunk into GuardrailedStreamCompiler.
 */
export interface GuardrailedStreamStepResult {
  readonly spec: Spec;
  readonly appliedPatches: readonly SpecStreamLine[];
  readonly rejectedLines: readonly string[];
  readonly issues: readonly GraphIssue[];
  readonly telemetry: StreamTelemetrySnapshot;
  /**
   * Healing provenance for the current Spec, keyed by element key.
   * The compiler heals props *before* render, so without this map the renderer would
   * receive already-valid props and could never show a `<DiagnosticHealedBadge />`
   * for streamed content (BUG-INT-01). Pass to `<SafeGenUIRenderer healedDiagnostics />`.
   */
  readonly healedDiagnostics: HealedDiagnosticsByElement;
}

/**
 * Map of element key to the prop diagnostics healed for that element by the stream compiler.
 */
export type HealedDiagnosticsByElement = Readonly<
  Record<string, readonly PropDiagnostic[]>
>;
