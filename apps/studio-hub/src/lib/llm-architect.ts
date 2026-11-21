import type { Spec, StateModel } from "@json-render/core";
import {
  CreativeBriefSchema,
  PreservedConstraintSchema,
  createGuardrailedStreamCompiler,
  deepCloneAndSanitizeValue,
  isDangerousKey,
  isSafeJsonPointer,
  sanitizeInteractionRules,
  type CreativeBrief,
  type GraphIssue,
  type HealedDiagnosticsByElement,
  type InteractionRule,
  type PreservedConstraint,
  type StreamTelemetrySnapshot,
  type VerifiedCatalog,
} from "@genui-studio/core";
import {
  fuzzPlaytestSpec,
  type DeadRuleDiagnostic,
  type PlaytestFuzzReport,
} from "@genui-studio/core/testing";

export type LlmProviderPresetId =
  | "yantra"
  | "openai"
  | "openrouter"
  | "gemini"
  | "ollama"
  | "custom";

export type LlmWireFormat = "openai-sse" | "gemini-sse";

export type ArchitectInputMode = "vibe" | "master-prompt";

export const MASTER_PROMPT_CHAR_THRESHOLD = 300;
export const DEFAULT_DEV_PROXY_URL = "/api/architect/stream";

export interface LlmProviderPreset {
  readonly id: LlmProviderPresetId;
  readonly label: string;
  readonly baseUrl: string;
  readonly wireFormat: LlmWireFormat;
  readonly defaultModel: string;
  readonly suggestedModels: readonly string[];
  readonly requiresApiKey: boolean;
  readonly keyHint: string;
}

export const LLM_PROVIDER_PRESETS: Readonly<
  Record<LlmProviderPresetId, LlmProviderPreset>
> = {
  yantra: {
    id: "yantra",
    label: "Yantra AI (apikeys.in)",
    baseUrl: "https://api.aitklabs.in/v1",
    wireFormat: "openai-sse",
    defaultModel: "auto:fast",
    suggestedModels: [
      "auto:fast",
      "auto:cheap",
      "auto:reasoning",
      "openai/gpt-4o-mini",
      "anthropic/claude-sonnet-4-6",
    ],
    requiresApiKey: true,
    keyHint: "yk_live_...",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    wireFormat: "openai-sse",
    defaultModel: "gpt-4o-mini",
    suggestedModels: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
    requiresApiKey: true,
    keyHint: "sk-...",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    wireFormat: "openai-sse",
    defaultModel: "anthropic/claude-3.5-sonnet",
    suggestedModels: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
    ],
    requiresApiKey: true,
    keyHint: "sk-or-...",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    wireFormat: "gemini-sse",
    defaultModel: "gemini-2.5-flash",
    suggestedModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    requiresApiKey: true,
    keyHint: "AIza...",
  },
  ollama: {
    id: "ollama",
    label: "Local Ollama (Zero Cloud Key)",
    baseUrl: "http://localhost:11434/v1",
    wireFormat: "openai-sse",
    defaultModel: "qwen2.5-coder:7b",
    suggestedModels: ["qwen2.5-coder:7b", "llama3.1:8b", "deepseek-r1:8b"],
    requiresApiKey: false,
    keyHint: "No API key needed (local)",
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-Compatible Endpoint",
    baseUrl: "",
    wireFormat: "openai-sse",
    defaultModel: "auto:fast",
    suggestedModels: [],
    requiresApiKey: false,
    keyHint: "Optional Bearer token",
  },
} as const;

export interface LlmArchitectConfig {
  readonly provider: LlmProviderPresetId;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly model?: string;
  /** Route requests through the Vite dev proxy (/api/architect/stream) backed by .env.local */
  readonly useDevProxy?: boolean;
  readonly devProxyUrl?: string;
  readonly temperature?: number;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}

export interface ArchitectSnapshot {
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly brief: CreativeBrief | null;
}

export interface MasterPromptAudit {
  readonly promptSections: readonly string[];
  readonly mappedSections: readonly string[];
  readonly unmappedSections: readonly string[];
  readonly preservedConstraints: readonly PreservedConstraint[];
  readonly fuzzReport: PlaytestFuzzReport;
  readonly deadRules: readonly DeadRuleDiagnostic[];
}

export interface ArchitectStreamProgress {
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly brief: CreativeBrief | null;
  readonly preservedConstraints: readonly PreservedConstraint[];
  readonly appliedPatchesCount: number;
  readonly healedDiagnostics: HealedDiagnosticsByElement;
  readonly issues: readonly GraphIssue[];
}

export interface ArchitectStreamResult {
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly brief: CreativeBrief;
  readonly preservedConstraints: readonly PreservedConstraint[];
  readonly mode: ArchitectInputMode;
  readonly appliedPatchesCount: number;
  readonly rejectedLines: readonly string[];
  readonly issues: readonly GraphIssue[];
  readonly healedDiagnostics: HealedDiagnosticsByElement;
  readonly telemetry: StreamTelemetrySnapshot;
  readonly audit: MasterPromptAudit | null;
  readonly rawContent: string;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface StreamArchitectPatchOptions {
  readonly prompt: string;
  readonly mode?: ArchitectInputMode;
  readonly config?: LlmArchitectConfig | null;
  readonly currentSpec: Spec;
  readonly currentRules: readonly InteractionRule[];
  readonly currentBrief?: CreativeBrief | null;
  readonly catalog?: VerifiedCatalog<any, any>;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: FetchLike;
  readonly onProgress?: (progress: ArchitectStreamProgress) => void;
  readonly onRollback?: (snapshot: ArchitectSnapshot, reason: unknown) => void;
  /** Run fuzzPlaytestSpec after stream finalize (default: true when rules exist or in master-prompt mode) */
  readonly runFuzzAudit?: boolean;
  readonly fuzzRuns?: number;
  readonly fuzzMaxSteps?: number;
  readonly fuzzSeed?: number;
}

export class LlmConfigurationRequiredError extends Error {
  readonly code = "LLM_NOT_CONFIGURED" as const;

