import type { Spec, UIElement } from "@json-render/core";
import type {
  CreativeBrief,
  InteractionEffect,
  InteractionRule,
  VerifiedCatalog,
} from "@genui-studio/core";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawTextElement,
  FractionalIndex,
  NonDeleted,
} from "@excalidraw/excalidraw/element/types";
import { createSkeletonRectAndText } from "./excalidraw-compiler.js";

const DETERMINISTIC_UPDATED_AT = 1_760_000_000_000;
const BLOCK_WIDTH = 380;
const BLOCK_HEIGHT = 112;
const BLOCK_GAP_Y = 36;
const FRAME_PADDING_X = 48;
const FRAME_PADDING_TOP = 64;
const FRAME_PADDING_BOTTOM = 44;

const HEADLINE_FIELDS = [
  "headline",
  "title",
  "heading",
  "sectionTitle",
  "brandName",
  "eyebrow",
  "label",
  "name",
] as const;

export interface SpecToExcalidrawOptions {
  readonly spec: Spec;
  readonly rules?: readonly InteractionRule[];
  readonly brief?: CreativeBrief | null;
  readonly catalog?: VerifiedCatalog<any, any>;
}

export interface ExcalidrawExportDocument {
  readonly type: "excalidraw";
  readonly version: 2;
  readonly source: "https://genui-studio.dev";
  readonly elements: readonly NonDeleted<ExcalidrawElement>[];
  readonly appState: {
    readonly gridSize: number;
    readonly viewBackgroundColor: string;
  };
  readonly files: Readonly<Record<string, never>>;
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sanitizeIdPart(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);
  return cleaned || fallback;
}

function collectOrderedReachableNodes(spec: Spec): readonly {
  readonly key: string;
  readonly element: UIElement;
  readonly depth: number;
}[] {
  const ordered: { key: string; element: UIElement; depth: number }[] = [];
  if (!spec.root || !spec.elements?.[spec.root]) {
    const keys = Object.keys(spec.elements ?? {}).sort(compareCodePoints);
    for (const key of keys) {
      const el = spec.elements[key];
      if (el) ordered.push({ key, element: el, depth: 0 });
    }
    return ordered;
  }

  const visited = new Set<string>();
  const visit = (key: string, depth: number) => {
    if (visited.has(key) || ordered.length >= 48) return;
    const el = spec.elements[key];
    if (!el) return;
    visited.add(key);
    ordered.push({ key, element: el, depth });

    const childKeys: string[] = [];
    if (Array.isArray(el.children)) {
      for (const c of el.children) {
        if (typeof c === "string") childKeys.push(c);
      }
    }
    if (el.slots && typeof el.slots === "object" && !Array.isArray(el.slots)) {
      const slotNames = Object.keys(el.slots).sort(compareCodePoints);
      for (const slotName of slotNames) {
        const slotList = el.slots[slotName];
        if (Array.isArray(slotList)) {
          for (const c of slotList) {
            if (typeof c === "string") childKeys.push(c);
          }
        }
      }
    }
    for (const childKey of childKeys) {
      visit(childKey, depth + 1);
    }
  };

  visit(spec.root, 0);
  return ordered;
}

