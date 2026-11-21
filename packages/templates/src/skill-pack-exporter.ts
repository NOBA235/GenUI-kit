import JSZip from "jszip";
import { z } from "zod";
import type { Spec } from "@json-render/core";
import {
  createInteractionRuleEngine,
  CreativeBriefSchema,
  deepCloneAndSanitizeValue,
  sanitizeInteractionRules,
  type CreativeBrief,
  type GraphIssue,
  type InteractionEvent,
  type InteractionRule,
  type TimeTravelStateStore,
  type VerifiedCatalog,
} from "@genui-studio/core";
import {
  extractActionVocabulary,
  fuzzPlaytestSpec,
} from "@genui-studio/core/testing";
import {
  buildAppDriverTs,
  buildCatalogTs,
  buildInvariantsTestTs,
  buildProductionDriverTs,
  buildReferenceDriverTs,
} from "./skill-pack-contracts.js";
import {
  buildAgentsMd,
  buildCursorRule,
  buildDesignMd,
  buildRequirementsMd,
  buildSkillMd,
  buildTasksMd,
  buildVisualIntentMd,
  CONTRACT_TEST_PATH,
} from "./skill-pack-docs.js";
import {
  BEHAVIORAL_SPEC_FORMAT,
  type BehavioralSpecDocument,
  type CatalogComponentContract,
  type SkillPackBuildResult,
  type SkillPackContext,
  type SkillPackFuzzOptions,
  type SkillPackInput,
  type TerminalOutcome,
  type VerifiedTrace,
} from "./skill-pack-types.js";
import type { DualModeTemplateEntry } from "./types.js";

type DeepSanitizeCounters = Parameters<typeof deepCloneAndSanitizeValue>[1];

const TERMINAL_OUTCOMES: readonly TerminalOutcome[] = ["win", "lose", "complete"];
const MAX_OBSERVABLE_PATHS = 64;
const SCENE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

