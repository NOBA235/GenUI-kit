/**
 * CHIMERA // LAB — Physarum bio-SQL routing solver (`lib/chimera/bio-solver.ts`).
 *
 * Models a service graph as a Physarum polycephalum tube network (Tero et al., 2007). Each SQL
 * query injects unit current at its source node; each candidate database node is grounded
 * through a resistance equal to the query's planned service latency there. Kirchhoff's laws
 * give pressures and flux per link; tubes that carry flux thicken, idle tubes shrink:
 *
 *   D' = (D + dt · f(κ|Q|)) / (1 + dt),   f(x) = x^μ / (1 + x^μ)
 *
 * The implicit update is stable for any dt, and D never drops below MIN_CONDUCTIVITY.
 * Everything here is pure and deterministic: no Date, no Math.random, no I/O.
 */

import { explainPlan, planQuery, recommendIndexes, withIndex, indexDdl, type Dataset, type IndexDef, type QueryPlan } from "./query-planner.js";
import { containsAggregate, parseSql, printSql, type Expr, type SelectStatement } from "./sql-parser.js";

/* ═══════════════════════════ Limits & constants ═══════════════════════════ */

export const MAX_NODES = 64;
export const MAX_LINKS = 256;
export const MAX_QUERIES = 32;
export const MIN_CONDUCTIVITY = 1e-4;
export const INITIAL_CONDUCTIVITY = 0.5;
export const PHYSARUM_MU = 1.8;
/** Scales flux shares (0..1) into the sensitive range of f. */
export const FLUX_GAIN = 4;
export const DEFAULT_DT = 0.25;
/** Utilisation cap: sink resistance grows as R / (1 − ρ) up to ρ = LOAD_CAP. */
export const LOAD_CAP = 0.95;
/** Statements slower than this are cancelled, like PostgreSQL `statement_timeout = 30s`. */
export const STATEMENT_TIMEOUT_MS = 30_000;
export const DEFAULT_WORKERS = 16;

/* ═══════════════════════════ Scenario types ═══════════════════════════ */

export type BioNodeKind = "gateway" | "service" | "agent" | "primary" | "replica" | "shard";

export interface BioNodeSpec {
  readonly id: string;
  readonly label: string;
  readonly kind: BioNodeKind;
  /** Layout position in the unit square (0..1), used by the canvas. */
  readonly x: number;
  readonly y: number;
  /** Database nodes reference a dataset; they are the only valid query sinks. */
  readonly datasetId?: string;
  /** Concurrent query slots; capacity is workers × 1000 ms of work per second. */
  readonly workers?: number;
}

export interface BioLinkSpec {
  readonly a: string;
  readonly b: string;
  /** Round-trip network latency across the link, in milliseconds. */
  readonly latencyMs: number;
}

export interface BioQuerySpec {
  readonly id: string;
  readonly label: string;
  readonly sql: string;
  readonly source: string;
  readonly sinks: readonly string[];
  /** Incoming requests per second that run this query. */
  readonly requestsPerSecond: number;
  /** Statements issued per request (N+1 loops issue many). Default 1. */
  readonly perRequestCalls?: number;
  /** Elements bound to `= ANY($n)` array parameters. */
  readonly arrayParamLength?: number;
}

export interface ScenarioSpec {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly nodes: readonly BioNodeSpec[];
  readonly links: readonly BioLinkSpec[];
  readonly queries: readonly BioQuerySpec[];
  readonly datasets: Readonly<Record<string, Dataset>>;
}

export class ScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioError";
  }
}

/* ═══════════════════════════ Telemetry types ═══════════════════════════ */

export interface SinkTelemetry {
  readonly nodeId: string;
  readonly share: number;
  /** Planned execution latency at this sink before load. */
  readonly serviceMs: number;
  /** Effective latency including queueing: serviceMs / (1 − ρ). */
  readonly effectiveMs: number;
  readonly plan: QueryPlan;
}

export interface QueryTelemetry {
  readonly id: string;
  readonly label: string;
  readonly sql: string;
  readonly status: "ok" | "failed";
  readonly failureReason: string | null;
  readonly requestsPerSecond: number;
  readonly perRequestCalls: number;
  readonly statementsPerSecond: number;
  /** Network path latency (flow-weighted) for one statement. */
  readonly pathMs: number;
  /** Path plus sink latency, capped at STATEMENT_TIMEOUT_MS. */
  readonly statementLatencyMs: number;
  /** perRequestCalls × statementLatencyMs: N+1 loops pay the round trip every time. A timeout ends the request. */
  readonly requestLatencyMs: number;
  /** The statement exceeded STATEMENT_TIMEOUT_MS and is cancelled. */
  readonly timedOut: boolean;
  readonly costPerCall: number;
  readonly sinks: readonly SinkTelemetry[];
  readonly dominantSinkId: string | null;
  /** Share of this query's statements that hit a full-table-scan plan. */
  readonly fullScanShare: number;
}

export interface LinkTelemetry {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly latencyMs: number;
  readonly conductivity: number;
  /** Call-weighted flux share through the link (0..1). */
  readonly flux: number;
  /** Part of `flux` carried by statements that hit a full scan or time out (0..flux). */
  readonly faultFlux: number;
  readonly active: boolean;
}

