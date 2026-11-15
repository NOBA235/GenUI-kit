import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fc from "fast-check";
import JSZip from "jszip";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSONUIProvider } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { afterEach, describe, expect, it } from "vitest";
import { SafeGenUIRenderer, createGuardrailedStreamCompiler, inspectSpecGraph, wrapRegistryWithTelemetry } from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import {
  CYCLIC_SQL_PAYLOAD,
  SHELL_KEY,
  buildChaosPackets,
  buildRemixJsonl,
  classifyRemixPrompt,
  initialPageSpecs,
  verifiedCatalog,
} from "../neuro-chimera-synth/catalog.js";
import { templateComponents } from "../neuro-chimera-synth/components/index.js";
import { stepSchedule } from "../neuro-chimera-synth/components/ChimeraLabShell.js";
import {
  applyChemotaxisPacket,
  dispatchAgent,
  getLabNetwork,
  getLabStore,
  loadScenario,
  resetLabStoreForTests,
  setLab,
  stepLab,
  type ChemotaxisPacketInput,
} from "../neuro-chimera-synth/components/lab-store.js";
import { outlineStatement } from "../neuro-chimera-synth/lib/chimera/ast-outline.js";
import {
  INITIAL_CONDUCTIVITY,
  MIN_CONDUCTIVITY,
  PhysarumNetwork,
  STATEMENT_TIMEOUT_MS,
  type BioLinkSpec,
  type BioNodeSpec,
  type BioQuerySpec,
  type NetworkTelemetry,
  type ScenarioSpec,
} from "../neuro-chimera-synth/lib/chimera/bio-solver.js";
import { getScenarioBenchmarks } from "../neuro-chimera-synth/lib/chimera/benchmarks.js";
import { compareQuery } from "../neuro-chimera-synth/lib/chimera/compare.js";
import { nextCronRuns } from "../neuro-chimera-synth/lib/chimera/cron.js";
import {
  CREW_APP_FILES,
  CREW_APP_FOLDER,
  buildCrewAppZip,
  collectCrewAppFiles,
  validateCrewAppFiles,
} from "../neuro-chimera-synth/lib/chimera/crew-bundle.js";
import {
  CREW_NAME_PATTERN,
  CREW_SEMVER_PATTERN,
  validateCrewBundle,
  validateCrewManifest,
} from "../neuro-chimera-synth/lib/chimera/crew-manifest.js";
import { planQuery, recommendIndexes, withIndex, type Dataset, type IndexDef, type TableStats } from "../neuro-chimera-synth/lib/chimera/query-planner.js";
import { CHIMERA_SCENARIOS } from "../neuro-chimera-synth/lib/chimera/scenarios.js";
import { mapTelemetryToSound, predictPartials } from "../neuro-chimera-synth/lib/chimera/sonifier.js";
import { parseSql, printIdentifier } from "../neuro-chimera-synth/lib/chimera/sql-parser.js";
import { buildTemplateCliCommand, generateTemplateZip } from "../exporter.js";
import { getTemplateBySlug } from "../registry.js";

const NUM_RUNS_GRAPHS = 500;
const SLUG = "neuro-chimera-synth";

/* ═══════════════════════════ Random scenario graphs ═══════════════════════════ */

interface QueryGroup {
  readonly datasetId: string;
  readonly dataset: Dataset;
  readonly queries: readonly BioQuerySpec[];
}

/** Queries from the shipped scenarios, grouped by the single dataset all their sinks share. */
const QUERY_GROUPS: readonly QueryGroup[] = CHIMERA_SCENARIOS.flatMap((sc) => {
  const datasetOf = new Map(sc.nodes.filter((n) => n.datasetId).map((n) => [n.id, n.datasetId!]));
  const groups = new Map<string, BioQuerySpec[]>();
  for (const q of sc.queries) {
    const ds = datasetOf.get(q.sinks[0]!);
    if (!ds || !q.sinks.every((s) => datasetOf.get(s) === ds)) continue;
    if (!groups.has(ds)) groups.set(ds, []);
    groups.get(ds)!.push(q);
  }
  return [...groups].map(([datasetId, queries]) => ({ datasetId, dataset: sc.datasets[datasetId]!, queries }));
});

const latencyArb = fc.double({ min: 0.05, max: 150, noNaN: true });
const DB_KINDS = ["primary", "replica", "shard"] as const;
const COMPUTE_KINDS = ["service", "agent"] as const;

