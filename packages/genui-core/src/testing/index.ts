import * as fc from "fast-check";
import type { Spec, UIElement } from "@json-render/core";
import {
  createVerifiedCatalog,
  canonicalStringify,
} from "../catalog/verified-catalog.js";
import {
  inspectSpecGraph,
  sanitizeSpecGraph,
} from "../stream/dag-sanitizer.js";
import {
  createGuardrailedStreamCompiler,
  specToJsonlStream,
} from "../stream/stream-compiler.js";
import { createTimeTravelStateStore } from "../state/time-travel-store.js";
import type { VerifiedCatalog } from "../types.js";

/**
 * Normalizes -0 to +0 so generated valid specs have canonical numbers.
 */
function normalizeZero(n: number): number {
  return Object.is(n, -0) ? 0 : n;
}

/**
 * Converts any Zod v4 schema (`z.string()`, `z.number()`, `z.boolean()`, `z.enum()`,
 * `z.nullable()`, `z.optional()`, `z.union()`, `z.array()`, `z.object()`, etc.)
 * into a composable `fast-check` Arbitrary.
 */
export function zodTypeToArbitrary(
  zodSchema: unknown,
  depth = 0,
): fc.Arbitrary<unknown> {
  if (!zodSchema || typeof zodSchema !== "object" || depth > 5) {
    return fc.constant(null);
  }

  const schemaObj = zodSchema as {
    def?: {
      type?: string;
      innerType?: unknown;
      options?: unknown[];
      element?: unknown;
      entries?: Record<string, unknown>;
      values?: unknown[];
    };
    _zod?: {
      def?: {
        type?: string;
        innerType?: unknown;
        options?: unknown[];
        element?: unknown;
        entries?: Record<string, unknown>;
        values?: unknown[];
      };
    };
    shape?: Record<string, unknown>;
    options?: unknown[];
    minValue?: number | null;
    maxValue?: number | null;
  };

  const def = schemaObj.def ?? schemaObj._zod?.def ?? {};
  const typeName = def.type;

  switch (typeName) {
    case "string": {
      return fc.stringMatching(/^[a-zA-Z0-9 _.,:/-]{1,28}$/).filter(
        (s) => !/^\s*(javascript|vbscript|data)\s*:/i.test(s),
      );
    }

    case "number":
    case "int": {
      const rawMin =
        typeof schemaObj.minValue === "number" &&
        Number.isFinite(schemaObj.minValue)
          ? Math.ceil(schemaObj.minValue)
          : -1000;
      const rawMax =
        typeof schemaObj.maxValue === "number" &&
        Number.isFinite(schemaObj.maxValue)
          ? Math.floor(schemaObj.maxValue)
          : 1000;
      const min = Math.min(rawMin, rawMax);
      const max = Math.max(rawMin, rawMax);
      return fc.integer({ min, max }).map(normalizeZero);
    }

    case "boolean": {
      return fc.boolean();
    }

    case "null": {
      return fc.constant(null);
    }

    case "literal": {
      const vals = Array.isArray(def.values) ? def.values : [null];
      return fc.constantFrom(...vals);
    }

    case "enum": {
      const opts = Array.isArray(schemaObj.options)
        ? schemaObj.options
        : def.entries
          ? Object.values(def.entries)
          : ["default"];
      if (opts.length === 0) return fc.constant("default");
      return fc.constantFrom(...opts);
    }

    case "nullable": {
      const inner = zodTypeToArbitrary(def.innerType, depth + 1);
      return fc.oneof(
        { weight: 4, arbitrary: inner },
        { weight: 1, arbitrary: fc.constant(null) },
      );
    }

    case "optional":
    case "default": {
      return zodTypeToArbitrary(def.innerType, depth + 1);
    }

    case "union": {
      const unionOpts = Array.isArray(def.options) ? def.options : [];
      if (unionOpts.length === 0) return fc.constant(null);
      const arbitraries = unionOpts.map((opt) =>
        zodTypeToArbitrary(opt, depth + 1),
      );
      return fc.oneof(...arbitraries);
    }

    case "array": {
      const elemArb = zodTypeToArbitrary(def.element, depth + 1);
      return fc.array(elemArb, { minLength: 0, maxLength: 4 });
    }

    case "object": {
      const shape = schemaObj.shape;
      if (!shape || typeof shape !== "object") {
        return fc.constant({});
      }
      const recordModel: Record<string, fc.Arbitrary<unknown>> = {};
      for (const [k, fieldSchema] of Object.entries(shape)) {
        recordModel[k] = zodTypeToArbitrary(fieldSchema, depth + 1);
      }
      return fc.record(recordModel);
    }

    default: {
      if (schemaObj.shape && typeof schemaObj.shape === "object") {
        const recordModel: Record<string, fc.Arbitrary<unknown>> = {};
        for (const [k, fieldSchema] of Object.entries(schemaObj.shape)) {
          recordModel[k] = zodTypeToArbitrary(fieldSchema, depth + 1);
        }
        return fc.record(recordModel);
      }
      return fc.stringMatching(/^[a-zA-Z0-9_-]{1,16}$/);
    }
  }
}

