import type { Spec, UIElement } from "@json-render/core";
import {
  isDangerousKey,
  isSafeJsonPointer,
  sanitizeSpecGraph,
  type GraphIssue,
  type PropDiagnostic,
  type VerifiedCatalog,
} from "@genui-studio/core";
import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawRectangleElement,
  ExcalidrawTextElement,
  ExcalidrawArrowElement,
  FractionalIndex,
  NonDeleted,
} from "@excalidraw/excalidraw/element/types";
import type { LibraryItem } from "@excalidraw/excalidraw/types";

export const MAX_CANVAS_ELEMENTS = 250;
export const MAX_TREE_DEPTH = 12;
export const MAX_PROP_TEXT_LEN = 140;
const MAX_COORD_MAGNITUDE = 1_000_000;
const DEFAULT_CANVAS_WIDTH = 340;
const DEFAULT_CANVAS_HEIGHT = 110;

export interface NormalizedBoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
  readonly area: number;
  readonly centerX: number;
  readonly centerY: number;
}

export interface CompiledNodeMapping {
  readonly elementId: string;
  readonly specKey: string;
  readonly componentType: string;
  readonly label: string;
  readonly bbox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly parentSpecKey: string | null;
  /**
   * How the catalog component was chosen:
   * - `tag`: explicit `customData.catalogComponent` / `genuiComponent` found in the catalog
   * - `label`: matched from the shape's text label (exact name, keyword or description)
   * - `fallback`: nothing matched; the default content component was used
   */
  readonly matchSource: WireframeMatchSource;
}

export type WireframeMatchSource = "tag" | "label" | "fallback";

export interface CompiledStateBinding {
  readonly arrowId: string;
  readonly sourceSpecKey: string;
  readonly targetSpecKey: string;
  readonly pointerPath: string;
  readonly label: string;
  readonly boundPropName: string | null;
}

export interface ExcalidrawCompileOptions {
  readonly catalog?: VerifiedCatalog<any, any>;
  readonly baseSpec?: Spec | null;
  readonly rootComponentName?: string;
  readonly slug?: string;
}

export interface ExcalidrawCompileResult {
  readonly spec: Spec;
  readonly compiledNodeCount: number;
  readonly stateBindings: readonly CompiledStateBinding[];
  readonly resolvedMappings: readonly CompiledNodeMapping[];
  readonly mermaidDiagram: string;
  readonly warnings: readonly string[];
  readonly catalogHash: string | null;
  /** Structural / catalog issues reported by `catalog.validateFull()` (or `sanitizeSpecGraph()` without a catalog). */
  readonly validationIssues: readonly GraphIssue[];
  /** Props healed or rejected at the catalog Zod boundary (status `"valid"` entries are omitted). */
  readonly propDiagnostics: readonly PropDiagnostic[];
}

export interface CatalogLibraryBuildResult {
  readonly libraryItems: readonly LibraryItem[];
  readonly componentSummaries: readonly {
    readonly name: string;
    readonly description: string;
    readonly isContainer: boolean;
  }[];
}

export interface KiroWireframeExport {
  readonly filenameExcalidraw: string;
  readonly excalidrawJson: string;
  readonly filenameDesignMd: string;
  readonly mermaidDiagram: string;
  readonly designMdSection: string;
}

interface InternalVisualNode {
  readonly rawId: string;
  readonly specKey: string;
  readonly rawType: string;
  readonly bbox: NormalizedBoundingBox;
  readonly frameId: string | null;
  readonly customData: Record<string, unknown> | null;
  readonly rawText: string;
  readonly titleLine: string;
  readonly subtitleLine: string;
  readonly resolvedComponent: string;
  readonly matchSource: WireframeMatchSource;
  readonly isContainerCandidate: boolean;
  parentSpecKey: string | null;
  readonly childKeys: string[];
}

function finiteOr(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const normalizedZero = Object.is(value, -0) ? 0 : value;
  return Math.max(
    -MAX_COORD_MAGNITUDE,
    Math.min(MAX_COORD_MAGNITUDE, normalizedZero),
  );
}