export interface NodeTelemetry {
  readonly id: string;
  /** Current layout position in the unit square (moves with `moveNode`). */
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  /** Utilisation ρ of a database node (raw, may exceed 1). */
  readonly load: number;
  readonly saturated: boolean;
  /** Statements per second served (database nodes). */
  readonly servedPerSecond: number;
  /** Sum of incident link flux. */
  readonly flux: number;
}

export interface NetworkTelemetry {
  readonly tick: number;
  readonly queries: readonly QueryTelemetry[];
  readonly links: readonly LinkTelemetry[];
  readonly nodes: readonly NodeTelemetry[];
  readonly totalFlux: number;
  /** Mean normalised Shannon entropy of the flux split at branching nodes (0..1). */
  readonly entropy: number;
  readonly meanRequestLatencyMs: number;
  readonly worstRequestLatencyMs: number;
  /** Statements per second executed with a full-table-scan plan. */
  readonly fullScanRate: number;
  readonly fullScanShare: number;
  /** Total conductivity change in the last step: Σ|D' − D|. */
  readonly synapseFiring: number;
  /** Share of statements that completed (not failed, not timed out). */
  readonly completedShare: number;
  readonly failedQueries: number;
  readonly timedOutQueries: number;
  readonly saturatedNodes: readonly string[];
  /** Planner cost units executed per second across all queries. */
  readonly costUnitsPerSecond: number;
  readonly health: number;
}

export interface InterventionResult {
  readonly kind: "index" | "rewrite" | "sever" | "revive" | "sql" | "chemotaxis";
  readonly target: string;
  readonly sql: string | null;
  readonly detail: string;
  readonly before: { readonly costUnitsPerSecond: number; readonly meanRequestLatencyMs: number };
  readonly after: { readonly costUnitsPerSecond: number; readonly meanRequestLatencyMs: number };
}

export interface OptimizerReport {
  readonly actions: readonly InterventionResult[];
  readonly before: InterventionResult["before"];
  readonly after: InterventionResult["after"];
}

/* ═══════════════════════════ Linear algebra ═══════════════════════════ */

/**
 * Solve A x = b for symmetric positive definite A (row-major, n×n) by Cholesky factorisation.
 * Exact up to rounding and insensitive to the wide conductance range a slow sink produces.
 * Returns null if A is not positive definite.
 */
export function solveSpd(a: Float64Array, b: Float64Array, n: number): Float64Array | null {
  const l = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    let diag = a[j * n + j]!;
    for (let k = 0; k < j; k++) diag -= l[j * n + k]! * l[j * n + k]!;
    if (!(diag > 0)) return null;
    const ljj = Math.sqrt(diag);
    l[j * n + j] = ljj;
    for (let i = j + 1; i < n; i++) {
      let sum = a[i * n + j]!;
      for (let k = 0; k < j; k++) sum -= l[i * n + k]! * l[j * n + k]!;
      l[i * n + j] = sum / ljj;
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = b[i]!;
    for (let k = 0; k < i; k++) sum -= l[i * n + k]! * y[k]!;
    y[i] = sum / l[i * n + i]!;
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i]!;
    for (let k = i + 1; k < n; k++) sum -= l[k * n + i]! * x[k]!;
    x[i] = sum / l[i * n + i]!;
  }
  return x;
}

/* ═══════════════════════════ N+1 batching rewrite ═══════════════════════════ */

export interface BatchRewrite {
  readonly stmt: SelectStatement;
  readonly sql: string;
  readonly column: Extract<Expr, { kind: "column" }>;
}

function replaceConjunct(expr: Expr, target: Expr, replacement: Expr): Expr {
  if (expr === target) return replacement;
  if (expr.kind === "binary" && expr.op === "AND") {
    return { ...expr, left: replaceConjunct(expr.left, target, replacement), right: replaceConjunct(expr.right, target, replacement) };
  }
  return expr;
}

function topLevelConjuncts(expr: Expr | null, out: Expr[] = []): Expr[] {
  if (expr === null) return out;
  if (expr.kind === "binary" && expr.op === "AND") {
    topLevelConjuncts(expr.left, out);
    topLevelConjuncts(expr.right, out);
  } else {
    out.push(expr);
  }
  return out;
}

function sameColumn(a: Expr, b: Extract<Expr, { kind: "column" }>): boolean {
  return a.kind === "column" && a.name === b.name && a.table === b.table;
}

/**
 * Rewrite a per-item lookup (`col = $n`) into one batched statement (`col = ANY($n)`), done on
 * the AST and printed with `printSql`. The batch column is added to the select list (and to
 * GROUP BY when the query aggregates) so each row can be mapped back to its item.
 * Returns null when batching would change results (LIMIT/OFFSET, DISTINCT, no `col = $n`).
 */