const scenarioArb: fc.Arbitrary<ScenarioSpec> = fc
  .record({
    group: fc.constantFrom(...QUERY_GROUPS),
    computeCount: fc.integer({ min: 1, max: 6 }),
    dbCount: fc.integer({ min: 1, max: 4 }),
    positions: fc.array(fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })), {
      minLength: 11,
      maxLength: 11,
    }),
    kinds: fc.array(fc.nat(), { minLength: 11, maxLength: 11 }),
    workers: fc.array(fc.integer({ min: 1, max: 64 }), { minLength: 4, maxLength: 4 }),
    treeParents: fc.array(fc.nat(), { minLength: 10, maxLength: 10 }),
    treeLatency: fc.array(latencyArb, { minLength: 10, maxLength: 10 }),
    // About one tree link in ten is dropped, so some graphs are disconnected.
    treeDrop: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 10, maxLength: 10 }),
    extraLinks: fc.array(fc.tuple(fc.nat(), fc.nat(), latencyArb), { maxLength: 14 }),
    queries: fc.array(
      fc.record({
        pick: fc.nat(),
        source: fc.nat(),
        sinkMask: fc.integer({ min: 0, max: 15 }),
        rps: fc.double({ min: 0, max: 6000, noNaN: true }),
        calls: fc.option(fc.integer({ min: 1, max: 150 }), { nil: undefined }),
      }),
      { minLength: 1, maxLength: 6 },
    ),
  })
  .map((r) => {
    const nodes: BioNodeSpec[] = [{ id: "n0", label: "Gateway", kind: "gateway", x: r.positions[0]![0], y: r.positions[0]![1] }];
    for (let i = 1; i <= r.computeCount; i++) {
      nodes.push({ id: `n${i}`, label: `Compute ${i}`, kind: COMPUTE_KINDS[r.kinds[i]! % 2]!, x: r.positions[i]![0], y: r.positions[i]![1] });
    }
    const dbIds: string[] = [];
    for (let d = 0; d < r.dbCount; d++) {
      const i = r.computeCount + 1 + d;
      const id = `d${d}`;
      dbIds.push(id);
      nodes.push({
        id,
        label: `DB ${d}`,
        kind: DB_KINDS[r.kinds[i]! % 3]!,
        x: r.positions[i]![0],
        y: r.positions[i]![1],
        datasetId: r.group.datasetId,
        workers: r.workers[d]!,
      });
    }
    const links: BioLinkSpec[] = [];
    const seen = new Set<string>();
    const addLink = (a: number, b: number, latencyMs: number) => {
      if (a === b) return;
      const key = a < b ? `${a}~${b}` : `${b}~${a}`;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ a: nodes[a]!.id, b: nodes[b]!.id, latencyMs });
    };
    for (let i = 1; i < nodes.length; i++) {
      if (r.treeDrop[i - 1] !== 0) addLink(r.treeParents[i - 1]! % i, i, r.treeLatency[i - 1]!);
    }
    for (const [a, b, latency] of r.extraLinks) addLink(a % nodes.length, b % nodes.length, latency);

    const queries: BioQuerySpec[] = r.queries.map((pick, i) => {
      const base = r.group.queries[pick.pick % r.group.queries.length]!;
      const sinks = dbIds.filter((_, d) => (pick.sinkMask >> d) & 1);
      return {
        ...base,
        id: `${base.id}-${i}`,
        source: `n${pick.source % (r.computeCount + 1)}`,
        sinks: sinks.length > 0 ? sinks : [dbIds[0]!],
        requestsPerSecond: pick.rps,
        perRequestCalls: pick.calls ?? base.perRequestCalls,
      };
    });
    return {
      id: "fuzz",
      title: "Fuzzed network",
      summary: "Random topology",
      nodes,
      links,
      queries,
      datasets: { [r.group.datasetId]: r.group.dataset },
    };
  });

type NetworkOp =
  | { readonly kind: "step"; readonly n: number; readonly dt: number }
  | { readonly kind: "toggle"; readonly node: number }
  | { readonly kind: "move"; readonly node: number; readonly x: number; readonly y: number }
  | { readonly kind: "pulse"; readonly node: number; readonly strength: number }
  | { readonly kind: "index"; readonly pick: number }
  | { readonly kind: "batch"; readonly query: number }
  | { readonly kind: "optimize" };

const opArb: fc.Arbitrary<NetworkOp> = fc.oneof(
  fc.record({
    kind: fc.constant("step" as const),
    n: fc.integer({ min: 1, max: 30 }),
    dt: fc.oneof(fc.double({ min: 0.01, max: 20, noNaN: true }), fc.constantFrom(Number.NaN, Infinity, -1, 0)),
  }),
  fc.record({ kind: fc.constant("toggle" as const), node: fc.nat() }),
  fc.record({ kind: fc.constant("move" as const), node: fc.nat(), x: fc.double(), y: fc.double() }),
  fc.record({ kind: fc.constant("pulse" as const), node: fc.nat(), strength: fc.double() }),
  fc.record({ kind: fc.constant("index" as const), pick: fc.nat() }),
  fc.record({ kind: fc.constant("batch" as const), query: fc.nat() }),
  fc.constant({ kind: "optimize" as const }),
);

