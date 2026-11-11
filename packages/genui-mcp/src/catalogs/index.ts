import {
  finopsCatalogDefinitions,
  finopsVerifiedCatalog,
} from "./finops-catalog.js";
import {
  spatialCatalogDefinitions,
  spatialVerifiedCatalog,
} from "./spatial-catalog.js";
import type { VerifiedCatalog } from "@genui-studio/core";

export {
  finopsCatalogDefinitions,
  finopsVerifiedCatalog,
  spatialCatalogDefinitions,
  spatialVerifiedCatalog,
};

export type AppCatalogKey = "finops" | "spatial";

export const BUILTIN_CATALOGS: Record<AppCatalogKey, VerifiedCatalog<any, any>> = {
  finops: finopsVerifiedCatalog,
  spatial: spatialVerifiedCatalog,
};

export const BUILTIN_CATALOG_DEFINITIONS = {
  finops: finopsCatalogDefinitions,
  spatial: spatialCatalogDefinitions,
} as const;

export function getVerifiedCatalog(app: AppCatalogKey): VerifiedCatalog<any, any> {
  const cat = BUILTIN_CATALOGS[app];
  if (!cat) {
    throw new Error(
      `Unknown catalog app "${app}". Expected "finops" or "spatial".`,
    );
  }
  return cat;
}