/**
 * Generates a valid UIElement conforming to the specified component in a VerifiedCatalog.
 */
export function catalogToElementArbitrary(
  verifiedCatalog: VerifiedCatalog<any, any>,
  componentName?: string,
): fc.Arbitrary<UIElement> {
  const names = verifiedCatalog.metadata.componentNames;
  if (names.length === 0) {
    return fc.constant({
      type: "Empty",
      props: {},
      children: [],
    });
  }

  const chosenNames =
    componentName && names.includes(componentName) ? [componentName] : names;

  const elementArbitraries = chosenNames.map((name) => {
    const zodSchema = verifiedCatalog.getComponentZodSchema(name);
    const propsArb = zodTypeToArbitrary(zodSchema) as fc.Arbitrary<
      Record<string, unknown>
    >;
    return fc.record({
      type: fc.constant(name),
      props: propsArb,
      children: fc.constant([] as string[]),
    });
  });

  return fc.oneof(...elementArbitraries);
}

/**
 * Converts a VerifiedCatalog into a `fast-check` Arbitrary that generates complete,
 * multi-element, strictly acyclic DAG `Spec` trees with optional initial state.
 */
export function catalogToSpecArbitrary(
  verifiedCatalog: VerifiedCatalog<any, any>,
  options: { minElements?: number; maxElements?: number } = {},
): fc.Arbitrary<Spec> {
  const minElements = Math.max(1, options.minElements ?? 1);
  const maxElements = Math.max(minElements, options.maxElements ?? 8);

  return fc
    .tuple(
      fc.array(catalogToElementArbitrary(verifiedCatalog), {
        minLength: minElements,
        maxLength: maxElements,
      }),
      fc.array(fc.integer({ min: 0, max: 100 }), {
        minLength: 1,
        maxLength: maxElements,
      }),
      fc.dictionary(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,10}$/),
        fc.oneof(
          fc.stringMatching(/^[a-zA-Z0-9 _-]{1,16}$/),
          fc.integer({ min: 0, max: 500 }),
          fc.boolean(),
        ),
        { minKeys: 0, maxKeys: 4 },
      ),
    )
    .map(([rawElements, parentSelectors, stateDict]) => {
      const elements: Record<string, UIElement> = {};
      const keys = rawElements.map((_, idx) => `el-${idx}`);

      rawElements.forEach((el, idx) => {
        const key = keys[idx]!;
        elements[key] = {
          type: el.type,
          props: { ...el.props },
          children: [],
        };
      });

      // Connect each node i > 0 to a strictly earlier parent p < i so the topology is a strict tree (DAG)
      for (let i = 1; i < keys.length; i++) {
        const childKey = keys[i]!;
        const selector = parentSelectors[i % parentSelectors.length] ?? 0;
        const parentIdx = selector % i;
        const parentKey = keys[parentIdx]!;
        const parentEl = elements[parentKey]!;
        parentEl.children = [...(parentEl.children ?? []), childKey];
      }

      return {
        root: keys[0] ?? "el-0",
        elements,
        state: stateDict,
      };
    });
}

/**
 * Splits a string into arbitrary non-empty chunks using a `fast-check` generated cut-point array.
 */