  constructor(message?: string) {
    super(
      message ??
        "Freeform AI generation requires a configured LLM endpoint (Yantra AI / OpenAI / OpenRouter / Gemini API key, local Ollama URL, or .env.local dev proxy). Offline mode supports curated starters and deterministic Pivot Macros only.",
    );
    this.name = "LlmConfigurationRequiredError";
  }
}

export class ArchitectStreamAbortedError extends Error {
  readonly code = "STREAM_ABORTED" as const;
  readonly rolledBackSnapshot: ArchitectSnapshot;

  constructor(snapshot: ArchitectSnapshot, message = "Architect stream aborted; restored pre-stream snapshot.") {
    super(message);
    this.name = "ArchitectStreamAbortedError";
    this.rolledBackSnapshot = snapshot;
  }
}

export class ArchitectHttpError extends Error {
  readonly code = "HTTP_ERROR" as const;
  readonly status: number;
  readonly statusText: string;
  readonly bodyPreview: string;
  readonly rolledBackSnapshot: ArchitectSnapshot;

  constructor(
    status: number,
    statusText: string,
    bodyPreview: string,
    snapshot: ArchitectSnapshot,
  ) {
    super(
      `LLM endpoint returned HTTP ${status}${statusText ? ` ${statusText}` : ""}${bodyPreview ? `: ${bodyPreview}` : ""}`,
    );
    this.name = "ArchitectHttpError";
    this.status = status;
    this.statusText = statusText;
    this.bodyPreview = bodyPreview;
    this.rolledBackSnapshot = snapshot;
  }
}

export class ArchitectStreamError extends Error {
  readonly code = "STREAM_ERROR" as const;
  readonly rolledBackSnapshot: ArchitectSnapshot;

