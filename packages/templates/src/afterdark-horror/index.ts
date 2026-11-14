import type { DualModeTemplateEntry } from "../types.js";
import {
  buildChaosPackets,
  buildRemixJsonl,
  initialPageSpecs,
  verifiedCatalog,
} from "./catalog.js";
import { templateComponents } from "./components/index.js";
import {
  TEMPLATE_KIRO_POWER_MD,
  TEMPLATE_MANIFEST,
  TEMPLATE_SKILL_MD,
  TEMPLATE_SOURCE_FILES,
  TEMPLATE_STEERING_MD,
  TEMPLATE_THEME_CSS,
} from "./bundle.generated.js";

export const templateEntry: DualModeTemplateEntry = {
  manifest: TEMPLATE_MANIFEST,
  catalog: verifiedCatalog,
  registry: templateComponents,
  pageSpecs: initialPageSpecs,
  themeCss: TEMPLATE_THEME_CSS,
  steeringMd: TEMPLATE_STEERING_MD,
  skillMd: TEMPLATE_SKILL_MD,
  kiroPowerMd: TEMPLATE_KIRO_POWER_MD,
  sourceFiles: TEMPLATE_SOURCE_FILES,
  buildRemixJsonl,
  buildChaosPackets,
};

export * from "./types.js";
export * from "./store.js";
export * from "./engine/collision.js";
export * from "./engine/world-data.js";
export * from "./engine/procedural-geometries.js";
export * from "./audio/soundscape.js";
export default templateEntry;