function applyOp(net: PhysarumNetwork, op: NetworkOp): void {
  const nodeId = (i: number) => net.nodes[i % net.nodes.length]!.id;
  switch (op.kind) {
    case "step":
      net.step(op.n, op.dt);
      return;
    case "toggle": {
      const id = nodeId(op.node);
      if (net.isAlive(id)) net.severNode(id);
      else net.reviveNode(id);
      return;
    }
    case "move":
      net.moveNode(nodeId(op.node), op.x, op.y);
      return;
    case "pulse":
      net.applyChemotaxisPulse(nodeId(op.node), op.strength);
      return;
    case "index": {
      const candidates = net.indexCandidates();
      const c = candidates[op.pick % Math.max(1, candidates.length)];
      if (c) net.injectIndex(c.datasetId, c.index);
      return;
    }
    case "batch": {
      const queries = net.telemetry.queries;
      net.rewriteNPlusOne(queries[op.query % queries.length]!.id);
      return;
    }
    case "optimize":
      net.runOptimizerAgent();
      return;
  }
}

/** Every number reachable from the value is finite. Returns the first offending path. */
function firstNonFinite(value: unknown, at = "telemetry", seen = new Set<unknown>()): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? null : at;
  if (value === null || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const bad = firstNonFinite(child, `${at}.${key}`, seen);
    if (bad) return bad;
  }
  return null;
}

function checkTelemetryInvariants(t: NetworkTelemetry, net: PhysarumNetwork): void {
  expect(firstNonFinite(t)).toBeNull();
  const eps = 1e-9;
  for (const node of t.nodes) {
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.x).toBeLessThanOrEqual(1);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeLessThanOrEqual(1);
    expect(node.load).toBeGreaterThanOrEqual(0);
  }
  for (const link of t.links) {
    expect(link.flux).toBeGreaterThanOrEqual(-eps);
    expect(link.flux).toBeLessThanOrEqual(1 + eps);
    expect(link.faultFlux).toBeGreaterThanOrEqual(-eps);
    expect(link.faultFlux).toBeLessThanOrEqual(link.flux + eps);
    expect(link.conductivity).toBeGreaterThanOrEqual(MIN_CONDUCTIVITY);
    expect(link.conductivity).toBeLessThanOrEqual(Math.max(INITIAL_CONDUCTIVITY, 1) + eps);
    expect(link.latencyMs).toBeGreaterThan(0);
  }
  expect(t.totalFlux).toBeGreaterThanOrEqual(0);
  expect(t.totalFlux).toBeLessThanOrEqual(t.links.length + eps);
  for (const key of ["entropy", "health", "completedShare", "fullScanShare"] as const) {
    expect(t[key], key).toBeGreaterThanOrEqual(-eps);
    expect(t[key], key).toBeLessThanOrEqual(1 + eps);
  }
  for (const q of t.queries) {
    expect(q.fullScanShare).toBeGreaterThanOrEqual(-eps);
    expect(q.fullScanShare).toBeLessThanOrEqual(1 + eps);
    expect(q.statementLatencyMs).toBeLessThanOrEqual(STATEMENT_TIMEOUT_MS + eps);
    if (q.status === "ok" && q.sinks.length > 0) {
      const shares = q.sinks.reduce((sum, s) => sum + s.share, 0);
      expect(shares).toBeCloseTo(1, 6);
      for (const s of q.sinks) expect(net.isAlive(s.nodeId)).toBe(true);
    }
  }
}

/* ═══════════════════════════ Single-table Seq Scan queries ═══════════════════════════ */

interface TableCase {
  readonly dataset: Dataset;
  readonly table: TableStats;
  readonly columns: readonly string[];
}

const TABLE_CASES: readonly TableCase[] = (() => {
  const byId = new Map<string, Dataset>();
  for (const sc of CHIMERA_SCENARIOS) for (const ds of Object.values(sc.datasets)) byId.set(ds.id, ds);
  return [...byId.values()].flatMap((dataset) =>
    Object.values(dataset.tables).map((table) => ({ dataset, table, columns: Object.keys(table.columns) })),
  );
})();

const PREDICATE_OPS = ["=", "<", ">=", "between", "in", "any"] as const;

const seqScanQueryArb = fc.constantFrom(...TABLE_CASES).chain((tc) =>
  fc.record({
    tc: fc.constant(tc),
    preds: fc.uniqueArray(fc.record({ col: fc.constantFrom(...tc.columns), op: fc.constantFrom(...PREDICATE_OPS) }), {
      minLength: 1,
      maxLength: 3,
      selector: (p) => p.col,
    }),
    orderBy: fc.option(fc.record({ col: fc.constantFrom(...tc.columns), dir: fc.constantFrom("ASC", "DESC") }), { nil: null }),
    limit: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
    indexColumns: fc.uniqueArray(fc.constantFrom(...tc.columns), { minLength: 1, maxLength: 3 }),
    indexDesc: fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
  }),
);