  constructor(message: string, snapshot: ArchitectSnapshot, cause?: unknown) {
    super(message);
    this.name = "ArchitectStreamError";
    this.rolledBackSnapshot = snapshot;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

function isValidHttpUrl(raw: string | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Honest zero-key check: returns true ONLY when a real LLM transport is configured
 * (dev proxy, local Ollama URL, custom HTTP(S) endpoint, or a cloud provider with an API key).
 */
export function isLlmConfigured(
  config?: LlmArchitectConfig | null,
): boolean {
  if (!config) return false;
  if (config.useDevProxy) return true;

  const preset = LLM_PROVIDER_PRESETS[config.provider];
  if (!preset) return false;

  const resolvedBaseUrl = (config.baseUrl?.trim() || preset.baseUrl).trim();
  if (!isValidHttpUrl(resolvedBaseUrl)) {
    return false;
  }

  if (preset.requiresApiKey) {
    return typeof config.apiKey === "string" && config.apiKey.trim().length > 0;
  }

  return true;
}

/**
 * Auto-detects whether pasted input looks like a structured Master Prompt / PRD
 * (> 300 chars or contains Markdown section headings) vs. a short Quick Vibe.
 */
export function detectRecommendedInputMode(rawInput: string): ArchitectInputMode {
  const trimmed = rawInput.trim();
  if (trimmed.length > MASTER_PROMPT_CHAR_THRESHOLD) {
    return "master-prompt";
  }
  if (/^#{1,6}\s+\S/m.test(trimmed)) {
    return "master-prompt";
  }
  if (/^[-*]\s+\*\*[^*]+\*\*:/m.test(trimmed)) {
    return "master-prompt";
  }
  return "vibe";
}

/**
 * Extracts Markdown heading titles in document order for Master Prompt coverage auditing.
 */
export function extractMarkdownSections(markdown: string): readonly string[] {
  const sections: string[] = [];
  const seen = new Set<string>();
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const match = /^#{1,6}\s+(.+?)\s*#*$/.exec(line.trim());
    if (!match) continue;
    const heading = match[1]!.trim().slice(0, 120);
    if (!heading) continue;
    const norm = heading.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      sections.push(heading);
    }
  }
  return sections;
}

function slugifyTitle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "genui-experience";
}

function summarizeCatalogForPrompt(catalog?: VerifiedCatalog<any, any>): string {
  if (!catalog) {
    return "No strict catalog supplied; prefer SiteShell, HeroSection, MetricStrip, FeatureGrid.";
  }
  const { componentNames, componentDescriptions } = catalog.metadata;
  return componentNames
    .map((name) => `- ${name}: ${componentDescriptions[name] ?? "UI component"}`)
    .join("\n");
}

/**
 * Builds the dual-mode system prompt:
 * - `"vibe"`: Creative Architect turning short ideas into playable interactive blueprints + rules.
 * - `"master-prompt"`: Strict Spec Extractor preserving Markdown section traceability and
 *   emitting verbatim non-UI requirements via `CONSTRAINTS: [...]`.
 */
export function buildArchitectSystemPrompt(input: {
  readonly mode: ArchitectInputMode;
  readonly catalog?: VerifiedCatalog<any, any>;
  readonly currentSpec: Spec;
  readonly currentRules: readonly InteractionRule[];
  readonly promptSections?: readonly string[];
}): string {
  const catalogSummary = summarizeCatalogForPrompt(input.catalog);
  const currentSpecSummary = JSON.stringify({
    root: input.currentSpec.root,
    elementKeys: Object.keys(input.currentSpec.elements),
    stateKeys: Object.keys(input.currentSpec.state ?? {}),
    ruleIds: input.currentRules.map((r) => r.id),
  });

  const commonProtocol = [
    "OUTPUT PROTOCOL (strict NDJSON lines — no prose, no markdown fences):",
    '1. First line MUST be `BRIEF: {"title":...,"slug":...,"inputMode":"' +
      input.mode +
      '","promptSummary":...,"elevatorPitch":...,"aestheticDirection":...,"coreLoop":...,"winCondition":...,"loseCondition":...,"targetStack":"Next.js 15 + React 19 + TypeScript","scenes":["main"],"elementSourceSections":{...}}`',
    input.mode === "master-prompt"
      ? '2. Second line MUST be `CONSTRAINTS: [{"id":"c-1","category":"backend-api|database|auth-security|stack|performance|other","sourceSection":"<Exact Markdown Heading>","requirement":"<Verbatim non-UI requirement>"}]` capturing ALL non-UI backend/database/auth/performance/stack requirements so nothing is dropped.'
      : "2. Optionally emit `CONSTRAINTS: [...]` if the user mentions backend/stack constraints.",
    '3. Subsequent lines MUST be valid RFC 6902 JSON Patch objects (`{"op":"add|replace|remove","path":"/...","value":...}`) modifying `/root`, `/elements/<key>`, `/state/<key>`, and `/experience/rules`.',
    "4. Every element `type` MUST exist in the allowed catalog below.",
    "5. Declarative `InteractionRule` objects placed at `/experience/rules` MUST use supported triggers (`onClick`, `onHover`, `onDragStart`, `onDrop`, `onKeyPress`, `onEnterZone`, `onTimerTick`, `onEvent`, `onStateMatch`), guards (`eq`,`neq`,`gt`,`gte`,`lt`,`lte`,`in`,`truthy`,`falsy`,`and`,`or`,`not`), and effects (`set`,`inc`,`dec`,`toggle`,`append`,`remove`,`navigateScene`,`playSynthSound`,`setOutcome`,`emitEvent`,`resetExperience`).",
    "6. Never emit `__proto__`, `constructor`, `prototype`, `javascript:`, or out-of-range numeric props.",
    "",
    "ALLOWED CATALOG COMPONENTS:",
    catalogSummary,
    "",
    `CURRENT WORKBENCH CONTEXT: ${currentSpecSummary}`,
  ];

  if (input.mode === "master-prompt") {
    const sectionsBlock =
      input.promptSections && input.promptSections.length > 0
        ? `\nDETECTED MARKDOWN SECTIONS:\n${input.promptSections.map((s) => `- ${s}`).join("\n")}\n`
        : "";
    return [
      "You are the WizFrame Strict Spec Extractor.",
      "Parse the user's structured Markdown PRD / Master Prompt faithfully WITHOUT inventing unrequested screens, games, or scope.",
      "Trace every compiled UI element back to its Markdown heading in `BRIEF.elementSourceSections` and every `InteractionRule` via `rule.sourceSection`.",
      "Capture every non-UI requirement (backend APIs, database schemas, auth/RBAC, stack constraints, SLAs) verbatim inside `CONSTRAINTS: [...]`.",
      sectionsBlock,
      ...commonProtocol,
    ].join("\n");
  }

  return [
    "You are the WizFrame Creative Interaction Architect.",
    "Transform the user's vibe or reframe request into a playable, schema-validated multi-block UI Spec with real state transitions, tactile synth audio cues, and reachable `win` / `lose` / `complete` outcomes verified by InteractionRuleEngine.",
    ...commonProtocol,
  ].join("\n");
}

function buildProviderRequest(
  config: LlmArchitectConfig,
  systemPrompt: string,
  userPrompt: string,
): {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly wireFormat: LlmWireFormat;
} {
  const preset = LLM_PROVIDER_PRESETS[config.provider];
  const model = (config.model?.trim() || preset.defaultModel).trim();
  const temperature =
    typeof config.temperature === "number" && Number.isFinite(config.temperature)
      ? Math.max(0, Math.min(2, config.temperature))
      : 0.2;

  if (config.useDevProxy) {
    return {
      url: config.devProxyUrl?.trim() || DEFAULT_DEV_PROXY_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(config.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      wireFormat: "openai-sse",
    };
  }

  const baseUrl = (config.baseUrl?.trim() || preset.baseUrl)
    .trim()
    .replace(/\/+$/, "");

  if (preset.wireFormat === "gemini-sse") {
    const apiKey = (config.apiKey ?? "").trim();
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    return {
      url,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "x-goog-api-key": apiKey,
        ...(config.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature,
        },
      }),
      wireFormat: "gemini-sse",
    };
  }