export function batchRewrite(stmt: SelectStatement): BatchRewrite | null {
  if (stmt.limit !== null || stmt.offset !== null || stmt.distinct) return null;
  const target = topLevelConjuncts(stmt.where).find(
    (c) =>
      c.kind === "binary" &&
      c.op === "=" &&
      ((c.left.kind === "column" && c.right.kind === "param") || (c.right.kind === "column" && c.left.kind === "param")),
  );
  if (!target || target.kind !== "binary") return null;
  const column = (target.left.kind === "column" ? target.left : target.right) as Extract<Expr, { kind: "column" }>;
  const param = target.left.kind === "param" ? target.left : target.right;
  const replacement: Expr = { kind: "any", op: "=", expr: column, array: param };
  const where = replaceConjunct(stmt.where!, target, replacement);

  const selectsColumn = stmt.columns.some(
    (c) => (c.kind === "star" && (c.table === null || c.table === column.table)) || (c.kind === "expr" && sameColumn(c.expr, column)),
  );
  const hasAggregate = stmt.columns.some((c) => c.kind === "expr" && containsAggregate(c.expr));
  const columns = selectsColumn ? stmt.columns : [{ kind: "expr" as const, expr: column, alias: null }, ...stmt.columns];
  const groupBy =
    hasAggregate && !stmt.groupBy.some((g) => sameColumn(g, column)) ? [column, ...stmt.groupBy] : stmt.groupBy;
  const next: SelectStatement = { ...stmt, columns, where, groupBy };
  return { stmt: next, sql: printSql(next), column };
}

/* ═══════════════════════════ Network ═══════════════════════════ */

interface QueryState {
  spec: BioQuerySpec;
  sql: string;
  stmt: SelectStatement;
  perRequestCalls: number;
  arrayParamLength: number | undefined;
}

type PlanResult = { readonly ok: true; readonly plan: QueryPlan } | { readonly ok: false; readonly error: string };

interface LinkState {
  readonly id: string;
  readonly a: number;
  readonly b: number;
  /** Latency from the scenario at the original layout. */
  readonly baseLatencyMs: number;
  /** Euclidean link length at the original layout. */
  readonly baseLength: number;
  latencyMs: number;
  conductivity: number;
}

/** Dragging a node scales its link latencies by length ratio, within these bounds. */
export const MIN_LATENCY_SCALE = 0.25;
export const MAX_LATENCY_SCALE = 4;

export interface IndexCandidate {
  readonly datasetId: string;
  readonly index: IndexDef;
  readonly ddl: string;
  /** Call-weighted cost units per second saved: Σ (before − after) × statements/s × share. */
  readonly score: number;
}

interface SolveResult {
  readonly telemetry: NetworkTelemetry;
  /** Aggregated flux per link (same order as links). */
  readonly linkFlux: Float64Array;
  /** Unloaded demand per node in ms of work per second. */
  readonly demandMs: Float64Array;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function inc(array: Float64Array, index: number, delta: number): void {
  array[index] = (array[index] ?? 0) + delta;
}

export class PhysarumNetwork {
  readonly scenarioId: string;
  readonly nodes: readonly BioNodeSpec[];
  private readonly nodeIndex = new Map<string, number>();
  private readonly links: LinkState[];
  private readonly positions: Array<{ x: number; y: number }>;
  private readonly alive: boolean[];
  private readonly queries: QueryState[];
  private datasets: Map<string, Dataset>;
  private readonly planCache = new Map<string, PlanResult>();
  /** Utilisation per node from the previous solve (feeds sink resistance). */
  private load: Float64Array;
  private tickCount = 0;
  private lastFiring = 0;
  private current: NetworkTelemetry;

  constructor(scenario: ScenarioSpec) {
    if (scenario.nodes.length === 0 || scenario.nodes.length > MAX_NODES) throw new ScenarioError(`Scenarios need 1-${MAX_NODES} nodes`);
    if (scenario.links.length > MAX_LINKS) throw new ScenarioError(`Scenarios allow at most ${MAX_LINKS} links`);
    if (scenario.queries.length > MAX_QUERIES) throw new ScenarioError(`Scenarios allow at most ${MAX_QUERIES} queries`);
    this.scenarioId = scenario.id;
    this.nodes = scenario.nodes;
    scenario.nodes.forEach((node, i) => {
      if (this.nodeIndex.has(node.id)) throw new ScenarioError(`Duplicate node id ${node.id}`);
      if (node.datasetId !== undefined && !scenario.datasets[node.datasetId]) throw new ScenarioError(`Node ${node.id} references unknown dataset ${node.datasetId}`);
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new ScenarioError(`Node ${node.id} needs a finite position`);
      this.nodeIndex.set(node.id, i);
    });
    this.positions = scenario.nodes.map((node) => ({ x: clamp01(node.x), y: clamp01(node.y) }));
    const seen = new Set<string>();
    this.links = scenario.links.map((link) => {
      const a = this.nodeIndex.get(link.a);
      const b = this.nodeIndex.get(link.b);
      if (a === undefined || b === undefined || a === b) throw new ScenarioError(`Invalid link ${link.a}-${link.b}`);
      if (!(link.latencyMs > 0) || !Number.isFinite(link.latencyMs)) throw new ScenarioError(`Link ${link.a}-${link.b} needs a positive latency`);
      const id = a < b ? `${link.a}~${link.b}` : `${link.b}~${link.a}`;
      if (seen.has(id)) throw new ScenarioError(`Duplicate link ${id}`);
      seen.add(id);
      const pa = this.positions[a]!;
      const pb = this.positions[b]!;
      return {
        id,
        a,
        b,
        baseLatencyMs: link.latencyMs,
        baseLength: Math.hypot(pa.x - pb.x, pa.y - pb.y),
        latencyMs: link.latencyMs,
        conductivity: INITIAL_CONDUCTIVITY,
      };
    });
    const queryIds = new Set<string>();
    this.queries = scenario.queries.map((q) => {
      if (queryIds.has(q.id)) throw new ScenarioError(`Duplicate query id ${q.id}`);
      queryIds.add(q.id);
      if (!this.nodeIndex.has(q.source)) throw new ScenarioError(`Query ${q.id} has unknown source ${q.source}`);
      if (q.sinks.length === 0) throw new ScenarioError(`Query ${q.id} needs at least one sink`);
      for (const sink of q.sinks) {
        const node = scenario.nodes[this.nodeIndex.get(sink) ?? -1];
        if (!node?.datasetId) throw new ScenarioError(`Query ${q.id} sink ${sink} is not a database node`);
        if (sink === q.source) throw new ScenarioError(`Query ${q.id} cannot sink at its source`);
      }
      if (!(q.requestsPerSecond >= 0)) throw new ScenarioError(`Query ${q.id} needs a non-negative request rate`);
      return {
        spec: q,
        sql: q.sql,
        stmt: parseSql(q.sql),
        perRequestCalls: Math.max(1, Math.round(q.perRequestCalls ?? 1)),
        arrayParamLength: q.arrayParamLength,
      };
    });
    this.alive = scenario.nodes.map(() => true);
    this.datasets = new Map(Object.entries(scenario.datasets));
    this.load = new Float64Array(scenario.nodes.length);
    this.current = this.solve().telemetry;
  }