export function splitStreamByCutPoints(
  stream: string,
  cutRatios: readonly number[],
): string[] {
  if (stream.length <= 1 || cutRatios.length === 0) {
    return [stream];
  }
  const indices = new Set<number>();
  for (const ratio of cutRatios) {
    const idx = Math.max(
      1,
      Math.min(stream.length - 1, Math.floor(ratio * stream.length)),
    );
    indices.add(idx);
  }
  const sortedCuts = [...indices].sort((a, b) => a - b);
  const chunks: string[] = [];
  let prev = 0;
  for (const cut of sortedCuts) {
    if (cut > prev) {
      chunks.push(stream.slice(prev, cut));
      prev = cut;
    }
  }
  if (prev < stream.length) {
    chunks.push(stream.slice(prev));
  }
  return chunks;
}

/**
 * Arbitrary generating adversarial, corrupted, or cyclic Spec payloads to stress-test Invariant 2.
 */
export function arbitraryAdversarialSpec(
  verifiedCatalog: VerifiedCatalog<any, any>,
): fc.Arbitrary<Record<string, unknown>> {
  return fc
    .tuple(
      catalogToSpecArbitrary(verifiedCatalog, { minElements: 2, maxElements: 6 }),
      fc.constantFrom(
        "self_cycle",
        "mutual_cycle",
        "slot_cycle",
        "duplicate_children",
        "diamond_aliasing",
        "non_finite_numbers",
        "unsafe_uri",
        "misplaced_directives_in_props",
        "unknown_component_and_dangling_child",
      ),
    )
    .map(([baseSpec, corruptionMode]) => {
      const cloned = structuredClone(baseSpec) as unknown as Record<
        string,
        unknown
      >;
      const elements = cloned.elements as Record<
        string,
        Record<string, unknown>
      >;
      const keys = Object.keys(elements);
      const firstKey = keys[0]!;
      const secondKey = keys[1] ?? firstKey;

      switch (corruptionMode) {
        case "self_cycle": {
          elements[firstKey]!.children = [firstKey];
          break;
        }
        case "mutual_cycle": {
          elements[firstKey]!.children = [secondKey];
          elements[secondKey]!.children = [firstKey];
          break;
        }
        case "slot_cycle": {
          elements[firstKey]!.slots = { header: [secondKey] };
          elements[secondKey]!.children = [firstKey];
          break;
        }
        case "duplicate_children": {
          elements[firstKey]!.children = [secondKey, secondKey, secondKey];
          break;
        }
        case "diamond_aliasing": {
          const thirdKey = "el-shared";
          elements[thirdKey] = {
            type: elements[firstKey]!.type,
            props: { ...((elements[firstKey]!.props as object) ?? {}) },
            children: [],
          };
          elements[firstKey]!.children = [secondKey, thirdKey];
          elements[secondKey]!.children = [thirdKey];
          break;
        }
        case "non_finite_numbers": {
          const props = (elements[firstKey]!.props ?? {}) as Record<
            string,
            unknown
          >;
          props.corruptedNaN = Number.NaN;
          props.corruptedInf = Number.POSITIVE_INFINITY;
          props.corruptedNegInf = Number.NEGATIVE_INFINITY;
          props.corruptedNegZero = -0;
          break;
        }
        case "unsafe_uri": {
          const props = (elements[firstKey]!.props ?? {}) as Record<
            string,
            unknown
          >;
          for (const k of Object.keys(props)) {
            if (typeof props[k] === "string") {
              props[k] = "javascript:alert(document.cookie)";
            }
          }
          props.href = "javascript:void(0)";
          break;
        }
        case "misplaced_directives_in_props": {
          const props = (elements[firstKey]!.props ?? {}) as Record<
            string,
            unknown
          >;
          props.visible = { $state: "/user/active" };
          props.on = {
            press: {
              action: "setState",
              params: { statePath: "/x", value: 1 },
            },
          };
          break;
        }
        case "unknown_component_and_dangling_child": {
          elements[firstKey]!.type = "HallucinatedQuantumWidget";
          elements[firstKey]!.children = ["non-existent-ghost-node-999"];
          break;
        }
      }

      return cloned;
    });
}

/**
 * Arbitrary generating corrupted/hostile RFC 6902 JSONL patch streams (including prototype pollution,
 * primitive path traversal, invalid ops, and truncated JSON).
 */