/** Lowercase kebab-case slug that is safe as a single path segment. */
export function toSafeSlug(value: string, fallback = "genui-app"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || fallback;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function resolveFuzzSettings(options: SkillPackFuzzOptions = {}): Required<SkillPackFuzzOptions> {
  return {
    numRuns: clampInt(options.numRuns, 100, 1, 1000),
    seed: clampInt(options.seed, 42, -2_147_483_648, 2_147_483_647),
    maxStepsPerRun: clampInt(options.maxStepsPerRun, 24, 1, 100),
  };
}

function clip(value: string, max: number): string {
  const flat = value.trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Builds a valid `CreativeBrief` for exports that have no authored brief
 * (template starters, or a bare spec JSON file).
 */
export function createStarterBrief(options: {
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly aestheticDirection?: string;
  readonly targetStack?: string;
  readonly scenes?: readonly string[];
}): CreativeBrief {
  const title = clip(options.title || options.slug, 100) || "GenUI App";
  return {
    title,
    slug: toSafeSlug(options.slug || title),
    inputMode: "starter",
    promptSummary: "",
    elevatorPitch: clip(options.description || title, 320),
    aestheticDirection: clip(
      options.aestheticDirection || "Follow the exported element tree and catalog components.",
      240,
    ),
    coreLoop: "Render the exported UI Spec and react to the interaction rules in contracts/wireframe.spec.json.",
    targetStack: clip(options.targetStack || "Next.js 15, React 19, @genui-studio/core", 120),
    scenes: (options.scenes ?? ["main"]).slice(0, 24),
  };
}

function newCounters(issues: GraphIssue[]): DeepSanitizeCounters {
  return { healedNumbersCount: 0, blockedUrisCount: 0, blockedPathsCount: 0, issues };
}

function sanitizeBrief(raw: unknown, issues: GraphIssue[]): CreativeBrief {
  // Strip prototype-pollution keys and neutralize unsafe URIs before schema validation.
  const cleaned = deepCloneAndSanitizeValue(raw, newCounters(issues), "/brief");
  const parsed = CreativeBriefSchema.safeParse(cleaned);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Invalid creative brief${first ? ` at "${first.path.join(".")}": ${first.message}` : ""}.`,
    );
  }
  return { ...parsed.data, slug: toSafeSlug(parsed.data.slug || parsed.data.title) };
}

function resolveInitialScene(requested: string | undefined, brief: CreativeBrief): string {
  for (const candidate of [requested, brief.scenes[0], "main"]) {
    if (typeof candidate === "string" && SCENE_ID.test(candidate)) return candidate;
  }
  return "main";
}

function collectObservablePaths(rules: readonly InteractionRule[]): string[] {
  const paths = new Set<string>();
  for (const rule of rules) {
    for (const effect of rule.effects) {
      if ("path" in effect && !effect.path.startsWith("/experience")) {
        paths.add(effect.path);
      }
    }
  }
  return [...paths].sort().slice(0, MAX_OBSERVABLE_PATHS);
}

function collectKnownScenes(
  initialScene: string,
  brief: CreativeBrief,
  rules: readonly InteractionRule[],
): string[] {
  const scenes = new Set<string>([initialScene, ...brief.scenes]);
  for (const rule of rules) {
    for (const effect of rule.effects) {
      if (effect.type === "navigateScene") scenes.add(effect.sceneId);
    }
  }
  return [...scenes];
}

function readObservable(
  store: TimeTravelStateStore,
  paths: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const value = store.get(path);
    // JSON round-trip: unfreezes store snapshots and drops undefined (absent) values.
    if (value !== undefined) out[path] = JSON.parse(JSON.stringify(value)) as unknown;
  }
  return out;
}

function createReferenceEngine(
  document: Pick<BehavioralSpecDocument, "spec" | "rules" | "initialScene">,
) {
  return createInteractionRuleEngine({
    initialState: structuredClone(document.spec.state ?? {}),
    rules: document.rules,
    initialScene: document.initialScene,
  });
}

/** Replays each fuzzer trace on a fresh engine; only traces that reproduce are baked. */
function verifyTraces(
  document: BehavioralSpecDocument,
  shortestTraces: Readonly<Record<string, readonly InteractionEvent[] | null>>,
  observablePaths: readonly string[],
  issues: GraphIssue[],
): VerifiedTrace[] {
  const verified: VerifiedTrace[] = [];
  for (const outcome of TERMINAL_OUTCOMES) {
    const events = shortestTraces[outcome];
    if (!events || events.length === 0) continue;
    const engine = createReferenceEngine(document);
    for (const event of events) engine.dispatch(event);
    const status = engine.getOutcome().status;
    if (status !== outcome) {
      issues.push({
        severity: "warning",
        code: "malformed_patch_line",
        message: `Fuzzer trace for "${outcome}" ended in "${status}" on replay and was not baked into the contract.`,
      });
      continue;
    }
    verified.push({
      outcome,
      events: events.map((e) => ({ ...e })),
      expectedScene: engine.getActiveScene(),
      expectedState: readObservable(engine.store, observablePaths),
    });
  }
  return verified;
}

function buildCatalogContract(
  catalog: VerifiedCatalog<any, any>,
): Record<string, CatalogComponentContract> {
  const out: Record<string, CatalogComponentContract> = {};
  for (const name of [...catalog.metadata.componentNames].sort()) {
    let propsJsonSchema: Record<string, unknown> | null = null;
    const schema = catalog.getComponentZodSchema(name);
    if (schema instanceof z.ZodType) {
      try {
        propsJsonSchema = z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
      } catch {
        propsJsonSchema = null;
      }
    }
    out[name] = {
      description: catalog.metadata.componentDescriptions[name] ?? "",
      propsJsonSchema,
    };
  }
  return out;
}

const RULE_KEY_ORDER = [
  "id",
  "label",
  "description",
  "sourceSection",
  "enabled",
  "once",
  "trigger",
  "guards",
  "effects",
] as const;

/**
 * Fixed key order for sanitized rules. `sanitizeInteractionRules` appends `enabled` when it
 * is missing, so without this a re-export of an exported pack would reorder keys.
 */
function orderRuleKeys(rule: InteractionRule): InteractionRule {
  const source = rule as unknown as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const key of RULE_KEY_ORDER) {
    if (source[key] !== undefined) ordered[key] = source[key];
  }
  return ordered as unknown as InteractionRule;
}

function documentJson(document: BehavioralSpecDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Builds a Universal Agent Skill & Contract Pack: docs for Kiro / Cursor / Claude Code /
 * Codex plus `contracts/` with the behavioral spec, a reference driver that passes, a
 * production driver stub that fails until wired, and property tests over `AppDriver`.
 *
 * The spec is re-validated against `input.catalog` (DAG sanitizer, prop healing, unsafe
 * URI blocking) and the rules pass through `sanitizeInteractionRules` before anything is
 * fuzzed or written. File paths are relative to the root of the target repository.
 */
export function buildSkillPack(input: SkillPackInput): SkillPackBuildResult {
  const issues: GraphIssue[] = [];
  const brief = sanitizeBrief(input.brief, issues);
  const slug = brief.slug;

  const validated = input.catalog.validateFull(input.spec, {
    maxDepth: 16,
    maxElements: 500,
    pruneMissingChildren: true,
  });
  issues.push(...validated.issues);
  const spec: Spec = validated.sanitizedSpec;
  if (!spec.root || !Object.prototype.hasOwnProperty.call(spec.elements, spec.root)) {
    throw new Error("Spec has no valid root element after sanitization.");
  }

  const ruleResult = sanitizeInteractionRules(input.rules ?? []);
  issues.push(...ruleResult.issues);
  const rules = ruleResult.rules.map(orderRuleKeys);
  const initialScene = resolveInitialScene(input.initialScene, brief);

  const document: BehavioralSpecDocument = {
    format: BEHAVIORAL_SPEC_FORMAT,
    brief,
    catalogHash: input.catalog.metadata.catalogHash,
    initialScene,
    spec,
    rules,
  };

  const fuzzSettings = resolveFuzzSettings(input.fuzz);
  const fuzzReport = fuzzPlaytestSpec({
    initialState: structuredClone(spec.state ?? {}),
    rules,
    initialScene,
    numRuns: fuzzSettings.numRuns,
    seed: fuzzSettings.seed,
    maxStepsPerRun: fuzzSettings.maxStepsPerRun,
  });

  const observablePaths = collectObservablePaths(rules);
  const verifiedTraces = verifyTraces(document, fuzzReport.shortestTraces, observablePaths, issues);
  const initialObservableState = readObservable(
    createReferenceEngine(document).store,
    observablePaths,
  );

  const knownComponents = new Set(input.catalog.metadata.componentNames);
  const unknownComponentTypes = [
    ...new Set(Object.values(spec.elements).map((el) => el.type)),
  ]
    .filter((type) => !knownComponents.has(type))
    .sort();

  let excalidrawFile: string | null = null;
  if (input.excalidrawJson !== undefined) {
    let scene: unknown;
    try {
      scene = JSON.parse(input.excalidrawJson);
    } catch {
      throw new Error("excalidrawJson is not valid JSON.");
    }
    excalidrawFile = `${JSON.stringify(scene, null, 2)}\n`;
  }

  const ctx: SkillPackContext = {
    slug,
    document,
    catalogComponents: buildCatalogContract(input.catalog),
    fuzzReport,
    fuzzSettings,
    verifiedTraces,
    observablePaths,
    initialObservableState,
    knownScenes: collectKnownScenes(initialScene, brief, rules),
    actionVocabulary: extractActionVocabulary(rules),
    unknownComponentTypes,
    hasExcalidraw: excalidrawFile !== null,
  };

  const files: Record<string, string> = {
    "SKILL.md": buildSkillMd(ctx),
    "AGENTS.md": buildAgentsMd(ctx),
    [`.kiro/specs/${slug}/requirements.md`]: buildRequirementsMd(ctx),
    [`.kiro/specs/${slug}/design.md`]: buildDesignMd(ctx),
    [`.kiro/specs/${slug}/tasks.md`]: buildTasksMd(ctx),
    ".kiro/steering/visual-intent.md": buildVisualIntentMd(ctx),
    ".cursor/rules/genui-spec.mdc": buildCursorRule(ctx),
    "contracts/app-driver.ts": buildAppDriverTs(),
    "contracts/reference-driver.ts": buildReferenceDriverTs(ctx),
    "contracts/production-driver.ts": buildProductionDriverTs(ctx),
    "contracts/wireframe.spec.json": documentJson(document),
    "contracts/catalog.ts": buildCatalogTs(ctx),
    [CONTRACT_TEST_PATH]: buildInvariantsTestTs(ctx),
  };
  if (excalidrawFile !== null) {
    files[`wireframe/${slug}.excalidraw.json`] = excalidrawFile;
  }

  return {
    slug,
    files,
    document,
    fuzzReport,
    verifiedTraces,
    unknownComponentTypes,
    issues,
  };
}

/** Raw file map of a Skill Pack (pack-relative path -> content). */
export function buildSkillPackFiles(input: SkillPackInput): Readonly<Record<string, string>> {
  return buildSkillPack(input).files;
}

/** Zips a Skill Pack file map. Entries sit at the archive root so it extracts into a repo. */
export async function zipSkillPackFiles(
  files: Readonly<Record<string, string>>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const filePath of Object.keys(files).sort()) {
    zip.file(filePath, files[filePath]!);
  }
  return zip.generateAsync({ type: "uint8array" });
}

/** Builds and zips a Skill Pack in memory. */
export async function generateSkillPackZip(input: SkillPackInput): Promise<Uint8Array> {
  return zipSkillPackFiles(buildSkillPack(input).files);
}

/**
 * Skill Pack input for a registered template: its home page Spec (seeded with the
 * template's initial state), its catalog, and a starter brief from the manifest.
 * Templates carry no interaction rules yet, so the contract covers the initial state.
 */
export function skillPackInputFromTemplate(
  entry: DualModeTemplateEntry,
  options: { readonly rules?: readonly unknown[]; readonly fuzz?: SkillPackFuzzOptions } = {},
): SkillPackInput {
  const { manifest } = entry;
  const pageSpec = entry.pageSpecs.home ?? Object.values(entry.pageSpecs)[0];
  if (!pageSpec) {
    throw new Error(`Template "${manifest.slug}" has no page specs to export.`);
  }
  const spec: Spec = {
    ...pageSpec,
    state: { ...(entry.initialState ?? {}), ...(pageSpec.state ?? {}) },
  };
  return {
    brief: createStarterBrief({
      slug: manifest.slug,
      title: manifest.title,
      description: manifest.description,
      aestheticDirection: `${manifest.theme.defaultColorScheme} theme, accent ${manifest.theme.accentColor}, display font ${manifest.theme.displayFont}.`,
    }),
    spec,
    rules: options.rules ?? [],
    catalog: entry.catalog,
    ...(options.fuzz ? { fuzz: options.fuzz } : {}),
  };
}

/** Parsed but not yet sanitized contents of a behavioral spec file. */
export interface BehavioralSpecSource {
  readonly spec: Spec;
  readonly rules: readonly unknown[];
  readonly brief?: CreativeBrief;
  readonly initialScene?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSpecShape(value: unknown): value is Spec {
  return isRecord(value) && typeof value.root === "string" && isRecord(value.elements);
}

/**
 * Reads a behavioral spec from parsed JSON. Accepts either the Skill Pack format
 * (`{ format, brief, spec, rules, initialScene }`, as in `contracts/wireframe.spec.json`)
 * or a bare Spec with optional top-level `rules` / `initialScene` (as written by the
 * Next.js starter export). Values are sanitized later by `buildSkillPack` / the fuzzer.
 */
export function readBehavioralSpecSource(raw: unknown): BehavioralSpecSource {
  if (!isRecord(raw)) {
    throw new Error("Behavioral spec must be a JSON object.");
  }
  const container = isSpecShape(raw.spec) ? raw : null;
  const specValue = container ? raw.spec : raw;
  if (!isSpecShape(specValue)) {
    throw new Error('Behavioral spec needs a Spec ({ "root", "elements" }) at the top level or under "spec".');
  }
  const rulesValue = raw.rules;
  if (rulesValue !== undefined && !Array.isArray(rulesValue)) {
    throw new Error('"rules" must be an array of interaction rules.');
  }

  let brief: CreativeBrief | undefined;
  if (raw.brief !== undefined) {
    const issues: GraphIssue[] = [];
    brief = sanitizeBrief(raw.brief, issues);
  }

  const { root, elements, state } = specValue;
  const spec: Spec = { root, elements, ...(state !== undefined ? { state } : {}) };
  return {
    spec,
    rules: (rulesValue as unknown[] | undefined) ?? [],
    ...(brief ? { brief } : {}),
    ...(typeof raw.initialScene === "string" ? { initialScene: raw.initialScene } : {}),
  };
}