interface SeqScanQuery {
  readonly tc: TableCase;
  readonly preds: readonly { readonly col: string; readonly op: (typeof PREDICATE_OPS)[number] }[];
  readonly orderBy: { readonly col: string; readonly dir: string } | null;
  readonly limit: number | null;
}

function buildSeqScanSql(q: SeqScanQuery): string {
  let param = 0;
  const p = () => `$${++param}`;
  const where = q.preds
    .map(({ col, op }) => {
      const c = printIdentifier(col);
      switch (op) {
        case "between":
          return `${c} BETWEEN ${p()} AND ${p()}`;
        case "in":
          return `${c} IN (${p()}, ${p()}, ${p()})`;
        case "any":
          return `${c} = ANY(${p()})`;
        default:
          return `${c} ${op} ${p()}`;
      }
    })
    .join(" AND ");
  const order = q.orderBy ? ` ORDER BY ${printIdentifier(q.orderBy.col)} ${q.orderBy.dir}` : "";
  const limit = q.limit !== null ? ` LIMIT ${q.limit}` : "";
  return `SELECT * FROM ${printIdentifier(q.tc.table.name)} WHERE ${where}${order}${limit}`;
}

function hasSeqScan(sql: string, dataset: Dataset): boolean {
  const plan = planQuery(sql, dataset);
  const visit = (n: typeof plan.root): boolean => n.type === "Seq Scan" || n.children.some(visit);
  return visit(plan.root);
}

/* ═══════════════════════════ Rendering helpers ═══════════════════════════ */

const safeRegistry = wrapRegistryWithTelemetry(verifiedCatalog, templateComponents);

function renderSpec(spec: Spec, healedDiagnostics?: unknown): string {
  return renderToStaticMarkup(
    React.createElement(
      JSONUIProvider,
      { registry: safeRegistry, initialState: {}, children: null },
      React.createElement(SafeGenUIRenderer, {
        spec,
        registry: safeRegistry,
        catalog: verifiedCatalog,
        healedDiagnostics: healedDiagnostics as never,
      }),
    ),
  );
}

function compileRemix(prompt: string) {
  const compiler = createGuardrailedStreamCompiler({ catalog: verifiedCatalog });
  compiler.push(buildRemixJsonl(prompt, initialPageSpecs.home!));
  return compiler.finalize();
}

const CREW_APP_DIR = fileURLToPath(new URL("../neuro-chimera-synth/kiro-crew-app/", import.meta.url));

function readCrewAppFromDisk(dir = CREW_APP_DIR, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) for (const [k, v] of readCrewAppFromDisk(abs, rel)) out.set(k, v);
    else out.set(rel, fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n"));
  }
  return out;
}

afterEach(() => {
  resetLabStoreForTests();
});

/* ═══════════════════════════ Properties ═══════════════════════════ */