function normalizeBoundingBox(
  xRaw: unknown,
  yRaw: unknown,
  wRaw: unknown,
  hRaw: unknown,
): NormalizedBoundingBox {
  let x = finiteOr(xRaw, 0);
  let y = finiteOr(yRaw, 0);
  let width = finiteOr(wRaw, 120);
  let height = finiteOr(hRaw, 60);

  if (width < 0) {
    x += width;
    width = Math.abs(width);
  }
  if (height < 0) {
    y += height;
    height = Math.abs(height);
  }

  width = Math.max(1, width);
  height = Math.max(1, height);

  return {
    minX: x,
    minY: y,
    maxX: x + width,
    maxY: y + height,
    width,
    height,
    area: width * height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

function computeContainmentRatio(
  inner: NormalizedBoundingBox,
  outer: NormalizedBoundingBox,
): number {
  const overlapX = Math.max(
    0,
    Math.min(inner.maxX, outer.maxX) - Math.max(inner.minX, outer.minX),
  );
  const overlapY = Math.max(
    0,
    Math.min(inner.maxY, outer.maxY) - Math.max(inner.minY, outer.minY),
  );
  const intersectionArea = overlapX * overlapY;
  return intersectionArea / Math.max(inner.area, 1);
}

function sanitizeSafeIdentifier(raw: unknown, fallback: string): string {
  const str = typeof raw === "string" ? raw : fallback;
  const cleaned = str
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  if (!cleaned || isDangerousKey(cleaned)) {
    return fallback;
  }
  return cleaned;
}

function createUniqueSpecKey(
  rawId: unknown,
  index: number,
  usedKeys: Set<string>,
): string {
  const base = sanitizeSafeIdentifier(rawId, `node-${index + 1}`);
  let candidate = `wf-${base}`;
  if (isDangerousKey(candidate)) {
    candidate = `wf-el-${index + 1}`;
  }
  let suffix = 1;
  while (usedKeys.has(candidate) || isDangerousKey(candidate)) {
    candidate = `wf-${base}-${suffix++}`;
  }
  usedKeys.add(candidate);
  return candidate;
}

function sanitizeMermaidLabel(raw: string): string {
  return raw
    .replace(/[<>"`\\]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

function sanitizeMermaidId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

function sanitizeCustomData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const safe: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const [k, v] of Object.entries(raw)) {
    if (isDangerousKey(k)) continue;
    safe[k] = v;
  }
  return safe;
}

/**
 * Inspects a Zod v4 field/object schema to produce deterministic, schema-compliant
 * default props so newly drawn Excalidraw shapes render cleanly without validation errors.
 */
function synthesizeValueFromZodSchema(
  zodSchema: unknown,
  componentName: string,
  fieldName = "",
  depth = 0,
): unknown {
  if (!zodSchema || typeof zodSchema !== "object" || depth > 4) {
    return `${componentName} value`;
  }

  const schemaObj = zodSchema as {
    def?: {
      type?: string;
      innerType?: unknown;
      options?: unknown[];
      element?: unknown;
      entries?: Record<string, unknown>;
      values?: unknown[];
      defaultValue?: unknown;
    };
    _zod?: {
      def?: {
        type?: string;
        innerType?: unknown;
        options?: unknown[];
        element?: unknown;
        entries?: Record<string, unknown>;
        values?: unknown[];
        defaultValue?: unknown;
      };
    };
    shape?: Record<string, unknown>;
    options?: unknown[];
    minValue?: number | null;
    maxValue?: number | null;
    minLength?: number | null;
    maxLength?: number | null;
  };

  const def = schemaObj.def ?? schemaObj._zod?.def ?? {};
  const typeName = def.type;

  switch (typeName) {
    case "string": {
      const labelBase = fieldName
        ? `${componentName} ${fieldName}`
        : `${componentName} Block`;
      const minLen =
        typeof schemaObj.minLength === "number" && schemaObj.minLength > 0
          ? schemaObj.minLength
          : 1;
      const maxLen =
        typeof schemaObj.maxLength === "number" && schemaObj.maxLength > 0
          ? schemaObj.maxLength
          : MAX_PROP_TEXT_LEN;
      let text = labelBase.slice(0, Math.max(1, maxLen));
      if (text.length < minLen) {
        text = text.padEnd(minLen, ".");
      }
      return text;
    }

    case "number":
    case "int": {
      const min =
        typeof schemaObj.minValue === "number" &&
        Number.isFinite(schemaObj.minValue)
          ? Math.ceil(schemaObj.minValue)
          : 1;
      const max =
        typeof schemaObj.maxValue === "number" &&
        Number.isFinite(schemaObj.maxValue)
          ? Math.floor(schemaObj.maxValue)
          : Math.max(min + 10, 100);
      const bounded = Math.min(Math.max(min, Math.round((min + max) / 2)), max);
      return Object.is(bounded, -0) ? 0 : bounded;
    }

    case "boolean":
      return true;

    case "null":
      return null;

    case "literal": {
      const vals = Array.isArray(def.values) ? def.values : [null];
      return vals[0] ?? null;
    }

    case "enum": {
      const opts = Array.isArray(schemaObj.options)
        ? schemaObj.options
        : def.entries
          ? Object.values(def.entries)
          : ["default"];
      return opts[0] ?? "default";
    }

    case "default":
      if (def.defaultValue !== undefined) {
        return typeof def.defaultValue === "function"
          ? (def.defaultValue as () => unknown)()
          : def.defaultValue;
      }
      return synthesizeValueFromZodSchema(
        def.innerType,
        componentName,
        fieldName,
        depth + 1,
      );

    case "optional":
    case "nullable":
      return synthesizeValueFromZodSchema(
        def.innerType,
        componentName,
        fieldName,
        depth + 1,
      );

    case "union": {
      const unionOpts = Array.isArray(def.options) ? def.options : [];
      if (unionOpts.length === 0) return null;
      return synthesizeValueFromZodSchema(
        unionOpts[0],
        componentName,
        fieldName,
        depth + 1,
      );
    }

    case "array": {
      const item = synthesizeValueFromZodSchema(
        def.element,
        componentName,
        fieldName,
        depth + 1,
      );
      return item === undefined ? [] : [item];
    }

    case "object": {
      const shape = schemaObj.shape;
      if (!shape || typeof shape !== "object") return {};
      const out: Record<string, unknown> = {};
      for (const [k, fieldSchema] of Object.entries(shape)) {
        if (isDangerousKey(k)) continue;
        out[k] = synthesizeValueFromZodSchema(
          fieldSchema,
          componentName,
          k,
          depth + 1,
        );
      }
      return out;
    }

    default: {
      if (schemaObj.shape && typeof schemaObj.shape === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, fieldSchema] of Object.entries(schemaObj.shape)) {
          if (isDangerousKey(k)) continue;
          out[k] = synthesizeValueFromZodSchema(
            fieldSchema,
            componentName,
            k,
            depth + 1,
          );
        }
        return out;
      }
      return `${componentName}`;
    }
  }
}

function collectSamplePropsByComponent(
  baseSpec: Spec | null | undefined,
): Map<string, Record<string, unknown>> {
  const sampleMap = new Map<string, Record<string, unknown>>();
  if (!baseSpec?.elements) return sampleMap;

  for (const el of Object.values(baseSpec.elements)) {
    if (!el || typeof el.type !== "string" || isDangerousKey(el.type)) continue;
    if (sampleMap.has(el.type)) continue;
    if (el.props && typeof el.props === "object" && !Array.isArray(el.props)) {
      const cloned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(el.props)) {
        if (!isDangerousKey(k)) {
          cloned[k] = v;
        }
      }
      sampleMap.set(el.type, cloned);
    }
  }
  return sampleMap;
}

function buildDefaultPropsForComponent(
  componentName: string,
  catalog: VerifiedCatalog<any, any> | undefined,
  samplePropsByType: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const fromSample = samplePropsByType.get(componentName);
  const zodSchema = catalog?.getComponentZodSchema(componentName);
  const synthesized = zodSchema
    ? synthesizeValueFromZodSchema(zodSchema, componentName, "", 0)
    : {};
  const synthRecord =
    synthesized && typeof synthesized === "object" && !Array.isArray(synthesized)
      ? (synthesized as Record<string, unknown>)
      : {};

  return {
    ...synthRecord,
    ...(fromSample ?? {}),
  };
}

const CONTAINER_NAME_PATTERN =
  /(shell|layout|page|container|frame|world|wrapper|stage|root|console)/i;

function isLikelyContainerComponent(
  componentName: string,
  rootComponentName: string,
): boolean {
  return (
    componentName === rootComponentName ||
    CONTAINER_NAME_PATTERN.test(componentName)
  );
}

