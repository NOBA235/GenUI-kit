import {
  defineCatalog,
  type Catalog,
  type InferCatalogInput,
  type PromptOptions,
  type Schema,
  type SchemaDefinition,
  type Spec,
} from "@json-render/core";
import { z } from "zod";
import {
  isDangerousKey,
  isSafeJsonPointer,
  sanitizeSpecGraph,
} from "../stream/dag-sanitizer.js";
import type {
  CatalogAuditReport,
  CatalogContractMetadata,
  GraphIssue,
  PropDiagnostic,
  SanitizeGraphOptions,
  VerifiedCatalog,
} from "../types.js";

const DYNAMIC_EXPRESSION_KEYS = new Set([
  "$state",
  "$bindState",
  "$bindItem",
  "$cond",
  "$item",
  "$index",
  "$template",
  "$computed",
]);

/**
 * Checks if a raw prop value is a @json-render dynamic prop expression.
 */
export function isDynamicPropExpression(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (DYNAMIC_EXPRESSION_KEYS.has(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that a dynamic prop expression has safe, well-formed pointer syntax.
 */
export function isValidDynamicExpression(expr: Record<string, unknown>): {
  valid: boolean;
  healedExpr?: Record<string, unknown>;
  reason?: string;
} {
  if (typeof expr.$state === "string") {
    if (!isSafeJsonPointer(expr.$state)) {
      const candidate = expr.$state.startsWith("/")
        ? expr.$state
        : `/${expr.$state}`;
      if (isSafeJsonPointer(candidate)) {
        return {
          valid: true,
          healedExpr: { ...expr, $state: candidate },
          reason: `Normalized $state pointer "${expr.$state}" to "${candidate}".`,
        };
      }
      return {
        valid: false,
        reason: `Unsafe or invalid $state pointer "${expr.$state}".`,
      };
    }
    return { valid: true };
  }

  if (typeof expr.$bindState === "string") {
    if (!isSafeJsonPointer(expr.$bindState)) {
      const candidate = expr.$bindState.startsWith("/")
        ? expr.$bindState
        : `/${expr.$bindState}`;
      if (isSafeJsonPointer(candidate)) {
        return {
          valid: true,
          healedExpr: { ...expr, $bindState: candidate },
          reason: `Normalized $bindState pointer "${expr.$bindState}" to "${candidate}".`,
        };
      }
      return {
        valid: false,
        reason: `Unsafe or invalid $bindState pointer "${expr.$bindState}".`,
      };
    }
    return { valid: true };
  }

  if (typeof expr.$bindItem === "string") {
    if (isDangerousKey(expr.$bindItem)) {
      return {
        valid: false,
        reason: `Blocked prototype pollution key in $bindItem.`,
      };
    }
    return { valid: true };
  }

  if (typeof expr.$item === "string") {
    if (isDangerousKey(expr.$item)) {
      return {
        valid: false,
        reason: `Blocked prototype pollution key in $item.`,
      };
    }
    return { valid: true };
  }

  if (expr.$index === true) {
    return { valid: true };
  }

  if (typeof expr.$template === "string") {
    return { valid: true };
  }

  if (typeof expr.$computed === "string") {
    return { valid: true };
  }

  if (expr.$cond !== undefined && "$then" in expr && "$else" in expr) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: "Malformed dynamic prop expression structure.",
  };
}

/**
 * Recursively serializes any JSON-compatible value with lexicographically sorted keys
 * so that key insertion order never causes hash or prompt drift.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      return "0";
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const entries = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify(record[k])}`,
  );
  return `{${entries.join(",")}}`;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * Computes a genuine synchronous FIPS 180-4 SHA-256 digest (64 lowercase hex chars)
 * over UTF-8 bytes so contract fingerprints match standard SHA-256 identically
 * across Node, Vitest, Edge runtimes, and Browsers with zero async overhead.
 */
export function computeDeterministicHash(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const byteLen = bytes.length;
  const totalLen = Math.ceil((byteLen + 9) / 64) * 64;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[byteLen] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLenHi = Math.floor((byteLen * 8) / 0x100000000);
  const bitLenLo = (byteLen * 8) >>> 0;
  view.setUint32(totalLen - 8, bitLenHi, false);
  view.setUint32(totalLen - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

/**
 * Returns a new z.ZodObject with its `.shape` keys sorted lexicographically,
 * ensuring `catalog.prompt()` and `catalog.jsonSchema()` always iterate properties
 * in a 100% deterministic order regardless of how the developer wrote the schema.
 */
function canonicalizeZodSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  const zodObj = schema as {
    shape?: Record<string, z.ZodType>;
    _zod?: unknown;
  };
  if (zodObj.shape && typeof zodObj.shape === "object") {
    const sortedShape: Record<string, z.ZodType> = {};
    const keys = Object.keys(zodObj.shape).sort((a, b) => a.localeCompare(b));
    for (const k of keys) {
      sortedShape[k] = zodObj.shape[k]!;
    }
    return z.object(sortedShape);
  }
  return schema;
}

/**
 * Canonically sorts all component definitions, prop schemas, slots, events,
 * and action definitions so that any permutation of keys produces the exact
 * same catalog instance, prompt, and hash.
 */
function canonicalizeCatalogConfig<TCatalog>(rawCatalog: TCatalog): TCatalog {
  if (!rawCatalog || typeof rawCatalog !== "object") {
    return rawCatalog;
  }
  const source = rawCatalog as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };

  if (source.components && typeof source.components === "object") {
    const comps = source.components as Record<string, Record<string, unknown>>;
    const sortedCompNames = Object.keys(comps).sort((a, b) =>
      a.localeCompare(b),
    );
    const nextComps: Record<string, Record<string, unknown>> = {};
    for (const name of sortedCompNames) {
      const def = comps[name];
      if (!def || typeof def !== "object") continue;
      const nextDef: Record<string, unknown> = {
        ...def,
        props: canonicalizeZodSchema(def.props),
      };
      if (Array.isArray(def.slots)) {
        nextDef.slots = [...def.slots].sort((a, b) =>
          String(a).localeCompare(String(b)),
        );
      }
      if (Array.isArray(def.events)) {
        nextDef.events = [...def.events].sort((a, b) =>
          String(a).localeCompare(String(b)),
        );
      }
      nextComps[name] = nextDef;
    }
    result.components = nextComps;
  }

  if (source.actions && typeof source.actions === "object") {
    const acts = source.actions as Record<string, Record<string, unknown>>;
    const sortedActNames = Object.keys(acts).sort((a, b) => a.localeCompare(b));
    const nextActs: Record<string, Record<string, unknown>> = {};
    for (const name of sortedActNames) {
      const actDef = acts[name];
      if (!actDef || typeof actDef !== "object") continue;
      nextActs[name] = {
        ...actDef,
        ...(actDef.params
          ? { params: canonicalizeZodSchema(actDef.params) }
          : {}),
      };
    }
    result.actions = nextActs;
  }

  return result as TCatalog;
}

/**
 * Inspects a Zod field schema to attempt deterministic coercion / clamping
 * when an LLM emits a slightly malformed prop value (e.g. string "42" for number,
 * NaN/Infinity, out-of-range number, undefined for nullable, or invalid enum).
 */
function attemptHealFieldValue(
  fieldSchema: z.ZodType,
  rawValue: unknown,
): { healed: boolean; value: unknown; reason: string } {
  // 1. Direct parse check first
  const direct = fieldSchema.safeParse(rawValue);
  if (direct.success) {
    // Check if -0 was passed for a number
    if (typeof rawValue === "number" && Object.is(rawValue, -0)) {
      return {
        healed: true,
        value: 0,
        reason: "Normalized negative zero (-0) to 0.",
      };
    }
    return { healed: false, value: direct.data, reason: "Valid" };
  }

  // 2. If rawValue is undefined and null is accepted by the schema (e.g. z.string().nullable())
  if (rawValue === undefined) {
    const nullTry = fieldSchema.safeParse(null);
    if (nullTry.success) {
      return {
        healed: true,
        value: null,
        reason: "Coerced missing/undefined prop to null for nullable schema.",
      };
    }
  }

  // 3. If rawValue is null and empty string or 0 is accepted
  if (rawValue === null) {
    for (const fallback of ["", 0, false, []]) {
      const res = fieldSchema.safeParse(fallback);
      if (res.success) {
        return {
          healed: true,
          value: res.data,
          reason: `Coerced null to default ${JSON.stringify(fallback)}.`,
        };
      }
    }
  }

  // 4. Non-finite number healing (NaN, Infinity, -Infinity) or numeric string coercion ("42.5" -> 42.5)
  if (typeof rawValue === "number" && !Number.isFinite(rawValue)) {
    for (const candidate of [0, 1, null]) {
      const res = fieldSchema.safeParse(candidate);
      if (res.success) {
        return {
          healed: true,
          value: res.data,
          reason: `Healed non-finite number (${String(rawValue)}) to ${String(candidate)}.`,
        };
      }
    }
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
      const numVal = Number(trimmed);
      const numTry = fieldSchema.safeParse(numVal);
      if (numTry.success) {
        return {
          healed: true,
          value: numTry.data,
          reason: `Coerced numeric string "${rawValue}" to number ${numVal}.`,
        };
      }
      // If out-of-bounds number in string form, fall through to numeric clamping below
    }
    if (trimmed.toLowerCase() === "true" || trimmed.toLowerCase() === "false") {
      const boolVal = trimmed.toLowerCase() === "true";
      const boolTry = fieldSchema.safeParse(boolVal);
      if (boolTry.success) {
        return {
          healed: true,
          value: boolTry.data,
          reason: `Coerced boolean string "${rawValue}" to ${String(boolVal)}.`,
        };
      }
    }
  }

  // 5. Out-of-bounds number clamping using Zod issues (too_small / too_big)
  const numericCandidate =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string" &&
          rawValue.trim() !== "" &&
          !Number.isNaN(Number(rawValue))
        ? Number(rawValue)
        : null;

  if (numericCandidate !== null && Number.isFinite(numericCandidate)) {
    const parseAttempt = fieldSchema.safeParse(numericCandidate);
    if (!parseAttempt.success) {
      for (const issue of parseAttempt.error.issues) {
        const issueAny = issue as unknown as Record<string, unknown>;
        if (
          issue.code === "too_small" &&
          typeof issueAny.minimum === "number"
        ) {
          const minVal = issueAny.minimum;
          const clampedTry = fieldSchema.safeParse(minVal);
          if (clampedTry.success) {
            return {
              healed: true,
              value: clampedTry.data,
              reason: `Clamped out-of-bounds number ${numericCandidate} to minimum ${minVal}.`,
            };
          }
        }
        if (issue.code === "too_big" && typeof issueAny.maximum === "number") {
          const maxVal = issueAny.maximum;
          const clampedTry = fieldSchema.safeParse(maxVal);
          if (clampedTry.success) {
            return {
              healed: true,
              value: clampedTry.data,
              reason: `Clamped out-of-bounds number ${numericCandidate} to maximum ${maxVal}.`,
            };
          }
        }
      }
    }
  }

  // 6. Number/Boolean passed where z.string() is expected
  if (typeof rawValue === "number" || typeof rawValue === "boolean") {
    const strTry = fieldSchema.safeParse(String(rawValue));
    if (strTry.success) {
      return {
        healed: true,
        value: strTry.data,
        reason: `Coerced ${typeof rawValue} (${String(rawValue)}) to string.`,
      };
    }
  }

  // 7. Invalid enum value -> check if schema (or innerType if wrapped in nullable/optional) has enum options
  let unwrapped: unknown = fieldSchema;
  while (
    unwrapped &&
    typeof unwrapped === "object" &&
    ((unwrapped as { def?: { innerType?: unknown } }).def?.innerType !==
      undefined)
  ) {
    unwrapped = (unwrapped as { def: { innerType: unknown } }).def.innerType;
  }
  const enumOptions = Array.isArray((unwrapped as { options?: unknown[] })?.options)
    ? ((unwrapped as { options: unknown[] }).options)
    : undefined;

  if (enumOptions && enumOptions.length > 0) {
    // 7a. Semantic match first: case-insensitive / separator-normalized match (helps smaller LLMs)
    if (typeof rawValue === "string") {
      const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");
      const rawNorm = norm(rawValue);
      const semanticMatch =
        enumOptions.find(
          (opt) =>
            typeof opt === "string" &&
            opt.toLowerCase() === rawValue.trim().toLowerCase(),
        ) ??
        enumOptions.find(
          (opt) => typeof opt === "string" && norm(opt) === rawNorm,
        );
      if (semanticMatch !== undefined) {
        const matchedTry = fieldSchema.safeParse(semanticMatch);
        if (matchedTry.success) {
          return {
            healed: true,
            value: matchedTry.data,
            reason: `Normalized enum casing/formatting ${JSON.stringify(rawValue)} to "${String(semanticMatch)}".`,
          };
        }
      }
    }

    const fallbackEnum = enumOptions[0];
    const enumTry = fieldSchema.safeParse(fallbackEnum);
    if (enumTry.success) {
      return {
        healed: true,
        value: enumTry.data,
        reason: `Healed invalid enum value ${JSON.stringify(rawValue)} to fallback "${String(fallbackEnum)}".`,
      };
    }
  }

  return {
    healed: false,
    value: rawValue,
    reason:
      direct.error.issues[0]?.message ??
      "Value failed catalog Zod schema validation.",
  };
}

/**
 * Creates a VerifiedCatalog with deterministic hashing, key-order-invariant system prompt
 * compilation, and prop validation/healing.
 */
export function createVerifiedCatalog<
  TDef extends SchemaDefinition,
  TCatalog extends InferCatalogInput<TDef["catalog"]>,
>(
  schema: Schema<TDef>,
  catalogData: TCatalog,
  options?: { createdAt?: string },
): VerifiedCatalog<TDef, TCatalog> {
  const canonicalData = canonicalizeCatalogConfig(catalogData);
  const catalog: Catalog<TDef, TCatalog> = defineCatalog(schema, canonicalData);

  const componentNames = [...catalog.componentNames].sort((a, b) =>
    a.localeCompare(b),
  );
  const actionNames = [...catalog.actionNames].sort((a, b) =>
    a.localeCompare(b),
  );
  const builtInActionNames = (schema.builtInActions ?? [])
    .map((a) => a.name)
    .sort((a, b) => a.localeCompare(b));

  const rawComps =
    (canonicalData as unknown as {
      components?: Record<
        string,
        { props?: z.ZodType; description?: string }
      >;
    }).components ?? {};

  const componentDescriptions: Record<string, string> = {};
  for (const name of componentNames) {
    componentDescriptions[name] = rawComps[name]?.description ?? "";
  }

  // Deterministic prompt and JSON schema representation for hashing
  const basePromptText = catalog.prompt({ mode: "standalone" });
  const hashPayload = canonicalStringify({
    componentNames,
    actionNames,
    builtInActionNames,
    componentDescriptions,
    basePromptText,
  });
  const catalogHash = computeDeterministicHash(hashPayload);

  const metadata: CatalogContractMetadata = {
    catalogHash,
    componentNames,
    actionNames,
    builtInActionNames,
    componentDescriptions,
    createdAt: options?.createdAt ?? "2026-01-01T00:00:00.000Z",
  };

  function getComponentZodSchema(componentName: string): z.ZodType | undefined {
    return rawComps[componentName]?.props;
  }

  function validateAndHealProps(
    elementKey: string,
    componentName: string,
    rawProps: Record<string, unknown>,
  ): {
    readonly ok: boolean;
    readonly props: Record<string, unknown>;
    readonly diagnostics: readonly PropDiagnostic[];
    readonly healedCount: number;
    readonly rejectedCount: number;
  } {
    const compSchema = getComponentZodSchema(componentName);
    if (!compSchema) {
      return {
        ok: false,
        props: rawProps,
        diagnostics: [
          {
            elementKey,
            componentType: componentName,
            propName: "$component",
            status: "rejected",
            originalValue: componentName,
            resolvedValue: null,
            reason: `Component "${componentName}" is not registered in the catalog.`,
          },
        ],
        healedCount: 0,
        rejectedCount: 1,
      };
    }

    const safeInputProps =
      rawProps && typeof rawProps === "object" && !Array.isArray(rawProps)
        ? rawProps
        : {};

    const shape = (
      compSchema as unknown as { shape?: Record<string, z.ZodType> }
    ).shape;

    if (!shape || typeof shape !== "object") {
      const parsed = compSchema.safeParse(safeInputProps);
      return {
        ok: parsed.success,
        props: parsed.success
          ? (parsed.data as Record<string, unknown>)
          : safeInputProps,
        diagnostics: parsed.success
          ? []
          : [
              {
                elementKey,
                componentType: componentName,
                propName: "$root",
                status: "rejected",
                originalValue: safeInputProps,
                resolvedValue: safeInputProps,
                reason:
                  parsed.error.issues[0]?.message ?? "Invalid component props.",
              },
            ],
        healedCount: 0,
        rejectedCount: parsed.success ? 0 : 1,
      };
    }

    const nextProps: Record<string, unknown> = {};
    const diagnostics: PropDiagnostic[] = [];
    let healedCount = 0;
    let rejectedCount = 0;

    // Preserve extra keys that are safe (or only validate shape keys)
    const shapeKeys = Object.keys(shape).sort((a, b) => a.localeCompare(b));
    for (const propName of shapeKeys) {
      const fieldSchema = shape[propName]!;
      const rawVal = safeInputProps[propName];

      // Check if rawVal is a dynamic expression ($state, $bindState, etc.)
      if (isDynamicPropExpression(rawVal)) {
        const exprCheck = isValidDynamicExpression(rawVal);
        if (exprCheck.valid) {
          if (exprCheck.healedExpr) {
            nextProps[propName] = exprCheck.healedExpr;
            healedCount += 1;
            diagnostics.push({
              elementKey,
              componentType: componentName,
              propName,
              status: "healed",
              originalValue: rawVal,
              resolvedValue: exprCheck.healedExpr,
              reason: exprCheck.reason ?? "Healed dynamic expression pointer.",
            });
          } else {
            nextProps[propName] = rawVal;
          }
          continue;
        } else {
          rejectedCount += 1;
          diagnostics.push({
            elementKey,
            componentType: componentName,
            propName,
            status: "rejected",
            originalValue: rawVal,
            resolvedValue: null,
            reason: exprCheck.reason ?? "Invalid dynamic expression.",
          });
          continue;
        }
      }

      // Check unsafe URI in string props before Zod check
      if (
        typeof rawVal === "string" &&
        /^\s*(javascript|vbscript|data\s*:\s*text\/html)\s*:/i.test(rawVal)
      ) {
        nextProps[propName] = "#blocked-unsafe-uri";
        healedCount += 1;
        diagnostics.push({
          elementKey,
          componentType: componentName,
          propName,
          status: "healed",
          originalValue: rawVal,
          resolvedValue: "#blocked-unsafe-uri",
          reason: "Neutralized unsafe URI scheme in prop.",
        });
        continue;
      }

      const healResult = attemptHealFieldValue(fieldSchema, rawVal);
      if (healResult.healed) {
        nextProps[propName] = healResult.value;
        healedCount += 1;
        diagnostics.push({
          elementKey,
          componentType: componentName,
          propName,
          status: "healed",
          originalValue: rawVal,
          resolvedValue: healResult.value,
          reason: healResult.reason,
        });
      } else {
        // Verify if valid
        const checkValid = fieldSchema.safeParse(healResult.value);
        if (checkValid.success) {
          nextProps[propName] = checkValid.data;
        } else {
          rejectedCount += 1;
          nextProps[propName] = rawVal;
          diagnostics.push({
            elementKey,
            componentType: componentName,
            propName,
            status: "rejected",
            originalValue: rawVal,
            resolvedValue: rawVal,
            reason: healResult.reason,
          });
        }
      }
    }

    return {
      ok: rejectedCount === 0,
      props: nextProps,
      diagnostics,
      healedCount,
      rejectedCount,
    };
  }

  return {
    catalog,
    metadata,

    prompt(options?: PromptOptions): string {
      const normalizedOptions: PromptOptions | undefined = options
        ? {
            ...options,
            ...(options.customRules
              ? {
                  customRules: [...options.customRules].sort((a, b) =>
                    a.localeCompare(b),
                  ),
                }
              : {}),
          }
        : undefined;

      const corePrompt = catalog.prompt(normalizedOptions);
      const invariantFooter = [
        "",
        "## GenUI Studio Structural & Safety Invariants",
        `- Catalog Contract Fingerprint: \`${catalogHash}\``,
        `- Permitted Components (${componentNames.length}): ${componentNames.join(", ")}`,
        `- Permitted Custom Actions (${actionNames.length}): ${actionNames.length > 0 ? actionNames.join(", ") : "none"}`,
        `- Built-In Actions: ${builtInActionNames.join(", ")}`,
        "- DAG Topology Rule: Element `children` and `slots` MUST form a strict Directed Acyclic Graph (no cycles, no self-loops, no duplicate sibling keys).",
        "- RFC 6901 Pointer Rule: All `$state`, `$bindState`, and `watch` paths MUST begin with `/` and never reference `__proto__`, `constructor`, or `prototype`.",
        "- No Raw Code Rule: Never emit raw JSX, HTML tags, or `javascript:` URIs inside prop values.",
      ].join("\n");

      return `${corePrompt}\n${invariantFooter}`;
    },

    getComponentZodSchema,

    validateAndHealProps,

    validateFull(
      spec: unknown,
      options?: SanitizeGraphOptions,
    ): {
      readonly valid: boolean;
      readonly sanitizedSpec: Spec;
      readonly issues: readonly GraphIssue[];
      readonly propDiagnostics: readonly PropDiagnostic[];
    } {
      const sanitized = sanitizeSpecGraph(spec, {
        ...options,
        allowedComponents: componentNames,
      });

      const propDiagnostics: PropDiagnostic[] = [];
      const extraIssues: GraphIssue[] = [];

      for (const [elKey, el] of Object.entries(sanitized.spec.elements)) {
        const res = validateAndHealProps(
          elKey,
          el.type,
          (el.props ?? {}) as Record<string, unknown>,
        );
        el.props = res.props;
        propDiagnostics.push(...res.diagnostics);
        if (!res.ok) {
          for (const d of res.diagnostics) {
            if (d.status === "rejected") {
              extraIssues.push({
                severity: "error",
                code: "unknown_component",
                message: `Element "${elKey}" (${el.type}.${d.propName}): ${d.reason}`,
                elementKey: elKey,
              });
            }
          }
        }
      }

      const allIssues = [...sanitized.inspection.issues, ...extraIssues];
      const hasFatalError = allIssues.some(
        (i) =>
          i.severity === "error" &&
          i.code !== "cyclic_reference" &&
          i.code !== "depth_limit_exceeded" &&
          i.code !== "element_budget_exceeded",
      );

      return {
        valid: !hasFatalError && !sanitized.inspection.hasCycles,
        sanitizedSpec: sanitized.spec,
        issues: allIssues,
        propDiagnostics,
      };
    },
  };
}

/**
 * Audits 1:1 parity between a VerifiedCatalog and a concrete ComponentRegistry + action handlers map.
 */
export function auditCatalogRegistryParity<
  TDef extends SchemaDefinition,
  TCatalog,
>(
  verifiedCatalog: VerifiedCatalog<TDef, TCatalog>,
  registryComponents: Record<string, unknown>,
  registryActions: Record<string, unknown> = {},
): CatalogAuditReport {
  const expectedComponents = verifiedCatalog.metadata.componentNames;
  const providedComponents = Object.keys(registryComponents).sort((a, b) =>
    a.localeCompare(b),
  );

  const missingComponents = expectedComponents.filter(
    (name) => typeof registryComponents[name] !== "function",
  );
  const extraComponents = providedComponents.filter(
    (name) => !expectedComponents.includes(name),
  );
  const missingDescriptions = expectedComponents.filter((name) => {
    const desc = verifiedCatalog.metadata.componentDescriptions[name];
    return !desc || desc.trim().length === 0;
  });

  const expectedActions = verifiedCatalog.metadata.actionNames;
  const missingActions = expectedActions.filter(
    (name) => typeof registryActions[name] !== "function",
  );

  const issues: string[] = [];
  if (missingComponents.length > 0) {
    issues.push(
      `Missing component implementations in registry: ${missingComponents.join(", ")}`,
    );
  }
  if (extraComponents.length > 0) {
    issues.push(
      `Unregistered extra components in registry (not in catalog): ${extraComponents.join(", ")}`,
    );
  }
  if (missingDescriptions.length > 0) {
    issues.push(
      `Catalog components missing non-empty AI descriptions: ${missingDescriptions.join(", ")}`,
    );
  }
  if (missingActions.length > 0) {
    issues.push(
      `Missing custom action handlers in registry: ${missingActions.join(", ")}`,
    );
  }

  return {
    synchronized: issues.length === 0,
    catalogHash: verifiedCatalog.metadata.catalogHash,
    missingComponents,
    extraComponents,
    missingDescriptions,
    missingActions,
    issues,
  };
}