export function arbitraryCorruptedJsonlStream(): fc.Arbitrary<string> {
  const hostileLines = fc.oneof(
    fc.constant('{"op":"add","path":"/__proto__/polluted","value":"yes"}'),
    fc.constant('{"op":"replace","path":"/constructor/prototype/hacked","value":true}'),
    fc.constant('{"op":"add","path":"/elements/__proto__/type","value":"Card"}'),
    fc.constant('{"op":"add","path":"/root","value":"card-1"}'),
    fc.constant('{"op":"add","path":"/root/cannot/traverse/string","value":123}'),
    fc.constant('{"op":"remove","path":"/non/existent/deep/path"}'),
    fc.constant('{"op":"test","path":"/root","value":"mismatch-should-not-crash"}'),
    fc.constant('{"op":"move","from":"/__proto__","path":"/elements/x"}'),
    fc.constant('{"op":"unknown_op","path":"/root","value":"card-1"}'),
    fc.constant('{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"javascript:alert(1)"},"children":["card-1"]}}'),
    fc.constant('{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Safe"},"children":[]}}'),
    fc.constant('{"truncated_json": true, "missing_end": '),
    fc.constant('Plain conversational LLM text before fences'),
    fc.constant('```spec'),
    fc.constant('```'),
  );

  return fc
    .array(hostileLines, { minLength: 1, maxLength: 15 })
    .map((lines) => lines.join("\n"));
}

export interface InvariantTheoremResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly runs: number;
  readonly durationMs: number;
  readonly counterexample?: string;
}

export interface PbtSuiteReport {
  readonly allPassed: boolean;
  readonly catalogHash: string;
  readonly totalRuns: number;
  readonly totalDurationMs: number;
  readonly theorems: readonly InvariantTheoremResult[];
}

/**
 * Executes the 4 core formal Property-Based Testing (PBT) invariants against any VerifiedCatalog
 * in-process (usable in Vitest CLI, Kiro Hooks, and live inside the Workbench UI).
 */
