export type {
  CatalogAuditReport,
  CatalogContractMetadata,
  ElementFaultRecord,
  GraphInspectionResult,
  GraphIssue,
  GraphIssueCode,
  GuardrailedStreamStepResult,
  HealedDiagnosticsByElement,
  PropDiagnostic,
  SanitizeGraphOptions,
  SanitizeGraphResult,
  StateHistoryEntry,
  StreamTelemetrySnapshot,
  TimeTravelStateStore,
  VerifiedCatalog,
} from "./types.js";

export {
  auditCatalogRegistryParity,
  canonicalStringify,
  computeDeterministicHash,
  createVerifiedCatalog,
  isDynamicPropExpression,
  isValidDynamicExpression,
} from "./catalog/verified-catalog.js";

export {
  deepCloneAndSanitizeValue,
  inspectSpecGraph,
  isDangerousKey,
  isSafeJsonPointer,
  normalizeSafePointer,
  sanitizeSpecGraph,
} from "./stream/dag-sanitizer.js";

export {
  createGuardrailedStreamCompiler,
  diffToPatches,
  specToJsonlStream,
  type GuardrailedStreamCompiler,
  type GuardrailedStreamCompilerOptions,
} from "./stream/stream-compiler.js";

export {
  createTimeTravelStateStore,
  flattenToPointers,
  immutableSetByPath,
  type TimeTravelStateStoreOptions,
} from "./state/time-travel-store.js";

export {
  createTelemetryTracker,
  type TelemetryTracker,
} from "./telemetry/telemetry-tracker.js";

export {
  DefaultUnknownComponentFallback,
  DiagnosticHealedBadge,
  ElementFaultCard,
  GENUI_ELEMENT_KEY_FIELD,
  GenUIElementErrorBoundary,
  SafeGenUIRenderer,
  wrapRegistryWithTelemetry,
  type DiagnosticBadgeProps,
  type ElementFaultCardProps,
  type SafeGenUIRendererProps,
  type WrapRegistryOptions,
} from "./boundary/safe-renderer.js";

export * from "./registry/index.js";

