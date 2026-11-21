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

export {
  DEFAULT_MAX_TRANSITIONS_PER_STEP,
  MAX_EFFECTS_PER_RULE,
  MAX_GUARD_DEPTH,
  MAX_GUARDS_PER_RULE,
  MAX_INTERACTION_RULES,
  CreativeBriefSchema,
  InteractionEffectSchema,
  InteractionGuardSchema,
  InteractionRuleSchema,
  InteractionTriggerSchema,
  OutcomeStatusSchema,
  PreservedConstraintCategorySchema,
  PreservedConstraintSchema,
  SynthSoundCueSchema,
  sanitizeInteractionRules,
  type CreativeBrief,
  type InteractionEffect,
  type InteractionEvent,
  type InteractionGuard,
  type InteractionRule,
  type InteractionTrigger,
  type OutcomeStatus,
  type PreservedConstraint,
  type PreservedConstraintCategory,
  type RuleSanitizationResult,
  type SynthSoundCue,
} from "./interaction/rule-types.js";

export {
  deepEqualInteractionValue,
  evaluateInteractionGuard,
} from "./interaction/guard-eval.js";

export {
  createWebAudioSynth,
  type MinimalAudioContext,
  type MinimalAudioParam,
  type MinimalGainNode,
  type MinimalOscillatorNode,
  type WebAudioSynth,
  type WebAudioSynthOptions,
} from "./interaction/synth-audio.js";

export {
  createInteractionRuleEngine,
  type FiredRuleTrace,
  type InteractionRuleEngine,
  type InteractionRuleEngineOptions,
  type InteractionStepReport,
} from "./interaction/rule-engine.js";

export * from "./registry/index.js";

