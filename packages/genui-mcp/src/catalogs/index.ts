import {
  spatialCatalogDefinitions,
  spatialVerifiedCatalog,
} from "./spatial-catalog.js";
import type { VerifiedCatalog } from "@genui-studio/core";

export {
  spatialCatalogDefinitions,
  spatialVerifiedCatalog,
};

export type AppCatalogKey = "spatial";

export const BUILTIN_CATALOGS: Record<AppCatalogKey, VerifiedCatalog<any, any>> = {
  spatial: spatialVerifiedCatalog,
};

export const BUILTIN_CATALOG_DEFINITIONS = {
  spatial: spatialCatalogDefinitions,
} as const;

export function getVerifiedCatalog(app: AppCatalogKey = "spatial"): VerifiedCatalog<any, any> {
  const cat = BUILTIN_CATALOGS[app];
  if (!cat) {
    throw new Error(
      `Unknown catalog app "${app}". Expected "spatial".`,
    );
  }
  return cat;
}
