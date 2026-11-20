import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawTextElement,
  FractionalIndex,
  NonDeleted,
} from "@excalidraw/excalidraw/element/types";
import { createSkeletonRectAndText } from "./excalidraw-compiler.js";

export {
  SAMPLE_WIREFRAME_FALLBACK_SLUG,
  SAMPLE_WIREFRAME_QUERY,
  SAMPLE_WIREFRAME_SLUG,
} from "./workbench-entry.js";

const UPDATED_AT = 1_760_000_000_000;
const FRAME_ID = "sample-frame-shell";
const ARROW_ID = "sample-arrow-plan";
const ARROW_LABEL_ID = "sample-arrow-plan-label";

/**
 * Deterministic sample sketch for the workbench. It exercises every compiler path the
 * diagnostics strip reports on:
 *
 * - `SiteShell` frame containing three blocks (containment / `frameId` hierarchy)
 * - `HeroSection` resolved from its text label (no tag)
 * - `MetricStrip` resolved from an explicit tag, carrying an out-of-range
 *   `uptimePercent: 140` that the catalog clamps to `100` (healed prop diagnostic)
 * - a block tagged `PricingTable`, which is not in the catalog: the tag is ignored with a
 *   warning and the label decides the component
 * - a labelled arrow `selectedPlan` that becomes `/wireframeBindings/selectedPlan`
 *   bound to the hero's summary prop
 */
export function buildSampleWireframeElements(): readonly NonDeleted<ExcalidrawElement>[] {
  const frame: NonDeleted<ExcalidrawFrameElement> = {
    id: FRAME_ID,
    type: "frame",
    name: "SiteShell",
    x: 60,
    y: 40,
    width: 540,
    height: 560,
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
    updated: UPDATED_AT,
    link: null,
    locked: false,
    customData: { catalogComponent: "SiteShell" },
  };

  const inFrame = (
    elements: readonly NonDeleted<ExcalidrawElement>[],
  ): NonDeleted<ExcalidrawElement>[] =>
    elements.map((el) => ({ ...el, frameId: FRAME_ID }) as NonDeleted<ExcalidrawElement>);

  const hero = inFrame(
    createSkeletonRectAndText({
      idPrefix: "sample-hero",
      x: 100,
      y: 100,
      width: 440,
      height: 120,
      label: "HeroSection\nTurn a sketch into a live UI",
      strokeColor: "#0b1221",
      backgroundColor: "#ffffff",
      customData: {},
      indexBase: 1,
    }),
  );

  const metrics = inFrame(
    createSkeletonRectAndText({
      idPrefix: "sample-metrics",
      x: 100,
      y: 260,
      width: 440,
      height: 110,
      label: "Weekly KPI telemetry\nuptime is set to 140% on purpose",
      strokeColor: "#0b1221",
      backgroundColor: "#ffffff",
      customData: {
        catalogComponent: "MetricStrip",
        defaultProps: { uptimePercent: 140 },
      },
      indexBase: 2,
    }),
  );

  const pricing = inFrame(
    createSkeletonRectAndText({
      idPrefix: "sample-pricing",
      x: 100,
      y: 410,
      width: 440,
      height: 120,
      label: "Pricing feature grid\nThree plan tiers",
      strokeColor: "#b45309",
      backgroundColor: "#fffbeb",
      customData: { catalogComponent: "PricingTable" },
      indexBase: 3,
    }),
  );

  const heroRectId = hero[0]!.id;
  const pricingRectId = pricing[0]!.id;
  const arrowX = 556;
  const arrowStartY = 470;
  const arrowEndY = 160;

  const arrow: NonDeleted<ExcalidrawArrowElement> = {
    id: ARROW_ID,
    type: "arrow",
    x: arrowX,
    y: arrowStartY,
    width: 0,
    height: arrowStartY - arrowEndY,
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
    index: "a8" as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [{ id: ARROW_LABEL_ID, type: "text" }],
    updated: UPDATED_AT,
    link: null,
    locked: false,
    points: [
      [0, 0] as ExcalidrawArrowElement["points"][number],
      [0, arrowEndY - arrowStartY] as ExcalidrawArrowElement["points"][number],
    ],
    lastCommittedPoint: null,
    startBinding: { elementId: pricingRectId, focus: 0, gap: 6 },
    endBinding: { elementId: heroRectId, focus: 0, gap: 6 },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  };

  const arrowLabel: NonDeleted<ExcalidrawTextElement> = {
    id: ARROW_LABEL_ID,
    type: "text",
    x: arrowX - 48,
    y: (arrowStartY + arrowEndY) / 2 - 10,
    width: 96,
    height: 20,
    angle: 0 as ExcalidrawTextElement["angle"],
    strokeColor: "#2563eb",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: 779,
    version: 1,
    versionNonce: 889,
    index: "a9" as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: UPDATED_AT,
    link: null,
    locked: false,
    fontSize: 14,
    fontFamily: 1,
    text: "selectedPlan",
    originalText: "selectedPlan",
    textAlign: "center",
    verticalAlign: "middle",
    containerId: ARROW_ID,
    autoResize: true,
    lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
  };

  return [frame, ...hero, ...metrics, ...pricing, arrow, arrowLabel];
}