  /* ─────────── Public API ─────────── */

  get telemetry(): NetworkTelemetry {
    return this.current;
  }

  get tick(): number {
    return this.tickCount;
  }

  getDataset(id: string): Dataset | undefined {
    return this.datasets.get(id);
  }

  isAlive(nodeId: string): boolean {
    const i = this.nodeIndex.get(nodeId);
    return i !== undefined && this.alive[i]!;
  }

  /** Current SQL, N+1 factor and array-parameter length of a query (after any rewrites). */
  getQuery(id: string): { readonly sql: string; readonly perRequestCalls: number; readonly arrayParamLength: number | undefined } | undefined {
    const q = this.queries.find((x) => x.spec.id === id);
    return q ? { sql: q.sql, perRequestCalls: q.perRequestCalls, arrayParamLength: q.arrayParamLength } : undefined;
  }

  /** EXPLAIN text for a query at a sink, or the planning error. */
  explain(queryId: string, sinkId: string): string {
    const q = this.queries.find((x) => x.spec.id === queryId);
    const node = this.nodes[this.nodeIndex.get(sinkId) ?? -1];
    if (!q || !node?.datasetId) return "No plan";
    const result = this.planFor(q, node.datasetId);
    return result.ok ? explainPlan(result.plan) : `ERROR: ${result.error}`;
  }

  /** Advance the Physarum dynamics by `steps` iterations. */
  step(steps = 1, dt = DEFAULT_DT): NetworkTelemetry {
    const n = Math.max(1, Math.min(1000, Math.floor(steps)));
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 10) : DEFAULT_DT;
    for (let s = 0; s < n; s++) {
      const { linkFlux, demandMs } = this.solve();
      let firing = 0;
      this.links.forEach((link, i) => {
        const active = this.alive[link.a]! && this.alive[link.b]!;
        const drive = active ? fluxResponse(FLUX_GAIN * linkFlux[i]!) : 0;
        const next = Math.max(MIN_CONDUCTIVITY, (link.conductivity + safeDt * drive) / (1 + safeDt));
        firing += Math.abs(next - link.conductivity);
        link.conductivity = next;
      });
      this.nodes.forEach((node, i) => {
        const capacity = (node.workers ?? DEFAULT_WORKERS) * 1000;
        this.load[i] = node.datasetId && this.alive[i] ? demandMs[i]! / capacity : 0;
      });
      this.lastFiring = firing;
      this.tickCount++;
    }
    this.current = this.solve().telemetry;
    return this.current;
  }

  /** Solve until total conductivity change per step falls below `tolerance` (or maxSteps). */
  settle(maxSteps = 400, tolerance = 1e-4): NetworkTelemetry {
    for (let i = 0; i < maxSteps; i++) {
      this.step(1);
      if (this.lastFiring < tolerance) break;
    }
    return this.current;
  }

  severNode(nodeId: string): InterventionResult {
    return this.setAlive(nodeId, false);
  }

  reviveNode(nodeId: string): InterventionResult {
    return this.setAlive(nodeId, true);
  }