  const apiKey = (config.apiKey ?? "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...(config.extraHeaders ?? {}),
  };
  if (apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return {
    url: `${baseUrl}/chat/completions`,
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    wireFormat: "openai-sse",
  };
}

/**
 * Extracts text delta content from a single SSE transport line (OpenAI-compatible SSE,
 * Gemini SSE, or raw JSONL fallback).
 */
function extractDeltaFromTransportLine(
  rawLine: string,
  wireFormat: LlmWireFormat,
): string | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(":") || /^(?:event|id|retry):/i.test(trimmed)) {
    return null;
  }

  const isDataLine = /^data:/i.test(trimmed);
  const payloadText = isDataLine
    ? trimmed.replace(/^data:\s*/i, "").trim()
    : trimmed;

  if (!payloadText || payloadText === "[DONE]") {
    return null;
  }

  // Raw NDJSON headers emitted directly without SSE wrapper
  if (!isDataLine && /^(?:BRIEF|CONSTRAINTS):/i.test(payloadText)) {
    return `${payloadText}\n`;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadText);
  } catch {
    return isDataLine ? null : `${payloadText}\n`;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (wireFormat === "gemini-sse") {
    const candidates = obj.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const first = candidates[0] as Record<string, unknown> | undefined;
      const content = first?.content as Record<string, unknown> | undefined;
      const parts = content?.parts;
      if (Array.isArray(parts)) {
        let joined = "";
        for (const part of parts) {
          if (
            part &&
            typeof part === "object" &&
            typeof (part as Record<string, unknown>).text === "string"
          ) {
            joined += (part as Record<string, unknown>).text as string;
          }
        }
        return joined.length > 0 ? joined : null;
      }
    }
  } else {
    const choices = obj.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown> | undefined;
      const delta = first?.delta as Record<string, unknown> | undefined;
      if (typeof delta?.content === "string") {
        return delta.content;
      }
      const message = first?.message as Record<string, unknown> | undefined;
      if (typeof message?.content === "string") {
        return message.content;
      }
      return null;
    }
  }

  // Raw RFC 6902 patch or whole-Spec line sent directly over NDJSON / data:
  if (
    typeof obj.op === "string" &&
    typeof obj.path === "string"
  ) {
    return `${payloadText}\n`;
  }
  if (
    typeof obj.root === "string" &&
    obj.elements &&
    typeof obj.elements === "object"
  ) {
    return `${payloadText}\n`;
  }

  return null;
}

function sanitizeJsonPayload(
  raw: unknown,
  pathContext: string,
  issues: GraphIssue[],
): unknown {
  return deepCloneAndSanitizeValue(
    raw,
    {
      healedNumbersCount: 0,
      blockedUrisCount: 0,
      blockedPathsCount: 0,
      issues,
    },
    pathContext,
  );
}