describe("CHIMERA // LAB: fast-check property suite", () => {
  it(`Property 1: ${NUM_RUNS_GRAPHS} random graphs, weights and severed links never produce NaN/Infinity and keep flux bounded`, () => {
    fc.assert(
      fc.property(scenarioArb, fc.array(opArb, { minLength: 1, maxLength: 8 }), (scenario, ops) => {
        const net = new PhysarumNetwork(scenario);
        checkTelemetryInvariants(net.telemetry, net);
        for (const op of ops) {
          applyOp(net, op);
          checkTelemetryInvariants(net.telemetry, net);
        }
        // Unreachable or severed sinks are reported as failed queries, never as NaN.
        for (const q of net.telemetry.queries) {
          if (q.status === "failed") expect(q.failureReason).toBeTruthy();
        }
      }),
      { numRuns: NUM_RUNS_GRAPHS },
    );
  }, 60_000);

  it("Property 2: an index migration on a Seq Scan predicate never increases planned cost", () => {
    fc.assert(
      fc.property(seqScanQueryArb, (q) => {
        const sql = buildSeqScanSql(q);
        const { dataset, table } = q.tc;
        fc.pre(hasSeqScan(sql, dataset));
        const before = planQuery(sql, dataset);

        // Any B-tree index: the planner only gains access paths, so the cheapest plan cannot get worse.
        const index: IndexDef = {
          name: "fuzz_idx",
          table: table.name,
          columns: q.indexColumns,
          descending: q.indexColumns.map((_, i) => q.indexDesc[i]!),
        };
        const withFuzzIndex = planQuery(sql, withIndex(dataset, index));
        expect(withFuzzIndex.totalCost).toBeLessThanOrEqual(before.totalCost + 1e-9);

        // Recommended migrations each lower cost, and applying them in order never raises it.
        let current = dataset;
        let cost = before.totalCost;
        for (const rec of recommendIndexes(sql, dataset)) {
          expect(rec.costAfter).toBeLessThanOrEqual(rec.costBefore);
          current = withIndex(current, rec.index);
          const next = planQuery(sql, current).totalCost;
          expect(next).toBeLessThanOrEqual(cost + 1e-9);
          cost = next;
        }
        // Planning is deterministic.
        expect(planQuery(sql, dataset)).toEqual(before);
      }),
      { numRuns: 300 },
    );
  }, 60_000);

  it("Property 2b: the SQL deck's AFTER plan is never more expensive per request than BEFORE", () => {
    for (const scenario of CHIMERA_SCENARIOS) {
      resetLabStoreForTests();
      loadScenario(scenario.id);
      const net = getLabNetwork();
      for (const q of net.telemetry.queries) {
        const cmp = compareQuery(net, q.id);
        expect(cmp.ok, `${scenario.id}/${q.id}`).toBe(true);
        if (!cmp.ok) continue;
        expect(cmp.after.plan.totalCost * cmp.after.callsPerRequest).toBeLessThanOrEqual(
          cmp.before.plan.totalCost * cmp.before.callsPerRequest + 1e-9,
        );
        expect(cmp.after.perRequestMs).toBeLessThanOrEqual(cmp.before.perRequestMs + 1e-9);
        expect(outlineStatement(cmp.stmt).lines[0]?.node).toBe("SelectStmt");
      }
    }
  });

  it("Property 3: the Kiro Crew app.json bundle validates, matches disk, and rejects mutated manifests", async () => {
    // The embedded bundle passes the App Kit rules.
    const validation = validateCrewAppFiles(CREW_APP_FILES);
    expect(validation.ok, JSON.stringify(validation.issues)).toBe(true);
    if (!validation.ok) return;
    expect(validation.value.agents.map((a) => a.name).sort()).toEqual(["chimera-architect", "deadlock-hunter", "index-surgeon"]);
    for (const agent of validation.value.agents) {
      expect(agent.model).toBe("auto");
      expect(agent.tools).toEqual(["@kirocrew-core"]);
    }
    expect(validation.value.manifest.crons?.every((c) => c.enabled === false)).toBe(true);

    // Drift: embedded files equal the files on disk, and the template bundle carries the same files.
    const disk = readCrewAppFromDisk();
    expect(new Map(CREW_APP_FILES.map((f) => [f.path, f.content]))).toEqual(disk);
    const entry = getTemplateBySlug(SLUG)!;
    expect(new Map(collectCrewAppFiles(entry.sourceFiles).map((f) => [f.path, f.content]))).toEqual(disk);

    // The download zip extracts to an installable chimera-lab/ folder.
    const zip = await JSZip.loadAsync(await buildCrewAppZip());
    for (const file of CREW_APP_FILES) {
      expect(await zip.file(`${CREW_APP_FOLDER}/${file.path}`)?.async("string")).toBe(file.content);
    }

    // Manifest mutation fuzzing: validity is exactly what the App Kit rules predict.
    // Mutations reach into arbitrary manifest fields.
    type Manifest = Record<string, any>;
    type Mutation = { readonly valid: boolean; readonly apply: (m: Manifest) => void };
    const mutation = (valid: boolean, apply: (m: Manifest) => void): Mutation => ({ valid, apply });
    const manifest = JSON.parse(CREW_APP_FILES.find((f) => f.path === "app.json")!.content) as Manifest;
    const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
      fc.string({ maxLength: 24 }).map((s) => mutation(CREW_NAME_PATTERN.test(s.trim()), (m) => void (m.name = s))),
      fc
        .oneof(fc.string({ maxLength: 12 }), fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map((t) => t.join(".")))
        .map((s) => mutation(CREW_SEMVER_PATTERN.test(s.trim()), (m) => void (m.version = s))),
      fc
        .constantFrom("../escape.json", "/etc/agent.json", "C:\\agents\\a.json", "agents/../../x.json", "\\\\server\\share\\a.json", "")
        .map((p) => mutation(false, (m) => void (m.agents = [...m.agents, p]))),
      fc.constant(mutation(false, (m) => void (m.crons[0].every = 3600))),
      fc.constant(mutation(false, (m) => void delete m.crons[1].cron_expr)),
      fc
        .constantFrom("61 * * * *", "* * *", "*/0 * * * *", "0 25 * * *", "0 0 32 * *")
        .map((e) => mutation(false, (m) => void (m.crons[2].cron_expr = e))),
      fc.constant(mutation(false, (m) => void (m.crons[1].name = m.crons[0].name))),
      fc
        .constantFrom("backend.hooks", "backend/hooks.py:on_startup", ":on_startup", "backend.hooks:")
        .map((h) => mutation(false, (m) => void (m.backend.hooks.on_startup = h))),
      fc.constant(mutation(false, (m) => void delete m.ui.pages[0].label)),
      fc.string({ maxLength: 60 }).map((s) => mutation(s.trim().length > 0, (m) => void (m.description = s))),
      fc.constant(mutation(true, (m) => void (m.tags = [...m.tags, "observability"]))),
    );
    fc.assert(
      fc.property(mutationArb, (m) => {
        const mutated = structuredClone(manifest);
        m.apply(mutated);
        expect(validateCrewManifest(mutated).ok).toBe(m.valid);
      }),
      { numRuns: 300 },
    );
    // Arbitrary JSON never throws.
    fc.assert(fc.property(fc.jsonValue(), (value) => void validateCrewManifest(value)), { numRuns: 200 });

    // Bundle fuzzing: a missing agent file or a UTF-16 SKILL.md fails validation.
    const agentPaths = (manifest.agents as string[]).slice();
    fc.assert(
      fc.property(fc.constantFrom(...agentPaths), (missing) => {
        const result = validateCrewAppFiles(CREW_APP_FILES.filter((f) => f.path !== missing));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.issues.some((i) => i.file === missing)).toBe(true);
      }),
    );
    // SKILL.md ships as UTF-8 without a BOM; a UTF-16 copy (what PowerShell redirection writes) is rejected.
    const skill = CREW_APP_FILES.find((f) => f.path.endsWith("SKILL.md"))!;
    expect(skill.content.startsWith("\uFEFF")).toBe(false);
    const utf16le = (text: string) => {
      const out = new Uint8Array(2 + text.length * 2);
      out[0] = 0xff;
      out[1] = 0xfe;
      for (let i = 0; i < text.length; i++) {
        out[2 + i * 2] = text.charCodeAt(i) & 0xff;
        out[3 + i * 2] = text.charCodeAt(i) >> 8;
      }
      return out;
    };
    const encoder = new TextEncoder();
    const utf16Bundle = Object.fromEntries(
      CREW_APP_FILES.map((f) => [f.path, f.path === skill.path ? utf16le(f.content) : encoder.encode(f.content)]),
    );
    const utf16Result = validateCrewBundle(utf16Bundle);
    expect(utf16Result.ok).toBe(false);
    if (!utf16Result.ok) expect(utf16Result.issues.some((i) => i.file === skill.path && /UTF-16/.test(i.message))).toBe(true);
  }, 60_000);

  it("Property 3b: every catalog component survives adversarial props without crashing the tree", () => {
    const report = runCatalogInvariantSuite(verifiedCatalog, { numRuns: 20 });
    expect(report.allPassed, JSON.stringify(report.theorems.filter((t) => !t.passed))).toBe(true);

    const componentNames = Object.keys(verifiedCatalog.catalog.data.components);
    const junk = fc.oneof(
      fc.string({ maxLength: 40 }),
      fc.integer(),
      fc.double(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.oneof(fc.integer(), fc.string({ maxLength: 8 })), { maxLength: 6 }),
      fc.array(fc.dictionary(fc.string({ maxLength: 8 }), fc.oneof(fc.string({ maxLength: 8 }), fc.integer())), { maxLength: 3 }),
      fc.constantFrom("__proto__", "<script>alert(1)</script>", "javascript:alert(1)", "node-NaN", CYCLIC_SQL_PAYLOAD),
    );
    fc.assert(
      fc.property(fc.constantFrom(...componentNames), fc.dictionary(fc.string({ maxLength: 16 }), junk, { maxKeys: 8 }), fc.boolean(), (type, props, landing) => {
        resetLabStoreForTests();
        if (landing) setLab({ mode: "landing" });
        const base = initialPageSpecs.home!;
        const shell = base.elements[SHELL_KEY]!;
        const spec: Spec = {
          ...base,
          elements: {
            ...base.elements,
            [SHELL_KEY]: { ...shell, children: [...(shell.children ?? []), "fuzzed"] },
            fuzzed: { type, props, children: [] },
          },
        };
        expect(() => renderSpec(spec)).not.toThrow();
        const compiler = createGuardrailedStreamCompiler({ catalog: verifiedCatalog });
        compiler.push(`${JSON.stringify({ op: "add", path: "/root", value: spec.root })}\n`);
        for (const [key, element] of Object.entries(spec.elements)) {
          compiler.push(`${JSON.stringify({ op: "add", path: `/elements/${key}`, value: element })}\n`);
        }
        const finalized = compiler.finalize();
        const html = renderSpec(finalized.spec, finalized.healedDiagnostics);
        expect(html).toContain('data-testid="chimera-lab-shell"');
        expect(html).not.toContain("<script>");
      }),
      { numRuns: 60 },
    );
  }, 60_000);
});