function summarizeElementLabel(
  key: string,
  el: UIElement,
  sourceSection?: string,
): string {
  const props = (el.props ?? {}) as Record<string, unknown>;
  const headline = HEADLINE_FIELDS.map((field) => props[field]).find(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  const line2 = headline
    ? headline.trim().slice(0, 48)
    : sourceSection
      ? `[${sourceSection.slice(0, 42)}]`
      : key;
  return `${el.type}\n${line2}`;
}

function extractReferencedStatePointers(el: UIElement): readonly string[] {
  const pointers = new Set<string>();
  const walk = (value: unknown, depth: number) => {
    if (depth > 5 || value === null || value === undefined || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const rec = value as Record<string, unknown>;
    if (typeof rec.$state === "string" && rec.$state.startsWith("/")) {
      pointers.add(rec.$state);
      return;
    }
    for (const child of Object.values(rec)) {
      walk(child, depth + 1);
    }
  };
  walk(el.props, 0);
  return [...pointers].sort(compareCodePoints);
}

function formatRuleArrowLabel(rule: InteractionRule): string {
  const primaryEffect: InteractionEffect | undefined = rule.effects[0];
  let effectPart = rule.label;
  if (primaryEffect) {
    switch (primaryEffect.type) {
      case "set":
      case "inc":
      case "dec":
      case "toggle":
      case "append":
      case "remove":
        effectPart = `${primaryEffect.type} ${primaryEffect.path}`;
        break;
      case "setOutcome":
        effectPart = `outcome=${primaryEffect.outcome}`;
        break;
      case "navigateScene":
        effectPart = `scene:${primaryEffect.sceneId}`;
        break;
      case "emitEvent":
        effectPart = `emit:${primaryEffect.eventName}`;
        break;
      case "playSynthSound":
        effectPart = `sfx:${primaryEffect.cue}`;
        break;
      case "resetExperience":
        effectPart = "reset";
        break;
    }
  }
  return `${rule.trigger.type} -> ${effectPart}`.slice(0, 44);
}

interface RectAnchor {
  readonly rectId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function createLabelledArrow(options: {
  readonly id: string;
  readonly label: string;
  readonly start: RectAnchor;
  readonly end: RectAnchor;
  readonly laneOffset: number;
  readonly indexNum: number;
  readonly strokeColor: string;
  readonly customData?: Record<string, unknown>;
}): readonly [NonDeleted<ExcalidrawArrowElement>, NonDeleted<ExcalidrawTextElement>] {
  const labelId = `${options.id}-label`;
  const arrowX =
    Math.max(options.start.x + options.start.width, options.end.x + options.end.width) +
    24 +
    options.laneOffset * 34;
  const startY = options.start.y + options.start.height / 2;
  const endY = options.end.y + options.end.height / 2;
  const dy = endY - startY;

  const arrow: NonDeleted<ExcalidrawArrowElement> = {
    id: options.id,
    type: "arrow",
    x: arrowX,
    y: startY,
    width: 16,
    height: Math.abs(dy),
    angle: 0 as ExcalidrawArrowElement["angle"],
    strokeColor: options.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roundness: { type: 2 },
    roughness: 1,
    opacity: 100,
    seed: 700 + options.indexNum,
    version: 1,
    versionNonce: 1700 + options.indexNum,
    index: `z${options.indexNum}` as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [{ id: labelId, type: "text" }],
    updated: DETERMINISTIC_UPDATED_AT,
    link: null,
    locked: false,
    points: [
      [0, 0] as ExcalidrawArrowElement["points"][number],
      [0, dy] as ExcalidrawArrowElement["points"][number],
    ],
    lastCommittedPoint: null,
    startBinding: { elementId: options.start.rectId, focus: 0, gap: 6 },
    endBinding: { elementId: options.end.rectId, focus: 0, gap: 6 },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
    ...(options.customData ? { customData: options.customData } : {}),
  };

  const labelEl: NonDeleted<ExcalidrawTextElement> = {
    id: labelId,
    type: "text",
    x: arrowX + 8,
    y: (startY + endY) / 2 - 10,
    width: Math.max(88, options.label.length * 7),
    height: 20,
    angle: 0 as ExcalidrawTextElement["angle"],
    strokeColor: options.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: 900 + options.indexNum,
    version: 1,
    versionNonce: 1900 + options.indexNum,
    index: `z${options.indexNum}t` as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: DETERMINISTIC_UPDATED_AT,
    link: null,
    locked: false,
    fontSize: 13,
    fontFamily: 1,
    text: options.label,
    originalText: options.label,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: options.id,
    autoResize: true,
    lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
  };

  return [arrow, labelEl];
}

/**
 * Pure, deterministic one-way serializer turning a GenUI `Spec` + `InteractionRule[]`
 * into a valid Excalidraw v2 JSON scene for `.excalidraw.json` export and read-only view.
 *
 * Keeps `excalidraw-compiler.ts` completely untouched, synchronous, zero-network, and
 * zero-LLM, while guaranteeing clean round-tripping back through `compileExcalidrawToGenUI()`.
 */
export function specToExcalidrawScene(
  options: SpecToExcalidrawOptions,
): ExcalidrawExportDocument {
  const { spec, rules = [], brief = null, catalog } = options;
  const ordered = collectOrderedReachableNodes(spec);
  const rootEntry = ordered[0];
  const childEntries = ordered.length > 1 ? ordered.slice(1) : ordered;

  const rootKey = rootEntry?.key ?? spec.root ?? "wireframe-root";
  const rootType =
    rootEntry?.element.type ??
    catalog?.metadata.componentNames[0] ??
    "SiteShell";
  const rootProps = (rootEntry?.element.props ?? {}) as Record<string, unknown>;

  const frameX = 60;
  const frameY = 40;
  const frameWidth = BLOCK_WIDTH + FRAME_PADDING_X * 2;
  const contentCount = Math.max(1, childEntries.length);
  const frameHeight =
    FRAME_PADDING_TOP +
    contentCount * BLOCK_HEIGHT +
    Math.max(0, contentCount - 1) * BLOCK_GAP_Y +
    FRAME_PADDING_BOTTOM;

  const frameId = `exp-frame-${sanitizeIdPart(rootKey, "root")}`;
  const elements: NonDeleted<ExcalidrawElement>[] = [];

  const frameEl: NonDeleted<ExcalidrawFrameElement> = {
    id: frameId,
    type: "frame",
    name: rootType,
    x: frameX,
    y: frameY,
    width: frameWidth,
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
    updated: DETERMINISTIC_UPDATED_AT,
    link: null,
    locked: false,
    customData: {
      catalogComponent: rootType,
      genuiComponent: rootType,
      specKey: rootKey,
      defaultProps: rootProps,
      ...(catalog ? { catalogHash: catalog.metadata.catalogHash } : {}),
      ...(brief
        ? {
            briefTitle: brief.title,
            briefSlug: brief.slug,
            inputMode: brief.inputMode,
          }
        : {}),
      ruleCount: rules.length,
    },
  };
  elements.push(frameEl);

  const anchorsBySpecKey = new Map<string, RectAnchor>();
  const stateReadersByPointer = new Map<string, string[]>();

  childEntries.forEach((entry, idx) => {
    const x = frameX + FRAME_PADDING_X;
    const y = frameY + FRAME_PADDING_TOP + idx * (BLOCK_HEIGHT + BLOCK_GAP_Y);
    const sourceSection = brief?.elementSourceSections?.[entry.key];
    const idPrefix = `exp-${sanitizeIdPart(entry.key, `node-${idx + 1}`)}`;

    const pair = createSkeletonRectAndText({
      idPrefix,
      x,
      y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      label: summarizeElementLabel(entry.key, entry.element, sourceSection),
      strokeColor: "#0b1221",
      backgroundColor: "#ffffff",
      customData: {
        catalogComponent: entry.element.type,
        genuiComponent: entry.element.type,
        specKey: entry.key,
        defaultProps: (entry.element.props ?? {}) as Record<string, unknown>,
        ...(sourceSection ? { sourceSection } : {}),
      },
      indexBase: idx + 1,
    });

    const inFrame = pair.map((item) => ({
      ...item,
      frameId,
    })) as NonDeleted<ExcalidrawElement>[];
    elements.push(...inFrame);

    const rect = inFrame[0];
    if (rect) {
      anchorsBySpecKey.set(entry.key, {
        rectId: rect.id,
        x,
        y,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
      });
    }

    for (const ptr of extractReferencedStatePointers(entry.element)) {
      const readers = stateReadersByPointer.get(ptr) ?? [];
      readers.push(entry.key);
      stateReadersByPointer.set(ptr, readers);
    }
  });

  // Emit labelled arrows for InteractionRules connecting UI elements (e.g., onDrop or
  // element trigger -> element displaying mutated $state pointer)
  const emittedPairs = new Set<string>();
  let arrowIdx = 0;

  for (const rule of rules) {
    if (rule.enabled === false) continue;

    let sourceKey: string | null = null;
    let targetKey: string | null = null;

    if (rule.trigger.type === "onDrop") {
      sourceKey = rule.trigger.sourceElementKey ?? null;
      targetKey = rule.trigger.targetElementKey;
    } else if (
      rule.trigger.type === "onClick" ||
      rule.trigger.type === "onHover" ||
      rule.trigger.type === "onDragStart"
    ) {
      sourceKey = rule.trigger.elementKey;
      // Connect to a distinct UI block reading any state pointer mutated by this rule
      for (const eff of rule.effects) {
        if (
          eff.type === "set" ||
          eff.type === "inc" ||
          eff.type === "dec" ||
          eff.type === "toggle" ||
          eff.type === "append" ||
          eff.type === "remove"
        ) {
          const readers = stateReadersByPointer.get(eff.path) ?? [];
          const otherReader = readers.find((k) => k !== sourceKey);
          if (otherReader) {
            targetKey = otherReader;
            break;
          }
        }
      }
    }

    if (!sourceKey || !targetKey || sourceKey === targetKey) continue;
    const startAnchor = anchorsBySpecKey.get(sourceKey);
    const endAnchor = anchorsBySpecKey.get(targetKey);
    if (!startAnchor || !endAnchor) continue;

    const dedupeKey = `${sourceKey}->${targetKey}:${rule.id}`;
    if (emittedPairs.has(dedupeKey)) continue;
    emittedPairs.add(dedupeKey);

    arrowIdx += 1;
    const [arrowEl, labelEl] = createLabelledArrow({
      id: `exp-rule-arrow-${sanitizeIdPart(rule.id, `r${arrowIdx}`)}`,
      label: formatRuleArrowLabel(rule),
      start: startAnchor,
      end: endAnchor,
      laneOffset: arrowIdx - 1,
      indexNum: arrowIdx,
      strokeColor: "#2563eb",
      customData: {
        ruleId: rule.id,
        triggerType: rule.trigger.type,
        ...(rule.sourceSection ? { sourceSection: rule.sourceSection } : {}),
      },
    });
    elements.push(arrowEl, labelEl);
  }

  return {
    type: "excalidraw",
    version: 2,
    source: "https://genui-studio.dev",
    elements,
    appState: {
      gridSize: 20,
      viewBackgroundColor: "#0f172a",
    },
    files: {},
  };
}

/**
 * Convenience string serializer returning formatted Excalidraw v2 JSON.
 */
export function serializeSpecToExcalidrawJson(
  options: SpecToExcalidrawOptions,
): string {
  return JSON.stringify(specToExcalidrawScene(options), null, 2);
}
