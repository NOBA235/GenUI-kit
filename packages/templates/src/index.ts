export {
  MARKETPLACE_FILTER_TAGS,
  type DualModeTemplateEntry,
  type MarketplaceFilterTag,
  type ScopedThemeContainerOptions,
  type StandaloneProjectMeta,
  type TemplateFileKind,
  type TemplateManifest,
  type TemplateMode,
  type TemplatePageDefinition,
  type TemplateRegistryFilter,
  type TemplateRemixPreset,
  type TemplateSourceFile,
  type TemplateThemeConfig,
} from "./types.js";

export {
  StandaloneProjectMetaSchema,
  TemplateManifestSchema,
  TemplatePageSchema,
  TemplateRemixPresetSchema,
  TemplateThemeSchema,
  validateTemplateSlug,
} from "./schema.js";

export {
  generateStarterThemeCss,
  scopeTemplateCss,
} from "./css-isolation.js";

export {
  BASE_NEXTJS_SHELL_FILES,
  mapFilesRecordToSourceFiles,
  mergeTemplateWithNextjsShell,
  type MergedShellOptions,
} from "./base-shell.js";

export {
  buildTemplateCliCommand,
  exportTemplateToShadcnRegistry,
  generateTemplateZip,
  templateToAgentReadyPack,
} from "./exporter.js";

export {
  SHOWCASE_PACK_TEMPLATES,
  showcasePreviewCatalog,
} from "./showcase-adapters.js";

export {
  clearRuntimeTemplates,
  getAllTemplates,
  getTemplateBySlug,
  getTemplateCounts,
  handleDualModeRegistryRequest,
  listTemplates,
  registerRuntimeTemplate,
} from "./registry.js";

export { useAfterdarkStore } from "./afterdark-horror/store.js";