  /** Add an index to a dataset and re-plan every query that can reach it. */
  injectIndex(datasetId: string, index: IndexDef): InterventionResult {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new ScenarioError(`Unknown dataset ${datasetId}`);
    if (!dataset.tables[index.table]) throw new ScenarioError(`Dataset ${datasetId} has no table ${index.table}`);
    for (const column of index.columns) {
      if (!dataset.tables[index.table]!.columns[column]) throw new ScenarioError(`Table ${index.table} has no column ${column}`);
    }
    const before = this.summary();
    this.datasets.set(datasetId, withIndex(dataset, index));
    this.invalidateDataset(datasetId);
    this.current = this.solve().telemetry;
    return { kind: "index", target: `${datasetId}.${index.table}`, sql: indexDdl(index), detail: `Added ${index.name}`, before, after: this.summary() };
  }

  /** Rewrite an N+1 query into one batched `= ANY($n)` statement per request. */
  rewriteNPlusOne(queryId: string): InterventionResult | null {
    const q = this.queries.find((x) => x.spec.id === queryId);
    if (!q || q.perRequestCalls <= 1) return null;
    const rewrite = batchRewrite(q.stmt);
    if (!rewrite) return null;
    const before = this.summary();
    const batch = q.perRequestCalls;
    q.stmt = rewrite.stmt;
    q.sql = rewrite.sql;
    q.arrayParamLength = batch;
    q.perRequestCalls = 1;
    this.invalidateQuery(queryId);
    this.current = this.solve().telemetry;
    return {
      kind: "rewrite",
      target: queryId,
      sql: rewrite.sql,
      detail: `Batched ${batch} lookups on ${rewrite.column.table ? `${rewrite.column.table}.` : ""}${rewrite.column.name} into one statement`,
      before,
      after: this.summary(),
    };
  }

  /**
   * Index recommendations across all live sinks, ranked by call-weighted savings.
   * Pass `datasetId` to rank only one dataset (the canvas "inject index" action).
   */
  indexCandidates(datasetId?: string): IndexCandidate[] {
    const candidates = new Map<string, { datasetId: string; index: IndexDef; score: number }>();
    for (const qt of this.current.queries) {
      if (qt.status !== "ok") continue;
      const q = this.queries.find((x) => x.spec.id === qt.id)!;
      for (const sink of qt.sinks) {
        const sinkDataset = this.nodes[this.nodeIndex.get(sink.nodeId)!]!.datasetId!;
        if (datasetId !== undefined && sinkDataset !== datasetId) continue;
        const dataset = this.datasets.get(sinkDataset)!;
        let recs;
        try {
          recs = recommendIndexes(q.stmt, dataset, this.planOptions(q));
        } catch {
          continue;
        }
        for (const rec of recs) {
          const key = `${sinkDataset}/${rec.index.name}`;
          const score = (rec.costBefore - rec.costAfter) * qt.statementsPerSecond * sink.share;
          const prev = candidates.get(key);
          candidates.set(key, { datasetId: sinkDataset, index: rec.index, score: (prev?.score ?? 0) + score });
        }
      }
    }
    return [...candidates.entries()]
      .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
      .map(([, c]) => ({ ...c, ddl: indexDdl(c.index) }));
  }

  /**
   * Drag a node to a new layout position. Incident link latencies scale with link length
   * relative to the original layout, clamped to [MIN_LATENCY_SCALE, MAX_LATENCY_SCALE].
   */
  moveNode(nodeId: string, x: number, y: number): NetworkTelemetry {
    const i = this.nodeIndex.get(nodeId);
    if (i === undefined) throw new ScenarioError(`Unknown node ${nodeId}`);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return this.current;
    this.positions[i] = { x: clamp01(x), y: clamp01(y) };
    for (const link of this.links) {
      if (link.a !== i && link.b !== i) continue;
      const pa = this.positions[link.a]!;
      const pb = this.positions[link.b]!;
      const length = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      const ratio = link.baseLength > 1e-9 ? length / link.baseLength : 1;
      const scale = Math.min(MAX_LATENCY_SCALE, Math.max(MIN_LATENCY_SCALE, Number.isFinite(ratio) ? ratio : 1));
      link.latencyMs = link.baseLatencyMs * scale;
    }
    this.current = this.solve().telemetry;
    return this.current;
  }

  /**
   * Replace a query's SQL (from the SQL editor). The new statement must parse and plan on
   * every sink dataset; otherwise nothing changes and the error is thrown.
   */
  setQuerySql(queryId: string, sql: string): InterventionResult {
    const q = this.queries.find((x) => x.spec.id === queryId);
    if (!q) throw new ScenarioError(`Unknown query ${queryId}`);
    const stmt = parseSql(sql);
    for (const sinkId of q.spec.sinks) {
      const datasetId = this.nodes[this.nodeIndex.get(sinkId)!]!.datasetId!;
      planQuery(stmt, this.datasets.get(datasetId)!, this.planOptions(q));
    }
    const before = this.summary();
    q.stmt = stmt;
    q.sql = printSql(stmt);
    this.invalidateQuery(queryId);
    this.current = this.solve().telemetry;
    return { kind: "sql", target: queryId, sql: q.sql, detail: `Replaced SQL for ${queryId}`, before, after: this.summary() };
  }