function mergeConstraints(
  ...groups: readonly (readonly PreservedConstraint[] | undefined)[]
): PreservedConstraint[] {
  const merged: PreservedConstraint[] = [];
  const seenIds = new Set<string>();
  for (const group of groups) {
    if (!group) continue;
    for (const item of group) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

function normalizeSectionKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ");
}

function buildFinalBrief(input: {
  readonly parsedBrief: CreativeBrief | null;
  readonly currentBrief: CreativeBrief | null | undefined;
  readonly mode: ArchitectInputMode;
  readonly prompt: string;
  readonly preservedConstraints: readonly PreservedConstraint[];
}): CreativeBrief {
  const mutableConstraints = [...input.preservedConstraints];
  if (input.parsedBrief) {
    return {
      ...input.parsedBrief,
      inputMode: input.mode,
      ...(mutableConstraints.length > 0
        ? { preservedConstraints: mutableConstraints }
        : {}),
    };
  }

  const firstHeading = extractMarkdownSections(input.prompt)[0];
  const title =
    firstHeading?.slice(0, 80) ??
    input.currentBrief?.title ??
    "GenUI Behavioral Blueprint";
  const summary = input.prompt.trim().slice(0, 300) || "Streamed GenUI specification";

  return {
    title,
    slug: input.currentBrief?.slug ?? slugifyTitle(title),
    inputMode: input.mode,
    promptSummary: summary,
    elevatorPitch: input.currentBrief?.elevatorPitch ?? summary.slice(0, 280),
    aestheticDirection:
      input.currentBrief?.aestheticDirection ?? "Precision studio interface",
    coreLoop:
      input.currentBrief?.coreLoop ??
      "Interact with verified catalog components to advance declarative rules.",
    ...(input.currentBrief?.winCondition
      ? { winCondition: input.currentBrief.winCondition }
      : {}),
    ...(input.currentBrief?.loseCondition
      ? { loseCondition: input.currentBrief.loseCondition }
      : {}),
    targetStack:
      input.currentBrief?.targetStack ?? "Next.js 15 + React 19 + TypeScript",
    scenes:
      input.currentBrief?.scenes && input.currentBrief.scenes.length > 0
        ? [...input.currentBrief.scenes]
        : ["main"],
    ...(mutableConstraints.length > 0
      ? { preservedConstraints: mutableConstraints }
      : {}),
  };
}

function buildMasterPromptAudit(input: {
  readonly prompt: string;
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly brief: CreativeBrief;
  readonly preservedConstraints: readonly PreservedConstraint[];
  readonly fuzzRuns: number;
  readonly fuzzMaxSteps: number;
  readonly fuzzSeed: number;
}): MasterPromptAudit {
  const promptSections = extractMarkdownSections(input.prompt);
  const mappedLookup = new Map<string, string>();

  const registerSection = (sec: string | undefined) => {
    if (!sec || !sec.trim()) return;
    const norm = normalizeSectionKey(sec);
    if (!mappedLookup.has(norm)) {
      mappedLookup.set(norm, sec.trim());
    }
  };

  for (const rule of input.rules) {
    registerSection(rule.sourceSection);
  }
  for (const constraint of input.preservedConstraints) {
    registerSection(constraint.sourceSection);
  }
  if (input.brief.elementSourceSections) {
    for (const sec of Object.values(input.brief.elementSourceSections)) {
      registerSection(sec);
    }
  }

  const unmappedSections = promptSections.filter((heading) => {
    const normHeading = normalizeSectionKey(heading);
    for (const normMapped of mappedLookup.keys()) {
      if (
        normMapped === normHeading ||
        normMapped.includes(normHeading) ||
        normHeading.includes(normMapped)
      ) {
        return false;
      }
    }
    return true;
  });

  const fuzzReport = fuzzPlaytestSpec({
    initialState: (input.spec.state ?? {}) as StateModel,
    rules: input.rules,
    initialScene: input.brief.scenes[0] ?? "main",
    numRuns: input.fuzzRuns,
    maxStepsPerRun: input.fuzzMaxSteps,
    seed: input.fuzzSeed,
  });

  return {
    promptSections,
    mappedSections: [...mappedLookup.values()],
    unmappedSections,
    preservedConstraints: input.preservedConstraints,
    fuzzReport,
    deadRules: fuzzReport.deadRules,
  };
}

/**
 * Streams `BRIEF:`, `CONSTRAINTS:`, and RFC 6902 JSONL patches from a real OpenAI-compatible
 * (Yantra AI, OpenAI, OpenRouter, Ollama) or Gemini SSE endpoint into
 * `createGuardrailedStreamCompiler` + `sanitizeInteractionRules`.
 *
 * Guarantees:
 * - Zero fake offline NLP: throws `LlmConfigurationRequiredError` if no endpoint is configured.
 * - Chunk-boundary invariance across arbitrary network byte splits & SSE token deltas.
 * - Transactional rollback: restores the exact pre-stream `{ spec, rules, brief }` snapshot
 *   on `AbortSignal` abort, HTTP non-2xx error, or stream read failure.
 */
export async function streamArchitectPatch(
  options: StreamArchitectPatchOptions,
): Promise<ArchitectStreamResult> {
  if (!isLlmConfigured(options.config)) {
    throw new LlmConfigurationRequiredError();
  }

  const config = options.config!;
  const mode: ArchitectInputMode =
    options.mode ?? detectRecommendedInputMode(options.prompt);

  const preStreamSnapshot: ArchitectSnapshot = {
    spec: structuredClone(options.currentSpec),
    rules: structuredClone(options.currentRules),
    brief: options.currentBrief ? structuredClone(options.currentBrief) : null,
  };

  let rolledBack = false;
  const triggerRollback = (reason: unknown): void => {
    if (rolledBack) return;
    rolledBack = true;
    options.onRollback?.(preStreamSnapshot, reason);
  };

  if (options.signal?.aborted) {
    const abortErr = new ArchitectStreamAbortedError(preStreamSnapshot);
    triggerRollback(abortErr);
    throw abortErr;
  }

  const promptSections =
    mode === "master-prompt" ? extractMarkdownSections(options.prompt) : [];
  const systemPrompt = buildArchitectSystemPrompt({
    mode,
    catalog: options.catalog,
    currentSpec: options.currentSpec,
    currentRules: options.currentRules,
    promptSections,
  });

  const requestSpec = buildProviderRequest(
    config,
    systemPrompt,
    options.prompt.trim(),
  );

  const fetchFn: FetchLike = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const compiler = createGuardrailedStreamCompiler({
    catalog: options.catalog,
    initialSpec: preStreamSnapshot.spec,
  });

  let workingRawRules: unknown[] = structuredClone(
    preStreamSnapshot.rules as InteractionRule[],
  );
  let currentSanitizedRules: readonly InteractionRule[] = sanitizeInteractionRules(
    workingRawRules,
  ).rules;
  let parsedBrief: CreativeBrief | null = preStreamSnapshot.brief;
  const extractedConstraints: PreservedConstraint[] = [];
  const extraIssues: GraphIssue[] = [];
  const extraRejectedLines: string[] = [];
  let appliedRulePatchesCount = 0;
  let rawContent = "";

  const handleLogicalLine = (rawLogicalLine: string): void => {
    const trimmed = rawLogicalLine.trim();
    if (!trimmed || trimmed.startsWith("```") || trimmed.startsWith("//")) {
      return;
    }

    // 1. BRIEF: {...} header
    if (/^BRIEF:\s*/i.test(trimmed)) {
      const jsonPart = trimmed.replace(/^BRIEF:\s*/i, "").trim();
      try {
        const rawJson = JSON.parse(jsonPart) as unknown;
        const sanitized = sanitizeJsonPayload(rawJson, "/brief", extraIssues);
        if (sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)) {
          const rec = sanitized as Record<string, unknown>;
          const candidateTitle =
            typeof rec.title === "string" && rec.title.trim().length > 0
              ? rec.title.trim().slice(0, 100)
              : "GenUI Experience";
          const normalized = {
            title: candidateTitle,
            slug:
              typeof rec.slug === "string" && rec.slug.trim().length > 0
                ? slugifyTitle(rec.slug)
                : slugifyTitle(candidateTitle),
            inputMode: mode,
            promptSummary:
              typeof rec.promptSummary === "string"
                ? rec.promptSummary.slice(0, 600)
                : options.prompt.trim().slice(0, 300),
            elevatorPitch:
              typeof rec.elevatorPitch === "string" && rec.elevatorPitch.trim().length > 0
                ? rec.elevatorPitch.trim().slice(0, 320)
                : candidateTitle,
            aestheticDirection:
              typeof rec.aestheticDirection === "string" &&
              rec.aestheticDirection.trim().length > 0
                ? rec.aestheticDirection.trim().slice(0, 240)
                : "Clean studio interface",
            coreLoop:
              typeof rec.coreLoop === "string" && rec.coreLoop.trim().length > 0
                ? rec.coreLoop.trim().slice(0, 320)
                : "Interact with catalog blocks to trigger declarative rules.",
            ...(typeof rec.winCondition === "string" && rec.winCondition.trim().length > 0
              ? { winCondition: rec.winCondition.trim().slice(0, 240) }
              : {}),
            ...(typeof rec.loseCondition === "string" && rec.loseCondition.trim().length > 0
              ? { loseCondition: rec.loseCondition.trim().slice(0, 240) }
              : {}),
            targetStack:
              typeof rec.targetStack === "string" && rec.targetStack.trim().length > 0
                ? rec.targetStack.trim().slice(0, 120)
                : "Next.js 15 + React 19 + TypeScript",
            scenes:
              Array.isArray(rec.scenes) && rec.scenes.length > 0
                ? rec.scenes
                    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
                    .map((s) => s.trim().slice(0, 64))
                    .slice(0, 24)
                : ["main"],
            ...(Array.isArray(rec.preservedConstraints)
              ? { preservedConstraints: rec.preservedConstraints }
              : {}),
            ...(rec.elementSourceSections &&
            typeof rec.elementSourceSections === "object" &&
            !Array.isArray(rec.elementSourceSections)
              ? {
                  elementSourceSections: Object.fromEntries(
                    Object.entries(
                      rec.elementSourceSections as Record<string, unknown>,
                    ).filter(
                      ([k, v]) =>
                        !isDangerousKey(k) && typeof v === "string" && v.trim().length > 0,
                    ),
                  ),
                }
              : {}),
          };

          const parsed = CreativeBriefSchema.safeParse(normalized);
          if (parsed.success) {
            parsedBrief = parsed.data;
            if (parsed.data.preservedConstraints) {
              for (const c of parsed.data.preservedConstraints) {
                extractedConstraints.push(c);
              }
            }
          } else {
            extraRejectedLines.push(trimmed.slice(0, 240));
            extraIssues.push({
              severity: "warning",
              code: "malformed_patch_line",
              message: `Ignored invalid BRIEF header: ${parsed.error.issues[0]?.message ?? "schema error"}.`,
            });
          }
        }
      } catch {
        extraRejectedLines.push(trimmed.slice(0, 240));
        extraIssues.push({
          severity: "warning",
          code: "malformed_patch_line",
          message: "Rejected malformed JSON in BRIEF header.",
        });
      }
      return;
    }

    // 2. CONSTRAINTS: [...] or CONSTRAINTS: {"constraints":[...]} header
    if (/^CONSTRAINTS:\s*/i.test(trimmed)) {
      const jsonPart = trimmed.replace(/^CONSTRAINTS:\s*/i, "").trim();
      try {
        const rawJson = JSON.parse(jsonPart) as unknown;
        const sanitized = sanitizeJsonPayload(rawJson, "/constraints", extraIssues);
        const list: unknown[] = Array.isArray(sanitized)
          ? sanitized
          : sanitized &&
              typeof sanitized === "object" &&
              Array.isArray((sanitized as Record<string, unknown>).constraints)
            ? ((sanitized as Record<string, unknown>).constraints as unknown[])
            : sanitized &&
                typeof sanitized === "object" &&
                Array.isArray(
                  (sanitized as Record<string, unknown>).preservedConstraints,
                )
              ? ((sanitized as Record<string, unknown>)
                  .preservedConstraints as unknown[])
              : [];

        for (let i = 0; i < list.length; i += 1) {
          const parsedConstraint = PreservedConstraintSchema.safeParse(list[i]);
          if (parsedConstraint.success) {
            extractedConstraints.push(parsedConstraint.data);
          } else {
            extraIssues.push({
              severity: "warning",
              code: "malformed_patch_line",
              message: `Dropped invalid constraint at index ${i}: ${parsedConstraint.error.issues[0]?.message ?? "schema error"}.`,
            });
          }
        }
      } catch {
        extraRejectedLines.push(trimmed.slice(0, 240));
        extraIssues.push({
          severity: "warning",
          code: "malformed_patch_line",
          message: "Rejected malformed JSON in CONSTRAINTS header.",
        });
      }
      return;
    }

    // 3. Intercept /experience/rules RFC 6902 patches (since Spec only keeps root/elements/state)
    let maybePatch: unknown = null;
    try {
      maybePatch = JSON.parse(trimmed);
    } catch {
      // Let guardrailed stream compiler record the malformed line cleanly
      compiler.push(`${trimmed}\n`);
      return;
    }

    if (
      maybePatch &&
      typeof maybePatch === "object" &&
      !Array.isArray(maybePatch)
    ) {
      const rec = maybePatch as Record<string, unknown>;
      const patchPath = typeof rec.path === "string" ? rec.path : "";
      const patchOp = typeof rec.op === "string" ? rec.op : "";

      if (
        patchOp &&
        (patchPath === "/experience" ||
          patchPath === "/experience/rules" ||
          patchPath.startsWith("/experience/rules/"))
      ) {
        if (!isSafeJsonPointer(patchPath)) {
          extraRejectedLines.push(trimmed.slice(0, 240));
          extraIssues.push({
            severity: "error",
            code: "blocked_unsafe_path",
            path: patchPath,
            message: `Blocked unsafe interaction rule patch pointer "${patchPath}".`,
          });
          return;
        }

        if (patchPath === "/experience/rules" && (patchOp === "add" || patchOp === "replace")) {
          if (Array.isArray(rec.value)) {
            workingRawRules = [...rec.value];
            appliedRulePatchesCount += 1;
          }
        } else if (patchPath === "/experience/rules/-" && patchOp === "add") {
          workingRawRules = [...workingRawRules, rec.value];
          appliedRulePatchesCount += 1;
        } else if (patchPath.startsWith("/experience/rules/")) {
          const idxRaw = patchPath.slice("/experience/rules/".length);
          const idx = Number(idxRaw);
          if (Number.isInteger(idx) && idx >= 0 && idx <= workingRawRules.length) {
            if (patchOp === "remove" && idx < workingRawRules.length) {
              workingRawRules.splice(idx, 1);
              appliedRulePatchesCount += 1;
            } else if (patchOp === "replace" && idx < workingRawRules.length) {
              workingRawRules[idx] = rec.value;
              appliedRulePatchesCount += 1;
            } else if (patchOp === "add") {
              workingRawRules.splice(idx, 0, rec.value);
              appliedRulePatchesCount += 1;
            }
          }
        } else if (
          patchPath === "/experience" &&
          (patchOp === "add" || patchOp === "replace") &&
          rec.value &&
          typeof rec.value === "object" &&
          !Array.isArray(rec.value)
        ) {
          const expObj = rec.value as Record<string, unknown>;
          if (Array.isArray(expObj.rules)) {
            workingRawRules = [...expObj.rules];
            appliedRulePatchesCount += 1;
          }
        }

        const sanitized = sanitizeInteractionRules(workingRawRules);
        currentSanitizedRules = sanitized.rules;
        if (sanitized.issues.length > 0) {
          extraIssues.push(...sanitized.issues);
        }
        return;
      }

      // Whole-Spec payload that also includes a top-level `rules` array
      if (!patchOp && Array.isArray(rec.rules)) {
        workingRawRules = [...rec.rules];
        const sanitized = sanitizeInteractionRules(workingRawRules);
        currentSanitizedRules = sanitized.rules;
        if (sanitized.issues.length > 0) {
          extraIssues.push(...sanitized.issues);
        }
        appliedRulePatchesCount += 1;
      }
    }

    // 4. All UI / state RFC 6902 patches go straight through createGuardrailedStreamCompiler
    compiler.push(`${trimmed}\n`);
  };

  let sseLineBuffer = "";
  let contentLineBuffer = "";

  const pushTextDelta = (delta: string): void => {
    if (!delta) return;
    rawContent += delta;
    contentLineBuffer += delta;

    let nlIdx = contentLineBuffer.indexOf("\n");
    while (nlIdx !== -1) {
      const line = contentLineBuffer.slice(0, nlIdx).replace(/\r$/, "");
      contentLineBuffer = contentLineBuffer.slice(nlIdx + 1);
      handleLogicalLine(line);
      nlIdx = contentLineBuffer.indexOf("\n");
    }
  };

  const pushTransportChunk = (decodedText: string): void => {
    if (!decodedText) return;
    sseLineBuffer += decodedText;

    let nlIdx = sseLineBuffer.indexOf("\n");
    while (nlIdx !== -1) {
      const line = sseLineBuffer.slice(0, nlIdx).replace(/\r$/, "");
      sseLineBuffer = sseLineBuffer.slice(nlIdx + 1);
      const delta = extractDeltaFromTransportLine(line, requestSpec.wireFormat);
      if (delta !== null) {
        pushTextDelta(delta);
      }
      nlIdx = sseLineBuffer.indexOf("\n");
    }
  };

  const emitProgress = (): void => {
    if (!options.onProgress) return;
    options.onProgress({
      spec: compiler.getSpec(),
      rules: currentSanitizedRules,
      brief: parsedBrief,
      preservedConstraints: mergeConstraints(
        parsedBrief?.preservedConstraints,
        extractedConstraints,
      ),
      appliedPatchesCount:
        compiler.getAppliedPatches().length + appliedRulePatchesCount,
      healedDiagnostics: compiler.getHealedDiagnostics(),
      issues: [...compiler.getTelemetry().recentIssues, ...extraIssues],
    });
  };

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const onSignalAbort = () => {
    if (reader) {
      void reader.cancel().catch(() => {});
    }
  };
  options.signal?.addEventListener("abort", onSignalAbort, { once: true });

  try {
    const response = await fetchFn(requestSpec.url, {
      method: "POST",
      headers: requestSpec.headers,
      body: requestSpec.body,
      signal: options.signal,
    });

    if (options.signal?.aborted) {
      const abortErr = new ArchitectStreamAbortedError(preStreamSnapshot);
      triggerRollback(abortErr);
      throw abortErr;
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      const httpErr = new ArchitectHttpError(
        response.status,
        response.statusText,
        errBody.slice(0, 400),
        preStreamSnapshot,
      );
      triggerRollback(httpErr);
      throw httpErr;
    }

    const decoder = new TextDecoder("utf-8");

    if (response.body && typeof response.body.getReader === "function") {
      reader = response.body.getReader();
      while (true) {
        if (options.signal?.aborted) {
          await reader.cancel().catch(() => {});
          const abortErr = new ArchitectStreamAbortedError(preStreamSnapshot);
          triggerRollback(abortErr);
          throw abortErr;
        }

        const { value, done } = await reader.read();
        if (options.signal?.aborted) {
          await reader.cancel().catch(() => {});
          const abortErr = new ArchitectStreamAbortedError(preStreamSnapshot);
          triggerRollback(abortErr);
          throw abortErr;
        }
        if (done) break;
        if (value && value.byteLength > 0) {
          const decoded = decoder.decode(value, { stream: true });
          pushTransportChunk(decoded);
          emitProgress();
        }
      }
      // Flush trailing multi-byte UTF-8 state
      const tail = decoder.decode();
      if (tail) {
        pushTransportChunk(tail);
      }
    } else {
      const fullText = await response.text();
      if (options.signal?.aborted) {
        const abortErr = new ArchitectStreamAbortedError(preStreamSnapshot);
        triggerRollback(abortErr);
        throw abortErr;
      }
      pushTransportChunk(fullText);
    }

    // Flush trailing transport line & trailing logical content line (no trailing newline)
    if (sseLineBuffer.trim().length > 0) {
      const trailingDelta = extractDeltaFromTransportLine(
        sseLineBuffer.replace(/\r$/, ""),
        requestSpec.wireFormat,
      );
      sseLineBuffer = "";
      if (trailingDelta !== null) {
        pushTextDelta(trailingDelta);
      }
    }
    if (contentLineBuffer.trim().length > 0) {
      handleLogicalLine(contentLineBuffer.replace(/\r$/, ""));
      contentLineBuffer = "";
    }

    const finalized = compiler.finalize();
    const finalRuleSanitize = sanitizeInteractionRules(workingRawRules);
    const finalRules = finalRuleSanitize.rules;
    const allConstraints = mergeConstraints(
      parsedBrief?.preservedConstraints,
      extractedConstraints,
    );
    const finalBrief = buildFinalBrief({
      parsedBrief,
      currentBrief: preStreamSnapshot.brief,
      mode,
      prompt: options.prompt,
      preservedConstraints: allConstraints,
    });

    const shouldAudit =
      options.runFuzzAudit ?? (mode === "master-prompt" || finalRules.length > 0);

    const audit = shouldAudit
      ? buildMasterPromptAudit({
          prompt: options.prompt,
          spec: finalized.spec,
          rules: finalRules,
          brief: finalBrief,
          preservedConstraints: allConstraints,
          fuzzRuns: options.fuzzRuns ?? 100,
          fuzzMaxSteps: options.fuzzMaxSteps ?? 24,
          fuzzSeed: options.fuzzSeed ?? 42,
        })
      : null;

    const allIssues: GraphIssue[] = [
      ...finalized.telemetry.recentIssues,
      ...extraIssues,
      ...finalRuleSanitize.issues,
    ];

    return {
      spec: finalized.spec,
      rules: finalRules,
      brief: finalBrief,
      preservedConstraints: allConstraints,
      mode,
      appliedPatchesCount:
        compiler.getAppliedPatches().length + appliedRulePatchesCount,
      rejectedLines: [...compiler.getRejectedLines(), ...extraRejectedLines],
      issues: allIssues,
      healedDiagnostics: finalized.healedDiagnostics,
      telemetry: finalized.telemetry,
      audit,
      rawContent,
    };
  } catch (err) {
    if (
      err instanceof LlmConfigurationRequiredError ||
      err instanceof ArchitectStreamAbortedError ||
      err instanceof ArchitectHttpError ||
      err instanceof ArchitectStreamError
    ) {
      triggerRollback(err);
      throw err;
    }

    const isAbort =
      options.signal?.aborted === true ||
      (err instanceof Error && err.name === "AbortError");

    if (isAbort) {
      const abortErr = new ArchitectStreamAbortedError(preStreamSnapshot);
      triggerRollback(abortErr);
      throw abortErr;
    }

    const wrapped = new ArchitectStreamError(
      err instanceof Error ? err.message : "Streaming LLM architect failed.",
      preStreamSnapshot,
      err,
    );
    triggerRollback(wrapped);
    throw wrapped;
  } finally {
    options.signal?.removeEventListener("abort", onSignalAbort);
  }
}
