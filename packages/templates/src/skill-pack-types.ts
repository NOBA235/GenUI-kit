import type { Spec } from "@json-render/core";
import type {
  CreativeBrief,
  GraphIssue,
  InteractionEvent,
  InteractionRule,
  OutcomeStatus,
  VerifiedCatalog,
} from "@genui-studio/core";
import type { PlaytestFuzzReport } from "@genui-studio/core/testing";

/** `format` tag written to `contracts/wireframe.spec.json`. */
export const BEHAVIORAL_SPEC_FORMAT = "genui-behavioral-spec/v1";

/** Outcomes a verified trace can end in (`playing` is the starting status, not a goal). */
export type TerminalOutcome = Exclude<OutcomeStatus, "playing">;

/**
 * The portable behavioral spec shipped as `contracts/wireframe.spec.json`:
 * a DAG-sanitized UI Spec (including initial `state`), the sanitized rule set,
 * and the creative brief the rules were generated from.
 */
export interface BehavioralSpecDocument {
  readonly format: typeof BEHAVIORAL_SPEC_FORMAT;
  readonly brief: CreativeBrief;
  readonly catalogHash: string;
  readonly initialScene: string;
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
}

export interface SkillPackFuzzOptions {
  /** Randomized playtest sessions used to discover traces (default: 100) */
  readonly numRuns?: number;
  /** Deterministic seed, also baked into the exported property tests (default: 42) */
  readonly seed?: number;
  /** Maximum events per session (default: 24) */
  readonly maxStepsPerRun?: number;
}

export interface SkillPackInput {
  readonly brief: CreativeBrief;
  /** UI Spec; `spec.state` is the initial state. Re-validated against `catalog`. */
  readonly spec: Spec;
  /** Untrusted rules; sanitized with `sanitizeInteractionRules` before use. */
  readonly rules?: readonly unknown[];
  readonly catalog: VerifiedCatalog<any, any>;
  /** Defaults to `brief.scenes[0]`, then `"main"`. */
  readonly initialScene?: string;
  /** Optional Excalidraw scene JSON written to `wireframe/<slug>.excalidraw.json`. */
  readonly excalidrawJson?: string;
  readonly fuzz?: SkillPackFuzzOptions;
}

/** A fuzzer-discovered event sequence, replayed on a fresh reference engine before baking. */
export interface VerifiedTrace {
  readonly outcome: TerminalOutcome;
  readonly events: readonly InteractionEvent[];
  readonly expectedScene: string;
  /** Observable state values after the last event (undefined values omitted). */
  readonly expectedState: Readonly<Record<string, unknown>>;
}

export interface CatalogComponentContract {
  readonly description: string;
  /** JSON Schema of the component props, or null when the Zod schema is not representable. */
  readonly propsJsonSchema: Readonly<Record<string, unknown>> | null;
}

/** Everything the doc and contract generators need, computed once by `buildSkillPack`. */
export interface SkillPackContext {
  readonly slug: string;
  readonly document: BehavioralSpecDocument;
  readonly catalogComponents: Readonly<Record<string, CatalogComponentContract>>;
  readonly fuzzReport: PlaytestFuzzReport;
  readonly fuzzSettings: Required<SkillPackFuzzOptions>;
  readonly verifiedTraces: readonly VerifiedTrace[];
  readonly observablePaths: readonly string[];
  /** Observable state values on a freshly created reference engine (undefined values omitted). */
  readonly initialObservableState: Readonly<Record<string, unknown>>;
  readonly knownScenes: readonly string[];
  readonly actionVocabulary: readonly InteractionEvent[];
  readonly unknownComponentTypes: readonly string[];
  readonly hasExcalidraw: boolean;
}

export interface SkillPackBuildResult {
  readonly slug: string;
  /** Pack-relative path -> file content. Paths are meant to be extracted at a repo root. */
  readonly files: Readonly<Record<string, string>>;
  readonly document: BehavioralSpecDocument;
  readonly fuzzReport: PlaytestFuzzReport;
  readonly verifiedTraces: readonly VerifiedTrace[];
  readonly unknownComponentTypes: readonly string[];
  readonly issues: readonly GraphIssue[];
}
