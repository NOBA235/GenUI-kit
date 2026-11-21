import fs from "node:fs";
import path from "node:path";
import {
  OutcomeStatusSchema,
  sanitizeInteractionRules,
  sanitizeSpecGraph,
  type OutcomeStatus,
} from "@genui-studio/core";
import {
  fuzzPlaytestSpec,
  type PlaytestFuzzReport,
} from "@genui-studio/core/testing";
import {
  buildSkillPack,
  createStarterBrief,
  getTemplateBySlug,
  readBehavioralSpecSource,
  showcasePreviewCatalog,
  skillPackInputFromTemplate,
  toSafeSlug,
  zipSkillPackFiles,
  type BehavioralSpecSource,
  type SkillPackBuildResult,
  type SkillPackFuzzOptions,
  type SkillPackInput,
} from "@genui-studio/templates";

/** Reads and parses a behavioral spec JSON file (Skill Pack format or bare Spec + rules). */
export function loadBehavioralSpecFile(filePath: string): BehavioralSpecSource {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Spec file not found: ${abs}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf-8"));
  } catch (err) {
    throw new Error(
      `Spec file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return readBehavioralSpecSource(raw);
}

/** Parses `--require-outcome=win,lose` into validated outcome names. */
export function parseRequiredOutcomes(value: string | undefined): OutcomeStatus[] {
  if (!value) return [];
  const out: OutcomeStatus[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const parsed = OutcomeStatusSchema.safeParse(trimmed);
    if (!parsed.success) {
      throw new Error(
        `Unknown outcome "${trimmed}". Use one of: ${OutcomeStatusSchema.options.join(", ")}.`,
      );
    }
    if (!out.includes(parsed.data)) out.push(parsed.data);
  }
  return out;
}

export interface FuzzCommandOptions extends SkillPackFuzzOptions {
  readonly requireOutcomes?: readonly OutcomeStatus[];
}

export interface FuzzCommandResult {
  readonly report: PlaytestFuzzReport;
  readonly droppedRules: number;
  readonly ruleCount: number;
}

/**
 * Fuzzes a behavioral spec. The Spec state goes through the DAG sanitizer and the rules
 * through `sanitizeInteractionRules` first, exactly as the Skill Pack exporter does.
 */
export function fuzzBehavioralSpec(
  source: BehavioralSpecSource,
  options: FuzzCommandOptions = {},
): FuzzCommandResult {
  const sanitizedSpec = sanitizeSpecGraph(source.spec, {
    maxDepth: 16,
    maxElements: 500,
    pruneMissingChildren: true,
  }).spec;
  const ruleResult = sanitizeInteractionRules(source.rules);
  const report = fuzzPlaytestSpec({
    initialState: structuredClone(sanitizedSpec.state ?? {}),
    rules: ruleResult.rules,
    ...(source.initialScene ? { initialScene: source.initialScene } : {}),
    ...(options.numRuns !== undefined ? { numRuns: options.numRuns } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
    ...(options.maxStepsPerRun !== undefined ? { maxStepsPerRun: options.maxStepsPerRun } : {}),
    requireReachableOutcomes: options.requireOutcomes ?? [],
  });
  return {
    report,
    droppedRules: ruleResult.droppedCount,
    ruleCount: ruleResult.rules.length,
  };
}

export interface ExportSkillOptions {
  /** Output .zip path (default: `<slug>-skill-pack.zip` in the current directory) */
  readonly out?: string;
  /** Template whose catalog validates a spec file (default: the Studio Hub showcase catalog) */
  readonly templateSlug?: string;
  readonly fuzz?: SkillPackFuzzOptions;
}

export interface ExportSkillResult {
  readonly pack: SkillPackBuildResult;
  readonly outPath: string;
  readonly byteLength: number;
}

/**
 * Resolves `<slug|spec.json>` into Skill Pack input. An existing file wins over a
 * template slug with the same name.
 */
export function resolveSkillPackInput(
  target: string,
  options: Pick<ExportSkillOptions, "templateSlug" | "fuzz"> = {},
): SkillPackInput {
  if (fs.existsSync(path.resolve(target))) {
    const source = loadBehavioralSpecFile(target);
    let catalog = showcasePreviewCatalog;
    if (options.templateSlug) {
      const template = getTemplateBySlug(options.templateSlug);
      if (!template) throw new Error(`Unknown template "${options.templateSlug}".`);
      catalog = template.catalog;
    }
    const baseName = toSafeSlug(path.basename(target).replace(/\.json$/i, ""));
    return {
      brief: source.brief ?? createStarterBrief({ slug: baseName, title: baseName }),
      spec: source.spec,
      rules: source.rules,
      catalog,
      ...(source.initialScene ? { initialScene: source.initialScene } : {}),
      ...(options.fuzz ? { fuzz: options.fuzz } : {}),
    };
  }

  const template = getTemplateBySlug(target);
  if (!template) {
    throw new Error(
      `"${target}" is neither a spec file nor a known template slug. Run 'genui-studio list'.`,
    );
  }
  return skillPackInputFromTemplate(template, options.fuzz ? { fuzz: options.fuzz } : {});
}

/** Builds a Skill Pack for `<slug|spec.json>` and writes the .zip. */
export async function exportSkillPack(
  target: string,
  options: ExportSkillOptions = {},
): Promise<ExportSkillResult> {
  const pack = buildSkillPack(resolveSkillPackInput(target, options));
  const bytes = await zipSkillPackFiles(pack.files);
  const outPath = path.resolve(options.out ?? `${pack.slug}-skill-pack.zip`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(bytes));
  return { pack, outPath, byteLength: bytes.byteLength };
}