/**
 * Second deterministic wireframe preset demonstrating Skeleton Crew versatility:
 * a SaaS Telemetry Dashboard built on the exact same verified catalog (`SiteShell`,
 * `MetricStrip`, `HeroSection`, `FeatureGrid`) with KPI metrics at the top and a live
 * `/wireframeBindings/activeRegion` state arrow.
 */
export function buildDashboardSampleWireframeElements(): readonly NonDeleted<ExcalidrawElement>[] {
  const dashFrameId = "dash-frame-shell";
  const dashArrowId = "dash-arrow-region";
  const dashArrowLabelId = "dash-arrow-region-label";

  const frame: NonDeleted<ExcalidrawFrameElement> = {
    id: dashFrameId,
    type: "frame",
    name: "SiteShell",
    x: 60,
    y: 40,
    width: 560,
    height: 560,
    angle: 0 as ExcalidrawFrameElement["angle"],
    strokeColor: "#0b1221",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: 201,
    version: 1,
    versionNonce: 211,
    index: "b0" as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: UPDATED_AT,
    link: null,
    locked: false,
    customData: { catalogComponent: "SiteShell" },
  };

  const inFrame = (
    elements: readonly NonDeleted<ExcalidrawElement>[],
  ): NonDeleted<ExcalidrawElement>[] =>
    elements.map((el) => ({ ...el, frameId: dashFrameId }) as NonDeleted<ExcalidrawElement>);

  const kpiTop = inFrame(
    createSkeletonRectAndText({
      idPrefix: "dash-kpis",
      x: 100,
      y: 96,
      width: 460,
      height: 112,
      label: "Revenue & API Telemetry\nLive SaaS workspace metrics",
      strokeColor: "#0b1221",
      backgroundColor: "#ffffff",
      customData: {
        catalogComponent: "MetricStrip",
        defaultProps: { uptimePercent: 99.95 },
      },
      indexBase: 11,
    }),
  );

  const summaryBanner = inFrame(
    createSkeletonRectAndText({
      idPrefix: "dash-summary",
      x: 100,
      y: 244,
      width: 460,
      height: 116,
      label: "HeroSection\nSaaS Operations Overview",
      strokeColor: "#0b1221",
      backgroundColor: "#ffffff",
      customData: { catalogComponent: "HeroSection" },
      indexBase: 12,
    }),
  );

  const services = inFrame(
    createSkeletonRectAndText({
      idPrefix: "dash-services",
      x: 100,
      y: 396,
      width: 460,
      height: 124,
      label: "FeatureGrid\nActive Workspace Modules",
      strokeColor: "#0b1221",
      backgroundColor: "#ffffff",
      customData: {
        catalogComponent: "FeatureGrid",
        defaultProps: { columns: 3 },
      },
      indexBase: 13,
    }),
  );

  const kpiRectId = kpiTop[0]!.id;
  const summaryRectId = summaryBanner[0]!.id;
  const arrowX = 576;
  const arrowStartY = 152;
  const arrowEndY = 302;

  const arrow: NonDeleted<ExcalidrawArrowElement> = {
    id: dashArrowId,
    type: "arrow",
    x: arrowX,
    y: arrowStartY,
    width: 0,
    height: arrowEndY - arrowStartY,
    angle: 0 as ExcalidrawArrowElement["angle"],
    strokeColor: "#2563eb",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roundness: { type: 2 },
    roughness: 1,
    opacity: 100,
    seed: 901,
    version: 1,
    versionNonce: 911,
    index: "b8" as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [{ id: dashArrowLabelId, type: "text" }],
    updated: UPDATED_AT,
    link: null,
    locked: false,
    points: [
      [0, 0] as ExcalidrawArrowElement["points"][number],
      [0, arrowEndY - arrowStartY] as ExcalidrawArrowElement["points"][number],
    ],
    lastCommittedPoint: null,
    startBinding: { elementId: kpiRectId, focus: 0, gap: 6 },
    endBinding: { elementId: summaryRectId, focus: 0, gap: 6 },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  };

  const arrowLabel: NonDeleted<ExcalidrawTextElement> = {
    id: dashArrowLabelId,
    type: "text",
    x: arrowX - 48,
    y: (arrowStartY + arrowEndY) / 2 - 10,
    width: 96,
    height: 20,
    angle: 0 as ExcalidrawTextElement["angle"],
    strokeColor: "#2563eb",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: 902,
    version: 1,
    versionNonce: 912,
    index: "b9" as FractionalIndex,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: UPDATED_AT,
    link: null,
    locked: false,
    fontSize: 14,
    fontFamily: 1,
    text: "activeRegion",
    originalText: "activeRegion",
    textAlign: "center",
    verticalAlign: "middle",
    containerId: dashArrowId,
    autoResize: true,
    lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
  };

  return [frame, ...kpiTop, ...summaryBanner, ...services, arrow, arrowLabel];
}
