import type { DualModeTemplateEntry } from "../types.js";
import {
  TEMPLATE_KIRO_POWER_MD,
  TEMPLATE_MANIFEST,
  TEMPLATE_SKILL_MD,
  TEMPLATE_SOURCE_FILES,
  TEMPLATE_STEERING_MD,
  TEMPLATE_THEME_CSS,
} from "./bundle.generated.js";
import {
  buildChaosPackets,
  buildRemixJsonl,
  initialPageSpecs,
  verifiedCatalog,
} from "./catalog.js";
import { templateComponents } from "./components/index.js";

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

export default templateEntry;

export * from "./store.js";
export * from "./lib/archive/types.js";
export * from "./lib/archive/api.js";
export { ARCHIVE_ENTRIES } from "./content/entries.js";
export { CATEGORIES } from "./content/categories.js";
export { TIMELINE_MILESTONES } from "./content/timeline-events.js";
export {
  ARCHIVAL_PHOTOS,
  ENTRY_PHOTOS,
  HIGHLIGHT_PHOTOS,
  SECTOR_PHOTOS,
  ArchivalPhotoSchema,
  type ArchivalPhotoRecord,
} from "./content/photos.js";