const KEYWORD_SYNONYMS: readonly (readonly [RegExp, readonly string[]])[] = [
  [/hero|banner|intro|landing|header|headline/i, ["Hero", "Header", "Intro", "Banner"]],
  [/metric|kpi|stat|counter|telemetry|uptime|score|chart/i, ["Metric", "Telemetry", "Stat", "Strip", "Chart"]],
  [/feature|grid|card|pricing|testimonial|list|table|archive|dossier/i, ["Grid", "Feature", "Dossier", "Archive", "Card", "Table"]],
  [/shell|layout|page|frame|wrapper|root|console|world/i, ["Shell", "Layout", "World", "Console", "Page"]],
  [/nav|menu|sidebar|bar|tab|action/i, ["Nav", "Bar", "Menu", "Hud", "Controls"]],
];

function scoreComponentMatch(
  query: string,
  componentName: string,
  description: string,
): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const compactQuery = normalizedQuery.replace(/[^a-z0-9]/g, "");
  const lowerName = componentName.toLowerCase();
  const compactName = lowerName.replace(/[^a-z0-9]/g, "");

  if (compactQuery === compactName) return 1000;
  if (normalizedQuery === lowerName) return 950;
  if (compactQuery.length >= 3 && compactName.includes(compactQuery)) return 400;
  if (compactName.length >= 3 && compactQuery.includes(compactName)) return 320;

  let score = 0;
  const tokens = normalizedQuery
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  const lowerDesc = description.toLowerCase();

  for (const token of tokens) {
    if (lowerName.includes(token)) score += 60;
    if (lowerDesc.includes(token)) score += 20;
  }

  for (const [pattern, hints] of KEYWORD_SYNONYMS) {
    if (pattern.test(normalizedQuery)) {
      for (const hint of hints) {
        if (lowerName.includes(hint.toLowerCase())) {
          score += 90;
        }
      }
    }
  }

  return score;
}

function resolveCatalogComponent(
  titleLine: string,
  fullText: string,
  customData: Record<string, unknown> | null,
  componentNames: readonly string[],
  componentDescriptions: Readonly<Record<string, string>>,
  fallbackComponent: string,
): {
  componentType: string;
  matchedExplicitly: boolean;
  matchSource: WireframeMatchSource;
  ignoredTag: string | null;
} {
  const customComp =
    typeof customData?.catalogComponent === "string"
      ? customData.catalogComponent
      : typeof customData?.genuiComponent === "string"
        ? customData.genuiComponent
        : null;

  let ignoredTag: string | null = null;
  if (customComp) {
    if (
      !isDangerousKey(customComp) &&
      (componentNames.length === 0 || componentNames.includes(customComp))
    ) {
      return {
        componentType: customComp,
        matchedExplicitly: true,
        matchSource: "tag",
        ignoredTag: null,
      };
    }
    ignoredTag = customComp;
  }

  if (componentNames.length === 0) {
    return {
      componentType: titleLine || fallbackComponent,
      matchedExplicitly: Boolean(titleLine),
      matchSource: titleLine ? "label" : "fallback",
      ignoredTag,
    };
  }

  let bestName = fallbackComponent;
  let bestScore = 0;

  for (const name of componentNames) {
    const desc = componentDescriptions[name] ?? "";
    const lineScore = scoreComponentMatch(titleLine, name, desc) * 2;
    const bodyScore = scoreComponentMatch(fullText, name, desc);
    const total = Math.max(lineScore, bodyScore);
    if (total > bestScore) {
      bestScore = total;
      bestName = name;
    }
  }

  return {
    componentType: bestScore > 0 ? bestName : fallbackComponent,
    matchedExplicitly: bestScore >= 300,
    matchSource: bestScore > 0 ? "label" : "fallback",
    ignoredTag,
  };
}

/** Printable, length-capped form of user-supplied text for compiler warnings. */
function describeForWarning(raw: string): string {
  const flat = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > 48 ? `${flat.slice(0, 47)}…` : flat;
}

const HEADLINE_PROP_PRIORITY = [
  "headline",
  "title",
  "heading",
  "sectionTitle",
  "brandName",
  "eyebrow",
  "label",
  "name",
] as const;

const SUMMARY_PROP_PRIORITY = [
  "summary",
  "tagline",
  "description",
  "subtitle",
  "detail",
  "primaryLabel",
] as const;

function applyWireframeTextToProps(
  props: Record<string, unknown>,
  componentType: string,
  titleLine: string,
  subtitleLine: string,
  matchedTitleAsExactComponent: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...props };
  const primaryText = matchedTitleAsExactComponent
    ? subtitleLine
    : titleLine || subtitleLine;
  const secondaryText = matchedTitleAsExactComponent ? "" : subtitleLine;

  if (primaryText) {
    const safeHeadline = primaryText.slice(0, MAX_PROP_TEXT_LEN);
    const targetKey = HEADLINE_PROP_PRIORITY.find(
      (key) => typeof next[key] === "string",
    );
    if (targetKey) {
      next[targetKey] = safeHeadline;
    } else if (Object.keys(next).length === 0) {
      next.title = safeHeadline;
    }
  }

  if (secondaryText) {
    const safeSummary = secondaryText.slice(0, MAX_PROP_TEXT_LEN);
    const summaryKey = SUMMARY_PROP_PRIORITY.find(
      (key) => typeof next[key] === "string",
    );
    if (summaryKey) {
      next[summaryKey] = safeSummary;
    }
  }

  if (
    typeof next.badge === "string" &&
    (titleLine || subtitleLine) &&
    componentType === "SiteShell"
  ) {
    next.badge = "WIREFRAME LIVE";
  }

  return next;
}

function wouldCreateParentCycle(
  nodeKey: string,
  candidateParentKey: string,
  nodesByKey: Map<string, InternalVisualNode>,
): boolean {
  if (nodeKey === candidateParentKey) return true;
  let current: string | null = candidateParentKey;
  const visited = new Set<string>([nodeKey]);
  let hops = 0;

  while (current && hops <= MAX_TREE_DEPTH + 4) {
    if (visited.has(current)) return true;
    visited.add(current);
    const parentNode = nodesByKey.get(current);
    if (!parentNode) break;
    current = parentNode.parentSpecKey;
    hops += 1;
  }

  return hops > MAX_TREE_DEPTH;
}

/**
 * Locale-independent string order (UTF-16 code units). `localeCompare` would make the
 * compiled Spec depend on the runtime's default locale (e.g. Danish sorts "aa" after "z").
 */
function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareVisualNodes(
  a: InternalVisualNode,
  b: InternalVisualNode,
): number {
  if (a.bbox.minY !== b.bbox.minY) {
    return a.bbox.minY - b.bbox.minY;
  }
  if (a.bbox.minX !== b.bbox.minX) {
    return a.bbox.minX - b.bbox.minX;
  }
  return compareCodePoints(a.rawId, b.rawId);
}

