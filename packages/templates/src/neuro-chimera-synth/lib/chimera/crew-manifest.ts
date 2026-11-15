/**
 * Kiro Crew app manifest validator (`lib/chimera/crew-manifest.ts`).
 *
 * Encodes the install-time rules from the Kiro Crew App Kit manifest reference
 * (https://kiro.dev/docs/crew/apps/manifest/):
 * - `name` is kebab-case and `version` is semver `X.Y.Z`; required fields are non-empty strings.
 * - Agent, skill, SOP, UI and backend paths are relative and stay inside the app root.
 * - Each cron has exactly one of `every` / `cron_expr`; `enabled` is a JSON boolean.
 * - Each UI page has `route` and `label`.
 * - `backend.hooks.*` use `module.path:callable`.
 * Unknown fields are allowed, matching Crew's round-tripping of newer manifest features.
 * Bundle checks also confirm that referenced agent and skill files exist and parse.
 */

import { z } from "zod";

export const CREW_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CREW_SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
export const CREW_HOOK_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*:[A-Za-z_][A-Za-z0-9_]*$/;

/** Relative path that cannot escape the app root (no absolute, drive, UNC or `..` segment). */
export function isContainedRelativePath(path: string): boolean {
  if (path.length === 0 || path.includes("\0")) return false;
  if (path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/.test(path)) return false;
  const segments = path.split(/[\\/]+/);
  let depth = 0;
  for (const segment of segments) {
    if (segment === "..") depth -= 1;
    else if (segment !== "." && segment !== "") depth += 1;
    if (depth < 0) return false;
  }
  return depth > 0;
}

const CRON_FIELD_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];
const CRON_NAMES = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|SUN|MON|TUE|WED|THU|FRI|SAT)$/i;

/** Validates a standard 5-field cron expression (numbers, `*`, ranges, steps, lists, month/day names). */
export function isValidCronExpression(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, i) => {
    const [min, max] = CRON_FIELD_RANGES[i]!;
    return field.split(",").every((part) => {
      const [base, step, extra] = part.split("/");
      if (extra !== undefined || base === undefined || base === "") return false;
      if (step !== undefined && !/^[1-9]\d*$/.test(step)) return false;
      if (base === "*") return true;
      const bounds = base.split("-");
      if (bounds.length > 2) return false;
      // Month (field 3) and day-of-week (field 4) also accept three-letter names.
      if (bounds.every((b) => i >= 3 && CRON_NAMES.test(b))) return true;
      const values = bounds.map((b) => (/^\d+$/.test(b) ? Number(b) : NaN));
      if (values.some((v) => Number.isNaN(v) || v < min || v > max)) return false;
      return values.length === 1 || values[0]! <= values[1]!;
    });
  });
}

const nonEmpty = z.string().trim().min(1);
const relPath = nonEmpty.refine(isContainedRelativePath, "Path must be relative and stay inside the app root.");

export const CrewCronSchema = z
  .looseObject({
    name: nonEmpty,
    every: z.number().int().positive().optional(),
    cron_expr: nonEmpty.refine(isValidCronExpression, "Invalid 5-field cron expression.").optional(),
    message: nonEmpty,
    agent: nonEmpty.optional(),
    enabled: z.boolean().optional(),
  })
  .refine((c) => (c.every === undefined) !== (c.cron_expr === undefined), {
    message: "Each cron must specify exactly one of every or cron_expr.",
  });

export const CrewManifestSchema = z.looseObject({
  name: nonEmpty.regex(CREW_NAME_PATTERN, "name must be kebab-case."),
  version: nonEmpty.regex(CREW_SEMVER_PATTERN, "version must be semver X.Y.Z."),
  displayName: nonEmpty,
  description: nonEmpty,
  author: z.string().optional(),
  license: z.string().optional(),
  minKiroCrewVersion: z.string().regex(CREW_SEMVER_PATTERN).optional(),
  tags: z.array(nonEmpty).optional(),
  highlights: z.array(nonEmpty).max(10).optional(),
  screenshots: z.array(relPath).max(5).optional(),
  iconPath: relPath.optional(),
  agents: z.array(relPath).optional(),
  skills: z.array(relPath).optional(),
  sops: z.array(relPath).optional(),
  crons: z.array(CrewCronSchema).optional(),
  ui: z
    .looseObject({
      entry: relPath.optional(),
      pages: z
        .array(
          z.looseObject({
            route: nonEmpty,
            label: nonEmpty,
            icon: z.string().optional(),
            entryPoint: relPath.optional(),
            mountFunction: z.string().optional(),
          }),
        )
        .optional(),
      sidebar: z.looseObject({ section: z.string().optional(), order: z.number().optional() }).optional(),
    })
    .optional(),
  backend: z
    .looseObject({
      entryPoint: nonEmpty
        .refine((p) => isContainedRelativePath(p) || /^[A-Za-z_][\w]*(\.[A-Za-z_]\w*)+$/.test(p), "entryPoint must be a contained path or dotted module.")
        .optional(),
      hooks: z.record(z.string(), nonEmpty.regex(CREW_HOOK_PATTERN, "Hooks must use module.path:callable.")).optional(),
    })
    .optional(),
  permissions: z
    .looseObject({
      api: z.array(nonEmpty.startsWith("/")).optional(),
      events: z.array(nonEmpty).optional(),
      mcpTools: z.array(nonEmpty).optional(),
      storage: z.boolean().optional(),
      cron: z.boolean().optional(),
      memory: z.enum(["", "app-scoped", "shared"]).optional(),
      network: z.boolean().optional(),
      jobs: z.boolean().optional(),
    })
    .optional(),
});
export type CrewManifest = z.infer<typeof CrewManifestSchema>;