describe("CHIMERA // LAB: remix presets, chaos healing, SSR and export", () => {
  it("streams the night-shift and genomics presets into the shell, and the night shift heals the network", () => {
    expect(classifyRemixPrompt("Stream Preset: Autonomous Kiro Crew Night-Shift (4 Parallel Agents Refactoring Postgres)")).toBe("night-shift");
    expect(classifyRemixPrompt("Stream Preset: Biotech Genomics Pipeline & Protein Folding Telemetry")).toBe("genomics");
    expect(classifyRemixPrompt("Inject Corrupted Cyclic SQL AST / NaN Chemotaxis Packet")).toBe("corrupted");

    const night = compileRemix("Stream Preset: Autonomous Kiro Crew Night-Shift (4 Parallel Agents Refactoring Postgres)");
    expect(night.issues).toHaveLength(0);
    const nightProps = night.spec.elements[SHELL_KEY]?.props as Record<string, unknown>;
    expect(nightProps.scenarioId).toBe("kiro-crew-overnight-refactor");
    expect(nightProps.nightShift).toBe(true);

    const genomics = compileRemix("Stream Preset: Biotech Genomics Pipeline & Protein Folding Telemetry");
    expect(genomics.issues).toHaveLength(0);
    expect((genomics.spec.elements[SHELL_KEY]?.props as Record<string, unknown>).scenarioId).toBe("genomics-pipeline");

    // The night shift itself, through the same store actions the shell's timers call.
    loadScenario("kiro-crew-overnight-refactor");
    stepLab(8);
    const before = getLabStore().getState().telemetry;
    for (const agent of ["deadlock-hunter", "index-surgeon", "chimera-architect"] as const) dispatchAgent(agent);
    stepLab(8);
    const after = getLabStore().getState().telemetry;
    expect(after.meanRequestLatencyMs).toBeLessThan(before.meanRequestLatencyMs);
    expect(after.fullScanRate).toBeLessThanOrEqual(before.fullScanRate);
    expect(after.health).toBeGreaterThanOrEqual(before.health);
    const authors = new Set(getLabStore().getState().feed.map((e) => e.author));
    expect(authors.size).toBeGreaterThanOrEqual(2);
  });

  it("heals the corrupted cyclic SQL AST / NaN chemotaxis packet and quarantines it without changing the network", () => {
    const finalized = compileRemix("Inject Corrupted Cyclic SQL AST / NaN Chemotaxis Packet");
    expect(finalized.issues.some((i) => i.code === "cyclic_reference")).toBe(true);
    expect(inspectSpecGraph(finalized.spec).hasCycles).toBe(false);
    const a = finalized.spec.elements["chaos-a"]?.props as unknown as ChemotaxisPacketInput;
    const b = finalized.spec.elements["chaos-b"]?.props as unknown as ChemotaxisPacketInput;
    expect(a.strength).toBe(0);
    expect(b.strength).toBe(1);
    expect(finalized.healedDiagnostics["chaos-a"]?.map((d) => d.propName)).toContain("strength");
    expect(finalized.healedDiagnostics["chaos-b"]?.map((d) => d.propName)).toContain("strength");

    const net = getLabNetwork();
    const sqlBefore = net.telemetry.queries.map((q) => q.sql);
    const costBefore = net.telemetry.costUnitsPerSecond;
    const outA = applyChemotaxisPacket(a);
    const outB = applyChemotaxisPacket(b);
    for (const out of [outA, outB]) {
      expect(out.pulseApplied).toBe(false);
      expect(out.sqlApplied).toBe(false);
      expect(out.notice).toContain("QUARANTINED");
      expect(out.notice).toContain("Network unchanged");
    }
    expect(outA.quarantined.some((q) => q.startsWith("SQL payload"))).toBe(true);
    expect(getLabNetwork().telemetry.queries.map((q) => q.sql)).toEqual(sqlBefore);
    expect(getLabNetwork().telemetry.costUnitsPerSecond).toBe(costBefore);
    expect(() => parseSql(CYCLIC_SQL_PAYLOAD)).toThrow(/offset/);

    const html = renderSpec(finalized.spec, finalized.healedDiagnostics);
    expect(html).toContain('data-testid="chimera-lab-shell"');
    expect(html).toContain('data-testid="chimera-chemotaxis-packet"');

    // The X-Ray chaos packets heal the same way.
    const chaos = createGuardrailedStreamCompiler({ catalog: verifiedCatalog });
    chaos.push(buildRemixJsonl("", initialPageSpecs.home!));
    chaos.push(`${buildChaosPackets(SHELL_KEY).join("\n")}\n`);
    const chaosFinal = chaos.finalize();
    expect(chaosFinal.healedDiagnostics["chaos-a"]).toBeDefined();
    expect(inspectSpecGraph(chaosFinal.spec).hasCycles).toBe(false);
  });

  it("server-renders the workbench deck and every landing section in landing mode", () => {
    const workbench = renderSpec(initialPageSpecs.home!);
    for (const id of ["chimera-lab-shell", "chimera-bio-canvas", "chimera-sql-compare", "chimera-crew-constellation", "chimera-spectrum-hud"]) {
      expect(workbench).toContain(`data-testid="${id}"`);
    }
    expect(workbench).toContain("[MODE: CHIMERA LAB WORKBENCH]");
    expect(workbench).toContain("[MODE: AI RESEARCH SAAS LANDING PAGE]");
    expect(workbench).toMatch(/BEFORE \(Seq Scan: [\d,.]+ms\)/);
    expect(workbench).toMatch(/AFTER KIRO CREW OPTIMIZATION \(Index Scan: [\d,.]+ms\)/);
    expect(workbench).toContain("Download Kiro Crew App app.json Bundle");
    expect(workbench).not.toContain('data-testid="chimera-landing-hero"');

    setLab({ mode: "landing" });
    const landing = renderSpec(initialPageSpecs.home!);
    for (const id of ["chimera-landing-hero", "chimera-benchmark-matrix", "chimera-architecture-bento", "chimera-pricing", "chimera-bio-canvas"]) {
      expect(landing).toContain(`data-testid="${id}"`);
    }
    expect(landing).not.toContain('data-testid="chimera-sql-compare"');
    expect(landing).toContain("npx genui-studio add neuro-chimera-synth");
    for (const row of getScenarioBenchmarks()) {
      expect(row.after.meanRequestLatencyMs, row.scenarioId).toBeLessThanOrEqual(row.before.meanRequestLatencyMs);
      expect(landing).toContain(row.title.replace(/&/g, "&amp;"));
    }
  });

  it("keeps helpers within their documented bounds", () => {
    // Store publishes at most 10 times per second for any step rate.
    for (const hz of [1, 5, 10, 15, 20, 0, -3, Number.NaN, 1e9]) {
      const { intervalMs, stepsPerTick } = stepSchedule(hz);
      expect(intervalMs).toBeGreaterThanOrEqual(100);
      expect(stepsPerTick).toBeGreaterThanOrEqual(1);
      expect(stepsPerTick).toBeLessThanOrEqual(2);
    }
    // Cron previews in a fixed offset.
    const from = new Date(Date.UTC(2026, 10, 14, 12, 0));
    expect(nextCronRuns("0 3 * * *", from, 2).map((d) => d.toISOString())).toEqual(["2026-11-15T03:00:00.000Z", "2026-11-16T03:00:00.000Z"]);
    expect(nextCronRuns("0 3 * * *", from, 1, -480)[0]?.toISOString()).toBe("2026-11-15T11:00:00.000Z");
    expect(nextCronRuns("*/30 * * * *", from, 2).map((d) => d.toISOString())).toEqual(["2026-11-14T12:30:00.000Z", "2026-11-14T13:00:00.000Z"]);
    // Healthy telemetry sonifies to a consonant fifth: the carriers sit at 1×, 1.5× and 2× the root.
    const params = mapTelemetryToSound({ health: 1, entropy: 0, totalFlux: 1, synapseFiring: 0, fullScanRate: 0, worstRequestLatencyMs: 0 }, { rootHz: 55 });
    const hz = new Float32Array(32);
    const level = new Float32Array(32);
    const count = predictPartials(params, hz, level);
    expect(count).toBe(27);
    const carriers = [4, 13, 22].map((i) => hz[i]!);
    expect(carriers[0]).toBeCloseTo(55, 3);
    expect(carriers[1]).toBeCloseTo(82.5, 3);
    expect(carriers[2]).toBeCloseTo(110, 3);
    expect([...level].every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
  });

  it("is registered in the marketplace and exports the Kiro Crew app, SKILL.md and POWER.md in the .zip", async () => {
    const entry = getTemplateBySlug(SLUG);
    expect(entry).toBeDefined();
    expect(entry!.manifest.title).toBe("CHIMERA // LAB — Bio-Digital SQL Synthesizer & Kiro Crew Agent Hive");
    expect(entry!.manifest.license).toBe("MIT");
    expect(entry!.manifest.tier).toBe("free");
    expect(entry!.manifest.remixPresets?.map((p) => p.prompt)).toEqual([
      "Stream Preset: Autonomous Kiro Crew Night-Shift (4 Parallel Agents Refactoring Postgres)",
      "Stream Preset: Biotech Genomics Pipeline & Protein Folding Telemetry",
      "Inject Corrupted Cyclic SQL AST / NaN Chemotaxis Packet",
    ]);
    expect(buildTemplateCliCommand(entry!)).toBe("npx genui-studio add neuro-chimera-synth");

    const zip = await JSZip.loadAsync(await generateTemplateZip(entry!));
    const paths = Object.keys(zip.files);
    for (const p of [
      "SKILL.md",
      `.kiro/powers/${SLUG}/POWER.md`,
      "src/template/kiro-crew-app/app.json",
      "src/template/kiro-crew-app/backend/hooks.py",
      "src/template/kiro-crew-app/agents/index-surgeon.json",
      "src/template/lib/chimera/bio-solver.ts",
      "src/template/lib/chimera/crew-app-files.ts",
      "src/template/components/ChimeraLabShell.tsx",
    ]) {
      expect(paths, p).toContain(p);
    }
    // The generated registry bundle stays in the monorepo; the shell adds its own invariant test.
    expect(paths.some((p) => p.includes("bundle.generated"))).toBe(false);
    expect(paths).toContain("__tests__/invariants.fuzz.test.ts");
  });
});