function buildMermaidArchitecture(
  mappings: readonly CompiledNodeMapping[],
  stateBindings: readonly CompiledStateBinding[],
  rootKey: string,
  rootType: string,
): string {
  const lines: string[] = ["flowchart TD"];
  const rootMermaidId = sanitizeMermaidId(rootKey);
  lines.push(`  ${rootMermaidId}["${sanitizeMermaidLabel(`${rootType} (${rootKey})`)}"]`);

  const mappedBySpec = new Set<string>([rootKey]);
  for (const node of mappings) {
    if (node.specKey === rootKey) continue;
    const mId = sanitizeMermaidId(node.specKey);
    const nodeLabel = node.label
      ? `${node.componentType}: ${node.label}`
      : node.componentType;
    lines.push(`  ${mId}["${sanitizeMermaidLabel(nodeLabel)}"]`);
    mappedBySpec.add(node.specKey);
  }

  for (const node of mappings) {
    if (node.specKey === rootKey) continue;
    const parent = node.parentSpecKey ?? rootKey;
    const parentId = sanitizeMermaidId(mappedBySpec.has(parent) ? parent : rootKey);
    const childId = sanitizeMermaidId(node.specKey);
    lines.push(`  ${parentId} --> ${childId}`);
  }

  for (const binding of stateBindings) {
    const src = sanitizeMermaidId(binding.sourceSpecKey);
    const dst = sanitizeMermaidId(binding.targetSpecKey);
    const edgeLabel = sanitizeMermaidLabel(binding.pointerPath);
    lines.push(`  ${src} -.->|"${edgeLabel}"| ${dst}`);
  }

  return lines.join("\n");
}

/**
 * Pure, deterministic compiler turning Excalidraw scene elements into a strictly valid,
 * DAG-sanitized & catalog-validated @genui-studio/core Spec (UITree).
 */