export const CrewAgentSchema = z.looseObject({
  name: nonEmpty.regex(CREW_NAME_PATTERN),
  model: nonEmpty,
  description: nonEmpty,
  prompt: nonEmpty,
  tools: z.array(nonEmpty).min(1),
});
export type CrewAgent = z.infer<typeof CrewAgentSchema>;

export interface CrewIssue {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

export type CrewValidation<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly CrewIssue[] };

function zodIssues(file: string, error: z.ZodError): CrewIssue[] {
  return error.issues.map((i) => ({ file, path: i.path.map(String).join("."), message: i.message }));
}

export function validateCrewManifest(input: unknown): CrewValidation<CrewManifest> {
  const parsed = CrewManifestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues("app.json", parsed.error) };
  const issues: CrewIssue[] = [];
  const cronNames = new Set<string>();
  parsed.data.crons?.forEach((cron, i) => {
    if (cronNames.has(cron.name)) issues.push({ file: "app.json", path: `crons.${i}.name`, message: `Duplicate cron name ${cron.name}.` });
    cronNames.add(cron.name);
  });
  if (parsed.data.ui?.pages?.length && !parsed.data.ui.entry && parsed.data.ui.pages.some((p) => !p.entryPoint)) {
    issues.push({ file: "app.json", path: "ui.entry", message: "UI pages need ui.entry or a per-page entryPoint." });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: parsed.data, issues: [] };
}

/** Parse `---` YAML-style frontmatter as flat `key: value` pairs (enough for SKILL.md). */
export function parseSkillFrontmatter(text: string): Record<string, string> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  const out: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]!] = kv[2]!.trim();
  }
  return out;
}

/** Bundle files keyed by app-relative path. Text files are decoded; raw bytes are needed for SKILL.md encoding checks. */
export type CrewBundleFiles = Readonly<Record<string, Uint8Array>>;

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** Validate the manifest plus every agent and skill it references. */
export function validateCrewBundle(files: CrewBundleFiles): CrewValidation<{ manifest: CrewManifest; agents: CrewAgent[] }> {
  const issues: CrewIssue[] = [];
  const read = (path: string): string | null => {
    const bytes = files[path];
    if (!bytes) return null;
    try {
      return utf8.decode(bytes);
    } catch {
      issues.push({ file: path, path: "", message: "File is not valid UTF-8." });
      return null;
    }
  };

  const manifestText = read("app.json");
  if (manifestText === null) return { ok: false, issues: [...issues, { file: "app.json", path: "", message: "app.json is missing." }] };
  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(manifestText);
  } catch (err) {
    return { ok: false, issues: [{ file: "app.json", path: "", message: `Invalid JSON: ${(err as Error).message}` }] };
  }
  const manifest = validateCrewManifest(manifestJson);
  if (!manifest.ok) return manifest;

  const agents: CrewAgent[] = [];
  for (const agentPath of manifest.value.agents ?? []) {
    const text = read(agentPath);
    if (text === null) {
      issues.push({ file: agentPath, path: "", message: "Agent file referenced by app.json is missing." });
      continue;
    }
    try {
      const parsed = CrewAgentSchema.safeParse(JSON.parse(text));
      if (parsed.success) agents.push(parsed.data);
      else issues.push(...zodIssues(agentPath, parsed.error));
    } catch (err) {
      issues.push({ file: agentPath, path: "", message: `Invalid JSON: ${(err as Error).message}` });
    }
  }

  for (const skillDir of manifest.value.skills ?? []) {
    const skillPath = `${skillDir.replace(/[\\/]+$/, "")}/SKILL.md`;
    const bytes = files[skillPath];
    if (!bytes) {
      issues.push({ file: skillPath, path: "", message: "SKILL.md referenced by app.json is missing." });
      continue;
    }
    if (bytes[0] === 0xff || bytes[0] === 0xfe) {
      issues.push({ file: skillPath, path: "", message: "SKILL.md is UTF-16; Crew only loads UTF-8." });
      continue;
    }
    const text = read(skillPath);
    if (text === null) continue;
    const front = parseSkillFrontmatter(text.replace(/^\uFEFF/, ""));
    if (!front) issues.push({ file: skillPath, path: "", message: "SKILL.md has no --- frontmatter block." });
    else if (!front.description) issues.push({ file: skillPath, path: "description", message: "SKILL.md needs a description." });
  }

  const agentNames = new Set(agents.map((a) => a.name));
  manifest.value.crons?.forEach((cron, i) => {
    if (cron.agent && !agentNames.has(cron.agent)) {
      issues.push({ file: "app.json", path: `crons.${i}.agent`, message: `Cron agent ${cron.agent} is not declared by this app.` });
    }
  });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { manifest: manifest.value, agents }, issues: [] };
}