  /**
   * Chemotaxis attractant pulse: thicken every live tube touching `nodeId` by `strength`
   * (0..1 of the gap to conductivity 1). Non-finite or out-of-range input is rejected and
   * nothing changes, so a corrupted packet can never poison the network state.
   */
  applyChemotaxisPulse(nodeId: string, strength: number): InterventionResult | null {
    const i = this.nodeIndex.get(nodeId);
    if (i === undefined || !this.alive[i] || !Number.isFinite(strength) || strength < 0 || strength > 1) return null;
    const before = this.summary();
    for (const link of this.links) {
      if ((link.a === i || link.b === i) && this.alive[link.a] && this.alive[link.b]) {
        link.conductivity = Math.max(MIN_CONDUCTIVITY, link.conductivity + (1 - link.conductivity) * strength);
      }
    }
    this.current = this.solve().telemetry;
    return { kind: "chemotaxis", target: nodeId, sql: null, detail: `Attractant pulse ${strength.toFixed(2)} at ${nodeId}`, before, after: this.summary() };
  }

  /**
   * The Optimizer Agent, deterministic edition: apply the index recommendations with
   * the largest call-weighted savings (up to `maxIndexes`), then batch every N+1 query.
   */
  runOptimizerAgent(maxIndexes = 3): OptimizerReport {
    const before = this.summary();
    const actions: InterventionResult[] = [];
    for (const { datasetId, index } of this.indexCandidates().slice(0, Math.max(0, maxIndexes))) {
      actions.push(this.injectIndex(datasetId, index));
    }
    for (const q of [...this.queries].sort((a, b) => a.spec.id.localeCompare(b.spec.id))) {
      const result = this.rewriteNPlusOne(q.spec.id);
      if (result) actions.push(result);
    }
    return { actions, before, after: this.summary() };
  }

  /* ─────────── Internals ─────────── */

  private summary(): InterventionResult["before"] {
    return { costUnitsPerSecond: this.current.costUnitsPerSecond, meanRequestLatencyMs: this.current.meanRequestLatencyMs };
  }

  private setAlive(nodeId: string, alive: boolean): InterventionResult {
    const i = this.nodeIndex.get(nodeId);
    if (i === undefined) throw new ScenarioError(`Unknown node ${nodeId}`);
    const before = this.summary();
    this.alive[i] = alive;
    if (!alive) this.load[i] = 0;
    this.current = this.solve().telemetry;
    return {
      kind: alive ? "revive" : "sever",
      target: nodeId,
      sql: null,
      detail: alive ? `Revived ${nodeId}` : `Severed ${nodeId}; traffic reroutes over the next steps`,
      before,
      after: this.summary(),
    };
  }

  private planOptions(q: QueryState) {
    return q.arrayParamLength === undefined ? {} : { arrayParamLength: q.arrayParamLength };
  }

