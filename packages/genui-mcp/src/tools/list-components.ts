import {
  BUILTIN_CATALOGS,
  BUILTIN_CATALOG_DEFINITIONS,
  type AppCatalogKey,
} from "../catalogs/index.js";
import { describeZodSchema } from "../schema-describer.js";

export interface ListCatalogComponentsInput {
  app?: "spatial" | "all";
  componentName?: string;
}

export interface ComponentInspectionReport {
  name: string;
  app: "spatial";
  description: string;
  slots: readonly string[];
  propsSchema: Record<string, unknown>;
  hasFallbackProps: boolean;
  fallbackProps?: Record<string, unknown>;
}

export interface ActionInspectionReport {
  name: string;
  app: "spatial";
  description: string;
  paramsSchema: Record<string, unknown>;
}

export interface ListCatalogComponentsResult {
  target: "spatial" | "all";
  totalComponents: number;
  totalActions: number;
  catalogs: Array<{
    app: "spatial";
    catalogHash: string;
    componentCount: number;
    actionCount: number;
  }>;
  components: ComponentInspectionReport[];
  actions: ActionInspectionReport[];
  summary: string;
}

export function handleListCatalogComponents(
  input: ListCatalogComponentsInput = {},
): ListCatalogComponentsResult {
  const target = input.app ?? "all";
  const filterComponentName = input.componentName?.trim();

  const appKeys: AppCatalogKey[] =
    target === "all" ? ["spatial"] : [target];

  const components: ComponentInspectionReport[] = [];
  const actions: ActionInspectionReport[] = [];
  const catalogsSummary: ListCatalogComponentsResult["catalogs"] = [];

  for (const appKey of appKeys) {
    const verifiedCat = BUILTIN_CATALOGS[appKey];
    const defs = BUILTIN_CATALOG_DEFINITIONS[appKey];

    catalogsSummary.push({
      app: appKey,
      catalogHash: verifiedCat.metadata.catalogHash,
      componentCount: verifiedCat.metadata.componentNames.length,
      actionCount: verifiedCat.metadata.actionNames.length,
    });

    // Inspect components
    for (const name of verifiedCat.metadata.componentNames) {
      if (filterComponentName && name.toLowerCase() !== filterComponentName.toLowerCase()) {
        continue;
      }

      const compDef = (defs.components as Record<string, any>)[name];
      const zodSchema = verifiedCat.getComponentZodSchema(name);
      const propsSchema = describeZodSchema(zodSchema);

      components.push({
        name,
        app: appKey,
        description:
          verifiedCat.metadata.componentDescriptions[name] ??
          compDef?.description ??
          "",
        slots: compDef?.slots ?? [],
        propsSchema,
        hasFallbackProps: Boolean(compDef?.fallbackProps),
        fallbackProps: compDef?.fallbackProps,
      });
    }

    // Inspect actions
    for (const actionName of verifiedCat.metadata.actionNames) {
      const actionDef = (defs.actions as Record<string, any>)[actionName];
      const paramsSchema = actionDef?.params
        ? describeZodSchema(actionDef.params)
        : { type: "object", properties: {} };

      actions.push({
        name: actionName,
        app: appKey,
        description: actionDef?.description ?? "",
        paramsSchema,
      });
    }
  }

  const summary = `Found ${components.length} component(s) and ${actions.length} action(s) across catalog(s): [${appKeys.join(
    ", ",
  )}]. All components declare strict Zod prop contracts and deterministic fallbackProps.`;

  return {
    target,
    totalComponents: components.length,
    totalActions: actions.length,
    catalogs: catalogsSummary,
    components,
    actions,
    summary,
  };
}