export function runCatalogInvariantSuite(
  verifiedCatalog: VerifiedCatalog<any, any>,
  options: { numRuns?: number } = {},
): PbtSuiteReport {
  const numRuns = options.numRuns ?? 50;
  const suiteStart = performance.now();
  const theorems: InvariantTheoremResult[] = [];

  function runTheorem(
    id: string,
    name: string,
    property: fc.IProperty<any>,
  ): void {
    const start = performance.now();
    try {
      fc.assert(property, { numRuns });
      theorems.push({
        id,
        name,
        passed: true,
        runs: numRuns,
        durationMs: Number((performance.now() - start).toFixed(2)),
      });
    } catch (err) {
      theorems.push({
        id,
        name,
        passed: false,
        runs: numRuns,
        durationMs: Number((performance.now() - start).toFixed(2)),
        counterexample: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Theorem 1: Stream Chunking Invariance
  runTheorem(
    "INV-PBT-01",
    "Stream Chunking Invariance (Arbitrary Byte/Char Splits & Missing Trailing Newlines)",
    fc.property(
      catalogToSpecArbitrary(verifiedCatalog, { minElements: 1, maxElements: 6 }),
      fc.array(fc.double({ min: 0.01, max: 0.99, noNaN: true }), {
        minLength: 1,
        maxLength: 12,
      }),
      fc.boolean(),
      (validSpec, cutRatios, stripTrailingNewline) => {
        const fullStream = specToJsonlStream(validSpec);
        const testStream = stripTrailingNewline
          ? fullStream.replace(/\n$/, "")
          : fullStream;

        const batchCompiler = createGuardrailedStreamCompiler({
          catalog: verifiedCatalog,
        });
        batchCompiler.push(fullStream);
        const batchFinal = batchCompiler.finalize().spec;

        const chunkCompiler = createGuardrailedStreamCompiler({
          catalog: verifiedCatalog,
        });
        const chunks = splitStreamByCutPoints(testStream, cutRatios);
        for (const chunk of chunks) {
          chunkCompiler.push(chunk);
        }
        const chunkFinal = chunkCompiler.finalize().spec;

        return (
          canonicalStringify(chunkFinal) === canonicalStringify(batchFinal)
        );
      },
    ),
  );

  // Theorem 2: Adversarial Payload Resilience / Non-Crash & DAG Idempotence
  runTheorem(
    "INV-PBT-02",
    "Adversarial Payload Resilience, Prototype Safety & DAG Sanitizer Idempotence",
    fc.property(
      arbitraryAdversarialSpec(verifiedCatalog),
      arbitraryCorruptedJsonlStream(),
      (advSpec, hostileStream) => {
        const pass1 = sanitizeSpecGraph(advSpec, {
          allowedComponents: verifiedCatalog.metadata.componentNames,
        });
        const pass2 = sanitizeSpecGraph(pass1.spec, {
          allowedComponents: verifiedCatalog.metadata.componentNames,
        });

        const compiler = createGuardrailedStreamCompiler({
          catalog: verifiedCatalog,
        });
        compiler.push(hostileStream);
        const compiled = compiler.finalize();

        const protoClean =
          (Object.prototype as Record<string, unknown>).polluted ===
            undefined &&
          (Object.prototype as Record<string, unknown>).hacked === undefined;

        return (
          protoClean &&
          !pass1.inspection.hasCycles &&
          !inspectSpecGraph(compiled.spec).hasCycles &&
          canonicalStringify(pass1.spec) === canonicalStringify(pass2.spec)
        );
      },
    ),
  );

  // Theorem 3: State Pointer Idempotency, Permutation Determinism & Isolation
  runTheorem(
    "INV-PBT-03",
    "State Pointer Idempotency, Batch Permutation Determinism & Session Isolation",
    fc.property(
      fc.uniqueArray(
        fc.tuple(
          fc.stringMatching(/^\/[a-z]{1,6}\/[a-z]{1,6}$/),
          fc.oneof(
            fc.integer({ min: -500, max: 500 }),
            fc.stringMatching(/^[a-zA-Z0-9_-]{1,12}$/),
            fc.boolean(),
          ),
        ),
        { selector: ([path]) => path, minLength: 1, maxLength: 8 },
      ),
      (entries) => {
        const storeA = createTimeTravelStateStore({
          isolatedMarker: "store-A",
        });
        const storeB = createTimeTravelStateStore({
          isolatedMarker: "store-B",
        });

        const forwardUpdates = Object.fromEntries(entries);
        const reversedUpdates = Object.fromEntries([...entries].reverse());

        storeA.update(forwardUpdates);
        storeB.update(reversedUpdates);

        // Idempotency: re-applying identical values must not grow history
        const historyCountBefore = storeA.getHistory().length;
        storeA.update(forwardUpdates);
        const historyCountAfter = storeA.getHistory().length;

        const snapA = { ...storeA.getSnapshot(), isolatedMarker: "normalized" };
        const snapB = { ...storeB.getSnapshot(), isolatedMarker: "normalized" };

        return (
          historyCountBefore === historyCountAfter &&
          storeA.get("/isolatedMarker") === "store-A" &&
          storeB.get("/isolatedMarker") === "store-B" &&
          canonicalStringify(snapA) === canonicalStringify(snapB)
        );
      },
    ),
  );

  // Theorem 4: Catalog-to-Prompt Determinism
  runTheorem(
    "INV-PBT-04",
    "Catalog-to-Prompt & Fingerprint Permutation Determinism",
    fc.property(
      fc.array(
        fc.stringMatching(/^[A-Za-z0-9 ,.-]{4,32}$/),
        { minLength: 1, maxLength: 5 },
      ),
      (customRules) => {
        const reversedRules = [...customRules].reverse();
        const promptA = verifiedCatalog.prompt({ customRules });
        const promptB = verifiedCatalog.prompt({ customRules: reversedRules });

        const allComponentsPresent =
          verifiedCatalog.metadata.componentNames.every((name) =>
            promptA.includes(name),
          );

        return promptA === promptB && allComponentsPresent;
      },
    ),
  );

  const totalDurationMs = Number((performance.now() - suiteStart).toFixed(2));
  const totalRuns = theorems.reduce((acc, t) => acc + t.runs, 0);

  return {
    allPassed: theorems.every((t) => t.passed),
    catalogHash: verifiedCatalog.metadata.catalogHash,
    totalRuns,
    totalDurationMs,
    theorems,
  };
}

export { createVerifiedCatalog };