  private planFor(q: QueryState, datasetId: string): PlanResult {
    const key = `${q.spec.id}|${datasetId}`;
    const cached = this.planCache.get(key);
    if (cached) return cached;
    let result: PlanResult;
    try {
      result = { ok: true, plan: planQuery(q.stmt, this.datasets.get(datasetId)!, this.planOptions(q)) };
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    this.planCache.set(key, result);
    return result;
  }

  private invalidateDataset(datasetId: string): void {
    for (const key of [...this.planCache.keys()]) if (key.endsWith(`|${datasetId}`)) this.planCache.delete(key);
  }

  private invalidateQuery(queryId: string): void {
    for (const key of [...this.planCache.keys()]) if (key.startsWith(`${queryId}|`)) this.planCache.delete(key);
  }

  /** One Kirchhoff solve per query with current conductivities; no state changes. */
  private solve(): SolveResult {
    const nodeCount = this.nodes.length;
    const linkFlux = new Float64Array(this.links.length);
    const linkFaultFlux = new Float64Array(this.links.length);
    const demandMs = new Float64Array(nodeCount);
    const servedPerSecond = new Float64Array(nodeCount);
    const activeLink = this.links.map((l) => this.alive[l.a]! && this.alive[l.b]!);
    const adjacency: number[][] = this.nodes.map(() => []);
    this.links.forEach((l, i) => {
      if (!activeLink[i]) return;
      adjacency[l.a]!.push(i);
      adjacency[l.b]!.push(i);
    });

    const totalRate = this.queries.reduce((s, q) => s + q.spec.requestsPerSecond * q.perRequestCalls, 0);
    const queryTelemetry: QueryTelemetry[] = [];
    let saturatedCallShare = 0;

    for (const q of this.queries) {
      const statementsPerSecond = q.spec.requestsPerSecond * q.perRequestCalls;
      const weight = totalRate > 0 ? statementsPerSecond / totalRate : 0;
      const fail = (reason: string): void => {
        queryTelemetry.push({
          id: q.spec.id, label: q.spec.label, sql: q.sql, status: "failed", failureReason: reason,
          requestsPerSecond: q.spec.requestsPerSecond, perRequestCalls: q.perRequestCalls, statementsPerSecond,
          pathMs: 0, statementLatencyMs: 0, requestLatencyMs: 0, timedOut: false, costPerCall: 0, sinks: [], dominantSinkId: null, fullScanShare: 0,
        });
      };
      const source = this.nodeIndex.get(q.spec.source)!;
      if (!this.alive[source]) {
        fail(`Source ${q.spec.source} is offline`);
        continue;
      }
      // Candidate sinks that are alive and have a valid plan.
      const sinkInfo = new Map<number, { plan: QueryPlan; serviceMs: number; effectiveMs: number }>();
      const planErrors: string[] = [];
      for (const sinkId of q.spec.sinks) {
        const idx = this.nodeIndex.get(sinkId)!;
        if (!this.alive[idx]) continue;
        const result = this.planFor(q, this.nodes[idx]!.datasetId!);
        if (!result.ok) {
          planErrors.push(result.error);
          continue;
        }
        const rho = Math.min(LOAD_CAP, Math.max(0, this.load[idx]!));
        sinkInfo.set(idx, { plan: result.plan, serviceMs: result.plan.latencyMs, effectiveMs: result.plan.latencyMs / (1 - rho) });
      }
      // Component reachable from the source.
      const order: number[] = [source];
      const local = new Map<number, number>([[source, 0]]);
      for (let k = 0; k < order.length; k++) {
        for (const li of adjacency[order[k]!]!) {
          const l = this.links[li]!;
          const other = l.a === order[k] ? l.b : l.a;
          if (!local.has(other)) {
            local.set(other, order.length);
            order.push(other);
          }
        }
      }
      const reachableSinks = [...sinkInfo.keys()].filter((s) => local.has(s));
      if (reachableSinks.length === 0) {
        fail(planErrors.length > 0 && sinkInfo.size === 0 ? planErrors[0]! : "No live database node is reachable");
        continue;
      }
      // Kirchhoff system: (Laplacian(D/L) + diag(1/R_sink)) p = e_source.
      const n = order.length;
      const a = new Float64Array(n * n);
      const b = new Float64Array(n);
      b[0] = 1;
      const touched: number[] = [];
      this.links.forEach((l, li) => {
        if (!activeLink[li] || !local.has(l.a)) return;
        const i = local.get(l.a)!;
        const j = local.get(l.b)!;
        const c = l.conductivity / l.latencyMs;
        inc(a, i * n + i, c);
        inc(a, j * n + j, c);
        inc(a, i * n + j, -c);
        inc(a, j * n + i, -c);
        touched.push(li);
      });
      for (const s of reachableSinks) {
        const i = local.get(s)!;
        inc(a, i * n + i, 1 / sinkInfo.get(s)!.effectiveMs);
      }
      const p = solveSpd(a, b, n);
      if (!p) {
        fail("Kirchhoff system is singular");
        continue;
      }
      // Sink shares (normalised to exactly 1) and flow-weighted latency.
      let shareSum = 0;
      const rawShares = reachableSinks.map((s) => {
        const share = Math.max(0, p[local.get(s)!]! / sinkInfo.get(s)!.effectiveMs);
        shareSum += share;
        return share;
      });
      let pathMs = 0;
      const queryLinkFlux: Array<readonly [number, number]> = [];
      for (const li of touched) {
        const l = this.links[li]!;
        const flux = Math.abs((l.conductivity / l.latencyMs) * (p[local.get(l.a)!]! - p[local.get(l.b)!]!)) / (shareSum || 1);
        pathMs += flux * l.latencyMs;
        inc(linkFlux, li, weight * flux);
        queryLinkFlux.push([li, flux]);
      }
      const sinks: SinkTelemetry[] = reachableSinks.map((s, k) => {
        const info = sinkInfo.get(s)!;
        return { nodeId: this.nodes[s]!.id, share: rawShares[k]! / (shareSum || 1), serviceMs: info.serviceMs, effectiveMs: info.effectiveMs, plan: info.plan };
      });
      let sinkMs = 0;
      let costPerCall = 0;
      let fullScanShare = 0;
      let dominant = sinks[0]!;
      for (const sink of sinks) {
        const idx = this.nodeIndex.get(sink.nodeId)!;
        sinkMs += sink.share * sink.effectiveMs;
        costPerCall += sink.share * sink.plan.totalCost;
        if (sink.plan.fullScans.length > 0) fullScanShare += sink.share;
        inc(demandMs, idx, sink.share * statementsPerSecond * sink.serviceMs);
        inc(servedPerSecond, idx, sink.share * statementsPerSecond);
        if (this.load[idx]! > LOAD_CAP) saturatedCallShare += weight * sink.share;
        if (sink.share > dominant.share) dominant = sink;
      }
      const rawStatementMs = finite(pathMs + sinkMs, STATEMENT_TIMEOUT_MS);
      const timedOut = rawStatementMs >= STATEMENT_TIMEOUT_MS;
      const statementLatencyMs = Math.min(rawStatementMs, STATEMENT_TIMEOUT_MS);
      // Fault flux: the query's share of traffic on full-scan plans (all of it when timed out).
      const faultFraction = timedOut ? 1 : fullScanShare;
      if (faultFraction > 0) for (const [li, flux] of queryLinkFlux) inc(linkFaultFlux, li, weight * flux * faultFraction);
      queryTelemetry.push({
        id: q.spec.id, label: q.spec.label, sql: q.sql, status: "ok", failureReason: null,
        requestsPerSecond: q.spec.requestsPerSecond, perRequestCalls: q.perRequestCalls, statementsPerSecond,
        pathMs: finite(pathMs), statementLatencyMs,
        requestLatencyMs: timedOut ? STATEMENT_TIMEOUT_MS : Math.min(STATEMENT_TIMEOUT_MS * q.perRequestCalls, statementLatencyMs * q.perRequestCalls),
        timedOut, costPerCall: finite(costPerCall), sinks, dominantSinkId: dominant.nodeId, fullScanShare,
      });
    }

    return {
      telemetry: this.buildTelemetry(queryTelemetry, linkFlux, linkFaultFlux, servedPerSecond, saturatedCallShare, activeLink),
      linkFlux,
      demandMs,
    };
  }

  private buildTelemetry(
    queries: QueryTelemetry[],
    linkFlux: Float64Array,
    linkFaultFlux: Float64Array,
    servedPerSecond: Float64Array,
    saturatedCallShare: number,
    activeLink: readonly boolean[],
  ): NetworkTelemetry {
    const nodeFlux = new Float64Array(this.nodes.length);
    this.links.forEach((l, i) => {
      inc(nodeFlux, l.a, linkFlux[i]!);
      inc(nodeFlux, l.b, linkFlux[i]!);
    });

    // Flux-weighted mean of the normalised entropy of each branching node's flux split.
    let entropyWeighted = 0;
    let entropyWeight = 0;
    this.nodes.forEach((_, ni) => {
      const incident = this.links.flatMap((l, li) => ((l.a === ni || l.b === ni) && activeLink[li] && linkFlux[li]! > 1e-9 ? [linkFlux[li]!] : []));
      if (incident.length < 2) return;
      const total = incident.reduce((s, f) => s + f, 0);
      const h = -incident.reduce((s, f) => s + (f / total) * Math.log(f / total), 0) / Math.log(incident.length);
      entropyWeighted += h * total;
      entropyWeight += total;
    });

    const ok = queries.filter((q) => q.status === "ok");
    const totalRate = queries.reduce((s, q) => s + q.statementsPerSecond, 0);
    const okRate = ok.reduce((s, q) => s + (q.timedOut ? 0 : q.statementsPerSecond), 0);
    const requestRate = ok.reduce((s, q) => s + q.requestsPerSecond, 0);
    const meanRequestLatencyMs = requestRate > 0 ? ok.reduce((s, q) => s + q.requestsPerSecond * q.requestLatencyMs, 0) / requestRate : 0;
    const worstRequestLatencyMs = ok.reduce((m, q) => Math.max(m, q.requestLatencyMs), 0);
    const fullScanRate = ok.reduce((s, q) => s + q.statementsPerSecond * q.fullScanShare, 0);
    const fullScanShare = totalRate > 0 ? fullScanRate / totalRate : 0;
    const completedShare = totalRate > 0 ? okRate / totalRate : queries.length === 0 ? 1 : 0;
    const saturatedNodes = this.nodes.filter((_, i) => this.load[i]! > LOAD_CAP).map((nd) => nd.id);
    const health = Math.min(
      1,
      Math.max(0, completedShare * (1 - saturatedCallShare) - Math.min(0.5, fullScanShare) - Math.min(0.3, worstRequestLatencyMs / 2000)),
    );

    return {
      tick: this.tickCount,
      queries,
      links: this.links.map((l, i) => {
        // Shares from the linear solve can overshoot [0, 1] by rounding error (~1e-9); report the documented range.
        const flux = clamp01(linkFlux[i]!);
        return {
          id: l.id, a: this.nodes[l.a]!.id, b: this.nodes[l.b]!.id, latencyMs: l.latencyMs,
          conductivity: l.conductivity, flux, faultFlux: Math.min(flux, Math.max(0, linkFaultFlux[i]!)), active: activeLink[i]!,
        };
      }),
      nodes: this.nodes.map((nd, i) => ({
        id: nd.id, x: this.positions[i]!.x, y: this.positions[i]!.y,
        alive: this.alive[i]!, load: this.load[i]!, saturated: this.load[i]! > LOAD_CAP,
        servedPerSecond: servedPerSecond[i]!, flux: nodeFlux[i]!,
      })),
      totalFlux: linkFlux.reduce((s, f) => s + f, 0),
      entropy: entropyWeight > 0 ? entropyWeighted / entropyWeight : 0,
      meanRequestLatencyMs: finite(meanRequestLatencyMs),
      worstRequestLatencyMs: finite(worstRequestLatencyMs),
      fullScanRate,
      fullScanShare,
      synapseFiring: this.lastFiring,
      completedShare,
      failedQueries: queries.length - ok.length,
      timedOutQueries: ok.filter((q) => q.timedOut).length,
      saturatedNodes,
      costUnitsPerSecond: ok.reduce((s, q) => s + q.statementsPerSecond * q.costPerCall, 0),
      health,
    };
  }
}

/** Saturating Physarum response f(x) = x^μ / (1 + x^μ). */
export function fluxResponse(x: number): number {
  if (!(x > 0)) return 0;
  const v = x ** PHYSARUM_MU;
  return v / (1 + v);
}

/** Seeded mulberry32 PRNG for callers that need repeatable randomness (e.g. particle layouts). */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