export function compileExcalidrawToGenUI(
  rawElements: readonly unknown[],
  options: ExcalidrawCompileOptions = {},
): ExcalidrawCompileResult {
  const warnings: string[] = [];
  const catalog = options.catalog;
  const componentNames = catalog?.metadata.componentNames ?? [];
  const componentDescriptions = catalog?.metadata.componentDescriptions ?? {};

  const samplePropsByType = collectSamplePropsByComponent(options.baseSpec);
  const baseRootType =
    options.rootComponentName ??
    options.baseSpec?.elements?.[options.baseSpec.root]?.type;
  const rootComponentName =
    baseRootType ??
    componentNames.find((name) => CONTAINER_NAME_PATTERN.test(name)) ??
    componentNames[0] ??
    "SiteShell";

  const fallbackContentComponent =
    componentNames.find((name) => name !== rootComponentName) ??
    componentNames[0] ??
    "HeroSection";

  if (!Array.isArray(rawElements)) {
    const fallbackRootProps = buildDefaultPropsForComponent(
      rootComponentName,
      catalog,
      samplePropsByType,
    );
    const emptySpec: Spec = {
      root: "wireframe-root",
      elements: {
        "wireframe-root": {
          type: rootComponentName,
          props: fallbackRootProps,
          children: [],
        },
      },
    };
    return {
      spec: emptySpec,
      compiledNodeCount: 0,
      stateBindings: [],
      resolvedMappings: [],
      mermaidDiagram: buildMermaidArchitecture(
        [],
        [],
        "wireframe-root",
        rootComponentName,
      ),
      warnings: ["Expected array of Excalidraw elements; initialized empty root spec."],
      catalogHash: catalog?.metadata.catalogHash ?? null,
      validationIssues: [],
      propDiagnostics: [],
    };
  }

  const activeElements: Record<string, unknown>[] = [];
  for (let i = 0; i < rawElements.length; i += 1) {
    if (activeElements.length >= MAX_CANVAS_ELEMENTS) {
      warnings.push(
        `Truncated canvas scene to ${MAX_CANVAS_ELEMENTS} elements to enforce render budget.`,
      );
      break;
    }
    const raw = rawElements[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const rec = raw as Record<string, unknown>;
    if (rec.isDeleted === true) continue;
    if (rec.type === "selection") continue;
    activeElements.push(rec);
  }

  // Pass 1: collect bound text labels indexed by containerId
  const containerTextMap = new Map<string, string[]>();
  const textByIdMap = new Map<string, string>();
  for (const el of activeElements) {
    if (el.type === "text" && typeof el.text === "string") {
      const idStr = typeof el.id === "string" ? el.id : "";
      if (idStr) {
        textByIdMap.set(idStr, el.text);
      }
      if (typeof el.containerId === "string" && el.containerId.length > 0) {
        const list = containerTextMap.get(el.containerId) ?? [];
        list.push(el.text);
        containerTextMap.set(el.containerId, list);
      }
    }
  }

  const SHAPE_TYPES = new Set([
    "rectangle",
    "diamond",
    "ellipse",
    "frame",
    "magicframe",
    "embeddable",
    "iframe",
    "image",
  ]);

  const visualNodes: InternalVisualNode[] = [];
  const seenIds = new Set<string>();
  const usedSpecKeys = new Set<string>();
  const rawIdToNode = new Map<string, InternalVisualNode>();
  const specKeyToNode = new Map<string, InternalVisualNode>();

  // Pass 2: normalize drawable UI blocks & standalone text labels
  for (let i = 0; i < activeElements.length; i += 1) {
    const el = activeElements[i]!;
    const rawType = typeof el.type === "string" ? el.type : "rectangle";
    const rawId =
      typeof el.id === "string" && el.id.length > 0 ? el.id : `anon-${i + 1}`;
    if (seenIds.has(rawId)) continue;

    const isUnboundText =
      rawType === "text" &&
      (typeof el.containerId !== "string" || el.containerId.length === 0);

    if (!SHAPE_TYPES.has(rawType) && !isUnboundText) {
      continue;
    }

    seenIds.add(rawId);
    const specKey = createUniqueSpecKey(rawId, i, usedSpecKeys);
    const customData = sanitizeCustomData(el.customData);

    const textParts: string[] = [];
    if (
      (rawType === "frame" || rawType === "magicframe") &&
      typeof el.name === "string" &&
      el.name.trim()
    ) {
      textParts.push(el.name.trim());
    }
    const linkedTexts = containerTextMap.get(rawId) ?? [];
    for (const txt of linkedTexts) {
      if (txt.trim()) textParts.push(txt.trim());
    }
    if (Array.isArray(el.boundElements)) {
      for (const bound of el.boundElements) {
        if (
          bound &&
          typeof bound === "object" &&
          (bound as Record<string, unknown>).type === "text" &&
          typeof (bound as Record<string, unknown>).id === "string"
        ) {
          const boundText = textByIdMap.get(
            (bound as Record<string, unknown>).id as string,
          );
          if (boundText && boundText.trim() && !textParts.includes(boundText.trim())) {
            textParts.push(boundText.trim());
          }
        }
      }
    }
    if (isUnboundText && typeof el.text === "string" && el.text.trim()) {
      textParts.push(el.text.trim());
    }

    const joinedText = textParts.join("\n").trim();
    const textLines = joinedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const titleLine = textLines[0] ?? "";
    const subtitleLine = textLines.slice(1).join(" · ");

    const { componentType, matchSource, ignoredTag } = resolveCatalogComponent(
      titleLine,
      joinedText,
      customData,
      componentNames,
      componentDescriptions,
      fallbackContentComponent,
    );

    if (ignoredTag !== null) {
      warnings.push(
        isDangerousKey(ignoredTag)
          ? `Shape "${rawId}": rejected dangerous catalogComponent tag; resolved by label to ${componentType}.`
          : `Shape "${rawId}": tag "${describeForWarning(ignoredTag)}" is not in the catalog; resolved by ${matchSource === "fallback" ? "fallback" : "label"} to ${componentType}.`,
      );
    } else if (matchSource === "fallback" && componentNames.length > 0) {
      warnings.push(
        titleLine
          ? `Shape "${rawId}": label "${describeForWarning(titleLine)}" matched no catalog component; fell back to ${componentType}.`
          : `Shape "${rawId}": unlabelled shape; fell back to ${componentType}. Add a label or a catalogComponent tag.`,
      );
    }

    const bbox = normalizeBoundingBox(el.x, el.y, el.width, el.height);
    const frameId =
      typeof el.frameId === "string" && el.frameId.length > 0 && el.frameId !== rawId
        ? el.frameId
        : null;

    const node: InternalVisualNode = {
      rawId,
      specKey,
      rawType,
      bbox,
      frameId,
      customData,
      rawText: joinedText,
      titleLine,
      subtitleLine,
      resolvedComponent: componentType,
      matchSource,
      isContainerCandidate:
        rawType === "frame" ||
        rawType === "magicframe" ||
        isLikelyContainerComponent(componentType, rootComponentName),
      parentSpecKey: null,
      childKeys: [],
    };

    visualNodes.push(node);
    rawIdToNode.set(rawId, node);
    specKeyToNode.set(specKey, node);
  }

  // Pass 3: Resolve safe parent-child hierarchy without forming cycles
  for (const node of visualNodes) {
    let chosenParent: InternalVisualNode | null = null;

    if (node.frameId) {
      const explicitFrame = rawIdToNode.get(node.frameId);
      if (
        explicitFrame &&
        explicitFrame.specKey !== node.specKey &&
        !wouldCreateParentCycle(node.specKey, explicitFrame.specKey, specKeyToNode)
      ) {
        chosenParent = explicitFrame;
      }
    }

    if (!chosenParent) {
      let bestParentArea = Number.POSITIVE_INFINITY;
      for (const candidate of visualNodes) {
        if (candidate.specKey === node.specKey) continue;
        if (!candidate.isContainerCandidate) continue;
        if (candidate.bbox.area <= node.bbox.area * 1.15) continue;
        if (computeContainmentRatio(node.bbox, candidate.bbox) < 0.75) continue;
        if (wouldCreateParentCycle(node.specKey, candidate.specKey, specKeyToNode)) {
          continue;
        }
        if (
          candidate.bbox.area < bestParentArea ||
          (candidate.bbox.area === bestParentArea &&
            compareVisualNodes(candidate, chosenParent ?? candidate) < 0)
        ) {
          bestParentArea = candidate.bbox.area;
          chosenParent = candidate;
        }
      }
    }

    if (chosenParent) {
      node.parentSpecKey = chosenParent.specKey;
      chosenParent.childKeys.push(node.specKey);
    }
  }

  // Pass 4: Sort top-level nodes & every parent's child list strictly by (y, x, id)
  const topLevelNodes = visualNodes
    .filter((n) => n.parentSpecKey === null)
    .sort(compareVisualNodes);

  for (const node of visualNodes) {
    if (node.childKeys.length > 1) {
      node.childKeys.sort((ka, kb) => {
        const na = specKeyToNode.get(ka);
        const nb = specKeyToNode.get(kb);
        if (!na || !nb) return compareCodePoints(ka, kb);
        return compareVisualNodes(na, nb);
      });
    }
  }

  // Pass 5: Build sanitized elements dictionary + determine root element
  const elements: Record<string, UIElement> = {};
  const state: Record<string, unknown> = {
    ...(options.baseSpec?.state ?? {}),
  };

  for (const node of visualNodes) {
    const baseProps = buildDefaultPropsForComponent(
      node.resolvedComponent,
      catalog,
      samplePropsByType,
    );

    const customDefaultProps =
      node.customData?.defaultProps &&
      typeof node.customData.defaultProps === "object" &&
      !Array.isArray(node.customData.defaultProps)
        ? sanitizeCustomData(node.customData.defaultProps)
        : null;

    const mergedProps: Record<string, unknown> = {
      ...baseProps,
      ...(customDefaultProps ?? {}),
    };

    const matchedTitleAsComponent =
      node.titleLine.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ===
      node.resolvedComponent.toLowerCase().replace(/[^a-z0-9]/g, "");

    const textPatchedProps = applyWireframeTextToProps(
      mergedProps,
      node.resolvedComponent,
      node.titleLine,
      node.subtitleLine,
      matchedTitleAsComponent,
    );

    elements[node.specKey] = {
      type: node.resolvedComponent,
      props: textPatchedProps,
      ...(node.childKeys.length > 0 ? { children: [...node.childKeys] } : {}),
    };
  }

  let rootKey: string;
  if (
    topLevelNodes.length === 1 &&
    topLevelNodes[0]!.resolvedComponent === rootComponentName
  ) {
    rootKey = topLevelNodes[0]!.specKey;
  } else {
    const preferredRootKey =
      options.baseSpec?.root && !isDangerousKey(options.baseSpec.root)
        ? options.baseSpec.root
        : "wireframe-root";
    rootKey = elements[preferredRootKey] ? "wireframe-shell-root" : preferredRootKey;
    const rootProps = buildDefaultPropsForComponent(
      rootComponentName,
      catalog,
      samplePropsByType,
    );
    elements[rootKey] = {
      type: rootComponentName,
      props: {
        ...rootProps,
        ...(typeof rootProps.badge === "string" ? { badge: "WIREFRAME ARCHITECT" } : {}),
      },
      children: topLevelNodes.map((n) => n.specKey),
    };
  }

  // Pass 6: Arrow state-binding synthesis (/wireframeBindings/<key>)
  const stateBindings: CompiledStateBinding[] = [];
  const wireframeBindingsState: Record<string, string> = {};
  let arrowCounter = 0;

  for (const el of activeElements) {
    if (el.type !== "arrow") continue;
    const startBinding =
      el.startBinding && typeof el.startBinding === "object"
        ? (el.startBinding as Record<string, unknown>)
        : null;
    const endBinding =
      el.endBinding && typeof el.endBinding === "object"
        ? (el.endBinding as Record<string, unknown>)
        : null;
    const startId =
      typeof startBinding?.elementId === "string" ? startBinding.elementId : "";
    const endId =
      typeof endBinding?.elementId === "string" ? endBinding.elementId : "";

    if (!startId || !endId || startId === endId) continue;

    const sourceNode = rawIdToNode.get(startId);
    const targetNode = rawIdToNode.get(endId);
    if (!sourceNode || !targetNode || sourceNode.specKey === targetNode.specKey) {
      continue;
    }

    arrowCounter += 1;
    const arrowId =
      typeof el.id === "string" && el.id.length > 0
        ? el.id
        : `arrow-${arrowCounter}`;

    let rawArrowLabel = "";
    if (typeof el.text === "string" && el.text.trim()) {
      rawArrowLabel = el.text.trim();
    } else if (Array.isArray(el.boundElements)) {
      for (const bound of el.boundElements) {
        if (
          bound &&
          typeof bound === "object" &&
          (bound as Record<string, unknown>).type === "text" &&
          typeof (bound as Record<string, unknown>).id === "string"
        ) {
          const found = textByIdMap.get(
            (bound as Record<string, unknown>).id as string,
          );
          if (found?.trim()) {
            rawArrowLabel = found.trim();
            break;
          }
        }
      }
    }

    const bindingSlug = sanitizeSafeIdentifier(
      rawArrowLabel || `${sourceNode.resolvedComponent}_to_${targetNode.resolvedComponent}_${arrowCounter}`,
      `link_${arrowCounter}`,
    );
    const pointerPath = `/wireframeBindings/${bindingSlug}`;
    if (!isSafeJsonPointer(pointerPath)) {
      continue;
    }

    const displayLabel =
      rawArrowLabel ||
      `Synced state: ${sourceNode.resolvedComponent} -> ${targetNode.resolvedComponent}`;
    wireframeBindingsState[bindingSlug] = displayLabel.slice(0, MAX_PROP_TEXT_LEN);

    const targetElement = elements[targetNode.specKey];
    let boundPropName: string | null = null;
    if (targetElement && rawArrowLabel) {
      const targetProps = (targetElement.props ?? {}) as Record<string, unknown>;
      const candidateProp = SUMMARY_PROP_PRIORITY.find(
        (key) => typeof targetProps[key] === "string",
      );
      if (candidateProp) {
        targetElement.props = {
          ...targetProps,
          [candidateProp]: { $state: pointerPath },
        };
        boundPropName = candidateProp;
      }
    }

    stateBindings.push({
      arrowId,
      sourceSpecKey: sourceNode.specKey,
      targetSpecKey: targetNode.specKey,
      pointerPath,
      label: displayLabel,
      boundPropName,
    });
  }

  if (Object.keys(wireframeBindingsState).length > 0) {
    state.wireframeBindings = {
      ...(typeof state.wireframeBindings === "object" &&
      state.wireframeBindings &&
      !Array.isArray(state.wireframeBindings)
        ? (state.wireframeBindings as Record<string, unknown>)
        : {}),
      ...wireframeBindingsState,
    };
  }

  // Pass 7: Enforce @genui-studio/core DAG safety & catalog Zod validation
  const rawSpec: Spec = {
    root: rootKey,
    elements,
    ...(Object.keys(state).length > 0 ? { state } : {}),
  };

  let finalSpec: Spec;
  let validationIssues: readonly GraphIssue[];
  let propDiagnostics: readonly PropDiagnostic[] = [];
  if (catalog) {
    const validated = catalog.validateFull(rawSpec, {
      maxDepth: 16,
      maxElements: 500,
      pruneMissingChildren: true,
    });
    finalSpec = validated.sanitizedSpec;
    validationIssues = validated.issues;
    propDiagnostics = validated.propDiagnostics.filter((d) => d.status !== "valid");
  } else {
    const sanitized = sanitizeSpecGraph(rawSpec, {
      maxDepth: 16,
      maxElements: 500,
      pruneMissingChildren: true,
    });
    finalSpec = sanitized.spec;
    validationIssues = sanitized.inspection.issues;
  }

  const orderedMappings: CompiledNodeMapping[] = topLevelNodes.length
    ? flattenMappingsPreOrder(visualNodes, topLevelNodes, specKeyToNode)
    : [];

  const rootResolvedType =
    finalSpec.elements[finalSpec.root]?.type ?? rootComponentName;

  return {
    spec: finalSpec,
    compiledNodeCount: visualNodes.length,
    stateBindings,
    resolvedMappings: orderedMappings,
    mermaidDiagram: buildMermaidArchitecture(
      orderedMappings,
      stateBindings,
      finalSpec.root,
      rootResolvedType,
    ),
    warnings,
    catalogHash: catalog?.metadata.catalogHash ?? null,
    validationIssues,
    propDiagnostics,
  };
}

function flattenMappingsPreOrder(
  allNodes: readonly InternalVisualNode[],
  topLevelNodes: readonly InternalVisualNode[],
  specKeyToNode: Map<string, InternalVisualNode>,
): CompiledNodeMapping[] {
  const result: CompiledNodeMapping[] = [];
  const visited = new Set<string>();

  const visit = (node: InternalVisualNode) => {
    if (visited.has(node.specKey)) return;
    visited.add(node.specKey);
    result.push({
      elementId: node.rawId,
      specKey: node.specKey,
      componentType: node.resolvedComponent,
      label: node.titleLine,
      bbox: {
        x: Math.round(node.bbox.minX),
        y: Math.round(node.bbox.minY),
        width: Math.round(node.bbox.width),
        height: Math.round(node.bbox.height),
      },
      parentSpecKey: node.parentSpecKey,
      matchSource: node.matchSource,
    });

    for (const childKey of node.childKeys) {
      const child = specKeyToNode.get(childKey);
      if (child) visit(child);
    }
  };

  for (const top of topLevelNodes) {
    visit(top);
  }
  for (const remaining of allNodes) {
    visit(remaining);
  }
  return result;
}

/**
 * Builds a fully-formed Excalidraw rectangle + bound text label pair (deterministic ids,
 * seeds and timestamps). Shared by the catalog library, the template starter scene and
 * the sample wireframe.
 */
export function createSkeletonRectAndText(options: {
  idPrefix: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  strokeColor: string;
  backgroundColor: string;
  customData: Record<string, unknown>;
  indexBase: number;
}): readonly NonDeleted<ExcalidrawElement>[] {
  const rectId = `${options.idPrefix}-rect`;
  const textId = `${options.idPrefix}-text`;

  const rect: NonDeleted<ExcalidrawRectangleElement> = {
    id: rectId,
    type: "rectangle",
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    angle: 0 as ExcalidrawRectangleElement["angle"],
    strokeColor: options.strokeColor,
    backgroundColor: options.backgroundColor,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roundness: { type: 3 },
    roughness: 1,
    opacity: 100,
    seed: options.indexBase + 11,
    version: 1,
    versionNonce: options.indexBase + 101,
    index: `a${options.indexBase}` as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [{ id: textId, type: "text" }],
    updated: 1_760_000_000_000,
    link: null,
    locked: false,
    customData: options.customData,
  };

  const textEl: NonDeleted<ExcalidrawTextElement> = {
    id: textId,
    type: "text",
    x: options.x + 16,
    y: options.y + 18,
    width: Math.max(80, options.width - 32),
    height: 44,
    angle: 0 as ExcalidrawTextElement["angle"],
    strokeColor: "#0b1221",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: options.indexBase + 29,
    version: 1,
    versionNonce: options.indexBase + 209,
    index: `a${options.indexBase}z` as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1_760_000_000_000,
    link: null,
    locked: false,
    fontSize: 16,
    fontFamily: 1,
    text: options.label,
    originalText: options.label,
    textAlign: "left",
    verticalAlign: "middle",
    containerId: rectId,
    autoResize: true,
    lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
  };

  return [rect, textEl];
}

/**
 * Generates an Excalidraw Shape Library (`libraryItems`) directly from the active
 * template's @genui-studio/core Zod catalog, storing component name & schema-valid default
 * props inside each block's `customData`.
 */
export function catalogToExcalidrawLibrary(
  catalog: VerifiedCatalog<any, any>,
  options: {
    readonly baseSpec?: Spec | null;
    readonly slug?: string;
  } = {},
): CatalogLibraryBuildResult {
  const { componentNames, componentDescriptions, catalogHash } = catalog.metadata;
  const slug = sanitizeSafeIdentifier(options.slug ?? "template", "template");
  const samplePropsByType = collectSamplePropsByComponent(options.baseSpec);
  const libraryItems: LibraryItem[] = [];
  const componentSummaries: {
    name: string;
    description: string;
    isContainer: boolean;
  }[] = [];

  componentNames.forEach((componentName, idx) => {
    const description =
      componentDescriptions[componentName] ?? `${componentName} UI section`;
    const isContainer = CONTAINER_NAME_PATTERN.test(componentName);
    const defaultProps = buildDefaultPropsForComponent(
      componentName,
      catalog,
      samplePropsByType,
    );

    const shortDesc = description.slice(0, 46);
    const elements = createSkeletonRectAndText({
      idPrefix: `lib-${slug}-${componentName}`,
      x: 0,
      y: 0,
      width: isContainer ? 440 : DEFAULT_CANVAS_WIDTH,
      height: isContainer ? 200 : DEFAULT_CANVAS_HEIGHT,
      label: `${componentName}\n${shortDesc}`,
      strokeColor: "#0b1221",
      backgroundColor: isContainer ? "#f8fafc" : "#ffffff",
      customData: {
        genuiComponent: componentName,
        catalogComponent: componentName,
        catalogHash,
        defaultProps,
      },
      indexBase: idx + 1,
    });

    libraryItems.push({
      id: `genui-lib-${slug}-${componentName}`,
      status: "published",
      name: componentName,
      created: 1_760_000_000_000 + idx,
      elements,
    });

    componentSummaries.push({
      name: componentName,
      description,
      isContainer,
    });
  });

  return {
    libraryItems,
    componentSummaries,
  };
}

/**
 * Converts an active template Spec (`baseSpec`) into an editable starter Excalidraw scene
 * so users opening Wireframe Architect immediately manipulate real catalog nodes + arrows.
 */
export function specToInitialExcalidrawElements(
  spec: Spec | null | undefined,
  catalog?: VerifiedCatalog<any, any>,
): readonly NonDeleted<ExcalidrawElement>[] {
  if (!spec?.root || !spec.elements?.[spec.root]) {
    const fallbackNames = catalog?.metadata.componentNames ?? [
      "HeroSection",
      "MetricStrip",
      "FeatureGrid",
    ];
    const items = fallbackNames.filter((n) => !CONTAINER_NAME_PATTERN.test(n)).slice(0, 3);
    const nodes = (items.length > 0 ? items : ["HeroSection"]).flatMap((name, idx) =>
      createSkeletonRectAndText({
        idPrefix: `seed-${name}-${idx}`,
        x: 100,
        y: 80 + idx * 140,
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
        label: name,
        strokeColor: "#0b1221",
        backgroundColor: "#ffffff",
        customData: { genuiComponent: name, catalogComponent: name },
        indexBase: idx + 1,
      }),
    );
    return nodes;
  }

  const rootEl = spec.elements[spec.root]!;
  const childKeys = Array.isArray(rootEl.children) ? rootEl.children : [];
  const nodesToRender =
    childKeys.length > 0
      ? childKeys
          .map((key) => ({ key, el: spec.elements[key] }))
          .filter(
            (entry): entry is { key: string; el: UIElement } => Boolean(entry.el),
          )
      : [{ key: spec.root, el: rootEl }];

  const result: NonDeleted<ExcalidrawElement>[] = [];
  const startX = 120;
  const startY = 120;
  const gapY = 140;

  // Enclosing frame representing root container
  const frameHeight = Math.max(260, nodesToRender.length * gapY + 90);
  const frameEl: NonDeleted<ExcalidrawFrameElement> = {
    id: `frame-${sanitizeSafeIdentifier(spec.root, "root")}`,
    type: "frame",
    name: rootEl.type,
    x: 70,
    y: 50,
    width: DEFAULT_CANVAS_WIDTH + 100,
    height: frameHeight,
    angle: 0 as ExcalidrawFrameElement["angle"],
    strokeColor: "#0b1221",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 11,
    index: "a0" as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1_760_000_000_000,
    link: null,
    locked: false,
    customData: {
      genuiComponent: rootEl.type,
      catalogComponent: rootEl.type,
      defaultProps: rootEl.props ?? {},
    },
  };
  result.push(frameEl);

  const createdRectIds: string[] = [];
  nodesToRender.slice(0, 12).forEach(({ key, el }, idx) => {
    const props = (el.props ?? {}) as Record<string, unknown>;
    const previewTitle = HEADLINE_PROP_PRIORITY.map((k) => props[k]).find(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    const label = previewTitle
      ? `${el.type}\n${previewTitle.slice(0, 44)}`
      : el.type;

    const pair = createSkeletonRectAndText({
      idPrefix: `seed-${sanitizeSafeIdentifier(key, `el-${idx}`)}`,
      x: startX,
      y: startY + idx * gapY,
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
      label,
      strokeColor: "#0b1221",
      backgroundColor: "#ffffff",
      customData: {
        genuiComponent: el.type,
        catalogComponent: el.type,
        defaultProps: props,
      },
      indexBase: idx + 2,
    });

    const tagged = pair.map((item) => ({
      ...item,
      frameId: frameEl.id,
    })) as NonDeleted<ExcalidrawElement>[];
    if (tagged[0]) {
      createdRectIds.push(tagged[0].id);
    }
    result.push(...tagged);
  });

  // Add an illustrative state binding arrow between the first two sections when >= 2 exist
  if (createdRectIds.length >= 2) {
    const firstId = createdRectIds[0]!;
    const secondId = createdRectIds[1]!;
    const arrowId = "seed-binding-arrow-1";
    const arrow: NonDeleted<ExcalidrawArrowElement> = {
      id: arrowId,
      type: "arrow",
      x: startX + DEFAULT_CANVAS_WIDTH + 12,
      y: startY + DEFAULT_CANVAS_HEIGHT / 2,
      width: 24,
      height: gapY,
      angle: 0 as ExcalidrawArrowElement["angle"],
      strokeColor: "#2563eb",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "dashed",
      roundness: { type: 2 },
      roughness: 1,
      opacity: 100,
      seed: 777,
      version: 1,
      versionNonce: 888,
      index: "z0" as FractionalIndex,
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: 1_760_000_000_000,
      link: null,
      locked: false,
      points: [
        [0, 0] as ExcalidrawArrowElement["points"][number],
        [0, gapY] as ExcalidrawArrowElement["points"][number],
      ],
      lastCommittedPoint: null,
      startBinding: { elementId: firstId, focus: 0, gap: 6 },
      endBinding: { elementId: secondId, focus: 0, gap: 6 },
      startArrowhead: null,
      endArrowhead: "arrow",
      elbowed: false,
    };
    result.push(arrow);
  }

  return result;
}

/**
 * Generates bidirectional Kiro spec artifacts (`.excalidraw.json` + Mermaid architecture
 * section for `.kiro/specs/<slug>/design.md`) from the active Wireframe Architect scene.
 */
export function exportExcalidrawToKiroArtifacts(input: {
  readonly elements: readonly unknown[];
  readonly compileResult: ExcalidrawCompileResult;
  readonly slug: string;
  readonly title: string;
}): KiroWireframeExport {
  const safeSlug = sanitizeSafeIdentifier(input.slug, "template");
  const filteredElements = Array.isArray(input.elements)
    ? input.elements.filter(
        (el): el is Record<string, unknown> =>
          Boolean(el) &&
          typeof el === "object" &&
          !Array.isArray(el) &&
          (el as Record<string, unknown>).isDeleted !== true,
      )
    : [];

  const excalidrawEnvelope = {
    type: "excalidraw",
    version: 2,
    source: "https://genui-studio.dev",
    elements: filteredElements,
    appState: {
      gridSize: 20,
      viewBackgroundColor: "#0f172a",
    },
    files: {},
  };

  const rows = input.compileResult.resolvedMappings.map(
    (m) =>
      `| \`${m.specKey}\` | \`${m.componentType}\` | \`(${m.bbox.x}, ${m.bbox.y})\` | ${m.parentSpecKey ? `\`${m.parentSpecKey}\`` : "root"} |`,
  );

  const bindingRows = input.compileResult.stateBindings.map(
    (b) =>
      `| \`${b.pointerPath}\` | \`${b.sourceSpecKey}\` -> \`${b.targetSpecKey}\` | ${b.boundPropName ? `\`${b.boundPropName}\`` : "state store"} |`,
  );

  const designMdSection = [
    `## Wireframe Architect Layout — ${input.title} (\`${safeSlug}\`)`,
    "",
    `- **Compiled Root:** \`${input.compileResult.spec.root}\``,
    `- **Compiled Components:** ${input.compileResult.compiledNodeCount}`,
    `- **Catalog Fingerprint:** \`${input.compileResult.catalogHash ?? "unbounded"}\``,
    `- **Excalidraw Source:** \`${safeSlug}.excalidraw.json\``,
    "",
    "### Visual Component & State-Binding Graph",
    "",
    "```mermaid",
    input.compileResult.mermaidDiagram,
    "```",
    "",
    "### Spatial-to-Catalog Traceability",
    "",
    "| Spec Key | Catalog Component | Canvas `(x, y)` | Parent |",
    "| :--- | :--- | :--- | :--- |",
    ...(rows.length > 0
      ? rows
      : ["| `wireframe-root` | `Root` | `(0, 0)` | root |"]),
    ...(bindingRows.length > 0
      ? [
          "",
          "### Arrow State Pointer Bindings",
          "",
          "| RFC 6901 Pointer | Flow | Target Binding |",
          "| :--- | :--- | :--- |",
          ...bindingRows,
        ]
      : []),
    "",
  ].join("\n");

  return {
    filenameExcalidraw: `${safeSlug}.excalidraw.json`,
    excalidrawJson: JSON.stringify(excalidrawEnvelope, null, 2),
    filenameDesignMd: `.kiro/specs/${safeSlug}/design.md`,
    mermaidDiagram: input.compileResult.mermaidDiagram,
    designMdSection,
  };
}
