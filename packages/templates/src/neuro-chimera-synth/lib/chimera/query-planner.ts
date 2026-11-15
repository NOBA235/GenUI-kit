/**
 * CHIMERA // LAB — cost-based query planner (`lib/chimera/query-planner.ts`).
 *
 * A small, deterministic model of the PostgreSQL planner, so scenarios can show real plan
 * shapes (Seq Scan vs Index Scan, Nested Loop vs Hash Join, top-N sorts, HNSW scans) and index
 * advice. It uses PostgreSQL's default cost constants and default selectivities. It is a model,
 * not PostgreSQL: costs and row estimates are close in shape and ordering, not identical.
 */

import {
  columnRefs,
  containsAggregate,
  isConstantExpr,
  parseSql,
  printExpr,
  printIdentifier,
  splitConjuncts,
  type DistanceOp,
  type Expr,
  type SelectStatement,
} from "./sql-parser.js";

/* ═══════════════════════════ Constants ═══════════════════════════ */

/** PostgreSQL default planner cost settings. */
export const PG_COSTS = {
  seqPageCost: 1,
  randomPageCost: 4,
  cpuTupleCost: 0.01,
  cpuIndexTupleCost: 0.005,
  cpuOperatorCost: 0.0025,
} as const;

/** PostgreSQL default selectivity estimates (src/include/utils/selfuncs.h). */
export const DEFAULT_SELECTIVITY = {
  eq: 0.005,
  inequality: 1 / 3,
  rangePair: 0.005,
  match: 0.005,
  nullFrac: 0.005,
  booleanColumn: 0.5,
  unknown: 1 / 3,
} as const;

export const FULL_SCAN_ROW_THRESHOLD = 10_000;
/** Calibration: 1 cost unit ≈ 0.01 ms on a warm cache, plus a fixed round trip. */
export const COST_UNIT_MS = 0.01;
export const ROUND_TRIP_MS = 0.25;
/** pgvector HNSW defaults: ef_search 40; one distance computation ≈ 0.05 cost units. */
export const HNSW_EF_SEARCH = 40;
export const VECTOR_DISTANCE_COST = 0.05;
/** Assumed element count for `= ANY($n)` array parameters when the caller gives none. */
export const DEFAULT_ARRAY_PARAM_LENGTH = 10;

const VECTOR_OPCLASS: Readonly<Record<DistanceOp, VectorOpclass>> = {
  "<->": "vector_l2_ops",
  "<=>": "vector_cosine_ops",
  "<#>": "vector_ip_ops",
};

/* ═══════════════════════════ Statistics ═══════════════════════════ */

export type VectorOpclass = "vector_l2_ops" | "vector_cosine_ops" | "vector_ip_ops";

export interface ColumnStats {
  readonly nDistinct: number;
  readonly nullFrac?: number;
}

export interface TableStats {
  readonly name: string;
  readonly rows: number;
  readonly pages: number;
  readonly columns: Readonly<Record<string, ColumnStats>>;
}

export interface IndexDef {
  readonly name: string;
  readonly table: string;
  readonly columns: readonly string[];
  /** Per-column DESC flags (B-tree only). */
  readonly descending?: readonly boolean[];
  readonly method?: "btree" | "hnsw";
  readonly opclass?: VectorOpclass;
}

export interface Dataset {
  readonly id: string;
  readonly label: string;
  readonly tables: Readonly<Record<string, TableStats>>;
  readonly indexes: readonly IndexDef[];
}

/* ═══════════════════════════ Plans ═══════════════════════════ */

export type PlanNodeType =
  | "Seq Scan"
  | "Index Scan"
  | "Nested Loop"
  | "Hash Join"
  | "Hash"
  | "Sort"
  | "HashAggregate"
  | "Aggregate"
  | "Limit";

export interface PlanNode {
  readonly type: PlanNodeType;
  readonly title: string;
  readonly startupCost: number;
  readonly totalCost: number;
  readonly rows: number;
  readonly details: readonly string[];
  readonly children: readonly PlanNode[];
  readonly relation?: string;
  readonly alias?: string;
  readonly indexName?: string;
  /** Sequential scan over a table larger than FULL_SCAN_ROW_THRESHOLD. */
  readonly fullScan?: boolean;
}

export interface FullScanReport {
  readonly table: string;
  readonly alias: string;
  readonly tableRows: number;
}

export interface QueryPlan {
  readonly root: PlanNode;
  readonly startupCost: number;
  readonly totalCost: number;
  readonly rows: number;
  /** Estimated latency of one execution: totalCost × COST_UNIT_MS + ROUND_TRIP_MS. */
  readonly latencyMs: number;
  readonly fullScans: readonly FullScanReport[];
  readonly usedIndexes: readonly string[];
}

export interface IndexRecommendation {
  readonly index: IndexDef;
  readonly ddl: string;
  readonly reason: string;
  readonly costBefore: number;
  readonly costAfter: number;
}

export interface PlanOptions {
  readonly arrayParamLength?: number;
}

export class QueryPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryPlanError";
  }
}

/* ═══════════════════════════ Helpers ═══════════════════════════ */

function clampRows(rows: number): number {
  if (!Number.isFinite(rows) || rows < 1) return 1;
  return Math.round(rows);
}

function log2(n: number): number {
  return Math.log2(Math.max(2, n));
}

interface Relation {
  readonly index: number;
  readonly alias: string;
  readonly table: TableStats;
}

type ColumnExpr = Extract<Expr, { kind: "column" }>;

class PlanContext {
  readonly relations: Relation[];

  constructor(
    readonly stmt: SelectStatement,
    readonly dataset: Dataset,
    readonly options: Required<PlanOptions>,
  ) {
    const refs = [stmt.from, ...stmt.joins.map((j) => j.table)];
    this.relations = refs.map((ref, index) => {
      const table = dataset.tables[ref.name];
      if (!table) throw new QueryPlanError(`Unknown table "${ref.name}" in dataset ${dataset.id}`);
      return { index, alias: ref.alias ?? ref.name, table };
    });
    const aliases = new Set<string>();
    for (const rel of this.relations) {
      if (aliases.has(rel.alias)) throw new QueryPlanError(`Table alias "${rel.alias}" is used twice`);
      aliases.add(rel.alias);
    }
  }

  relationOf(col: ColumnExpr): Relation {
    if (col.table !== null) {
      const rel = this.relations.find((r) => r.alias === col.table) ?? this.relations.find((r) => r.table.name === col.table);
      if (!rel) throw new QueryPlanError(`Unknown table reference "${col.table}"`);
      return rel;
    }
    const owners = this.relations.filter((r) => col.name in r.table.columns);
    if (owners.length === 1) return owners[0]!;
    if (owners.length > 1) throw new QueryPlanError(`Column reference "${col.name}" is ambiguous`);
    if (this.relations.length === 1) return this.relations[0]!;
    throw new QueryPlanError(`Cannot resolve column "${col.name}"; qualify it with a table alias`);
  }

  relationSet(expr: Expr): Set<number> {
    return new Set(columnRefs(expr).map((c) => this.relationOf(c).index));
  }

  nDistinct(rel: Relation, column: string): number | null {
    const stats = rel.table.columns[column];
    if (!stats || !(stats.nDistinct > 0)) return null;
    return Math.min(stats.nDistinct, Math.max(1, rel.table.rows));
  }

  eqSelectivity(rel: Relation, column: string): number {
    const nd = this.nDistinct(rel, column);
    return nd === null ? DEFAULT_SELECTIVITY.eq : 1 / nd;
  }
}

/** If `expr` is a plain column of `rel`, its name. */
function columnOf(ctx: PlanContext, expr: Expr, rel: Relation): string | null {
  if (expr.kind !== "column") return null;
  return ctx.relationOf(expr).index === rel.index ? expr.name : null;
}

type PredKind = "eq" | "lower" | "upper" | "between" | "other";

interface Predicate {
  readonly expr: Expr;
  readonly column: string | null;
  readonly kind: PredKind;
  readonly selectivity: number;
}

function flipComparison(op: string): string {
  return op === "<" ? ">" : op === ">" ? "<" : op === "<=" ? ">=" : op === ">=" ? "<=" : op;
}

/** Generic selectivity of a boolean expression over one relation. */
function selectivity(ctx: PlanContext, expr: Expr, rel: Relation): number {
  return analyzePredicate(ctx, expr, rel).selectivity;
}

function analyzePredicate(ctx: PlanContext, expr: Expr, rel: Relation): Predicate {
  const other = (sel: number): Predicate => ({ expr, column: null, kind: "other", selectivity: Math.min(1, Math.max(0, sel)) });
  switch (expr.kind) {
    case "binary": {
      if (expr.op === "AND") return other(selectivity(ctx, expr.left, rel) * selectivity(ctx, expr.right, rel));
      if (expr.op === "OR") {
        const a = selectivity(ctx, expr.left, rel);
        const b = selectivity(ctx, expr.right, rel);
        return other(a + b - a * b);
      }
      if (!["=", "<>", "<", "<=", ">", ">="].includes(expr.op)) return other(DEFAULT_SELECTIVITY.unknown);
      let column = columnOf(ctx, expr.left, rel);
      let op: string = expr.op;
      let constantSide = expr.right;
      if (column === null) {
        column = columnOf(ctx, expr.right, rel);
        op = flipComparison(expr.op);
        constantSide = expr.left;
      }
      if (column === null || !isConstantExpr(constantSide)) {
        return other(expr.op === "=" ? DEFAULT_SELECTIVITY.eq : DEFAULT_SELECTIVITY.unknown);
      }
      const eq = ctx.eqSelectivity(rel, column);
      if (op === "=") return { expr, column, kind: "eq", selectivity: eq };
      if (op === "<>") return other(1 - eq);
      const kind: PredKind = op === ">" || op === ">=" ? "lower" : "upper";
      return { expr, column, kind, selectivity: DEFAULT_SELECTIVITY.inequality };
    }
    case "any": {
      const column = columnOf(ctx, expr.expr, rel);
      if (column === null || expr.op !== "=" || !isConstantExpr(expr.array)) return other(DEFAULT_SELECTIVITY.unknown);
      const k = expr.array.kind === "param" ? ctx.options.arrayParamLength : DEFAULT_ARRAY_PARAM_LENGTH;
      return { expr, column, kind: "eq", selectivity: Math.min(1, k * ctx.eqSelectivity(rel, column)) };
    }
    case "in": {
      const column = columnOf(ctx, expr.expr, rel);
      const constant = expr.list.every(isConstantExpr);
      const sel = Math.min(1, expr.list.length * (column === null ? DEFAULT_SELECTIVITY.eq : ctx.eqSelectivity(rel, column)));
      if (expr.negated || column === null || !constant) return other(expr.negated ? 1 - sel : sel);
      return { expr, column, kind: "eq", selectivity: sel };
    }
    case "between": {
      const column = columnOf(ctx, expr.expr, rel);
      if (expr.negated || column === null || !isConstantExpr(expr.low) || !isConstantExpr(expr.high)) {
        return other(expr.negated ? 1 - DEFAULT_SELECTIVITY.rangePair : DEFAULT_SELECTIVITY.rangePair);
      }
      return { expr, column, kind: "between", selectivity: DEFAULT_SELECTIVITY.rangePair };
    }
    case "like":
      return other(expr.negated ? 1 - DEFAULT_SELECTIVITY.match : DEFAULT_SELECTIVITY.match);
    case "isNull": {
      const column = columnOf(ctx, expr.expr, rel);
      const nullFrac = column === null ? DEFAULT_SELECTIVITY.nullFrac : (rel.table.columns[column]?.nullFrac ?? DEFAULT_SELECTIVITY.nullFrac);
      return other(expr.negated ? 1 - nullFrac : nullFrac);
    }
    case "not":
      return other(1 - selectivity(ctx, expr.expr, rel));
    case "column":
      return other(DEFAULT_SELECTIVITY.booleanColumn);
    case "literal":
      return other(expr.value === true ? 1 : expr.value === false || expr.value === null ? 0 : DEFAULT_SELECTIVITY.unknown);
    default:
      return other(DEFAULT_SELECTIVITY.unknown);
  }
}

/** Combined selectivity of a predicate list, treating a lower+upper bound pair on one column as a range. */
function combinedSelectivity(preds: readonly Predicate[]): number {
  let sel = 1;
  const bounds = new Map<string, { lower: boolean; upper: boolean }>();
  for (const p of preds) {
    if ((p.kind === "lower" || p.kind === "upper") && p.column !== null) {
      const b = bounds.get(p.column) ?? { lower: false, upper: false };
      if (p.kind === "lower") b.lower = true;
      else b.upper = true;
      bounds.set(p.column, b);
    }
  }
  const pairedApplied = new Set<string>();
  for (const p of preds) {
    if ((p.kind === "lower" || p.kind === "upper") && p.column !== null) {
      const b = bounds.get(p.column)!;
      if (b.lower && b.upper) {
        if (!pairedApplied.has(p.column)) {
          pairedApplied.add(p.column);
          sel *= DEFAULT_SELECTIVITY.rangePair;
        }
        continue;
      }
    }
    sel *= p.selectivity;
  }
  return sel;
}

function printConds(exprs: readonly Expr[]): string {
  return `(${exprs.map(printExpr).join(" AND ")})`;
}

/* ═══════════════════════════ Access paths ═══════════════════════════ */

interface AccessPath {
  readonly node: PlanNode;
  /** Order keys the path already satisfies (single-relation ORDER BY). */
  readonly ordered: boolean;
}

function relationTitle(rel: Relation): string {
  return rel.alias === rel.table.name ? printIdentifier(rel.table.name) : `${printIdentifier(rel.table.name)} ${printIdentifier(rel.alias)}`;
}

function seqScan(rel: Relation, preds: readonly Predicate[]): PlanNode {
  const t = rel.table;
  const sel = combinedSelectivity(preds);
  const total = t.pages * PG_COSTS.seqPageCost + t.rows * (PG_COSTS.cpuTupleCost + preds.length * PG_COSTS.cpuOperatorCost);
  return {
    type: "Seq Scan",
    title: `Seq Scan on ${relationTitle(rel)}`,
    startupCost: 0,
    totalCost: total,
    rows: clampRows(t.rows * sel),
    details: preds.length > 0 ? [`Filter: ${printConds(preds.map((p) => p.expr))}`] : [],
    children: [],
    relation: t.name,
    alias: rel.alias,
    fullScan: t.rows > FULL_SCAN_ROW_THRESHOLD,
  };
}

function btreeDescentCost(rows: number): number {
  const height = Math.max(1, Math.ceil(Math.log(Math.max(2, rows)) / Math.log(300)));
  return (Math.ceil(log2(rows)) + 50 * (height + 1)) * PG_COSTS.cpuOperatorCost;
}

interface IndexMatch {
  readonly matched: Predicate[];
  readonly eqPrefix: number;
}

function matchBtree(index: IndexDef, preds: readonly Predicate[]): IndexMatch {
  const matched: Predicate[] = [];
  let eqPrefix = 0;
  for (const column of index.columns) {
    const eq = preds.filter((p) => p.column === column && p.kind === "eq").sort((a, b) => a.selectivity - b.selectivity)[0];
    if (eq) {
      matched.push(eq);
      eqPrefix++;
      continue;
    }
    const ranges = preds.filter((p) => p.column === column && (p.kind === "lower" || p.kind === "upper" || p.kind === "between"));
    matched.push(...ranges);
    break;
  }
  return { matched, eqPrefix };
}

/** Whether an index returns rows in ORDER BY order after its equality prefix, and in which direction. */
function orderDirection(ctx: PlanContext, index: IndexDef, eqPrefix: number, rel: Relation): "forward" | "backward" | null {
  const order = ctx.stmt.orderBy;
  if (order.length === 0 || ctx.relations.length !== 1) return null;
  let forward = true;
  let backward = true;
  for (let i = 0; i < order.length; i++) {
    const key = order[i]!;
    const column = columnOf(ctx, key.expr, rel);
    const indexColumn = index.columns[eqPrefix + i];
    if (column === null || indexColumn !== column) return null;
    const indexDesc = index.descending?.[eqPrefix + i] ?? false;
    const keyDesc = key.direction === "desc";
    if (keyDesc !== indexDesc) forward = false;
    if (keyDesc === indexDesc) backward = false;
  }
  return forward ? "forward" : backward ? "backward" : null;
}

function btreePath(ctx: PlanContext, rel: Relation, index: IndexDef, preds: readonly Predicate[]): AccessPath | null {
  const { matched, eqPrefix } = matchBtree(index, preds);
  const direction = orderDirection(ctx, index, eqPrefix, rel);
  if (matched.length === 0 && direction === null) return null;
  const t = rel.table;
  const indexSel = combinedSelectivity(matched);
  const matchedRows = Math.max(1, t.rows * indexSel);
  const remaining = preds.filter((p) => !matched.includes(p));
  const descent = btreeDescentCost(t.rows);
  const total =
    descent +
    matchedRows * (PG_COSTS.cpuIndexTupleCost + matched.length * PG_COSTS.cpuOperatorCost) +
    Math.min(matchedRows, t.pages) * PG_COSTS.randomPageCost +
    matchedRows * (PG_COSTS.cpuTupleCost + remaining.length * PG_COSTS.cpuOperatorCost);
  const details: string[] = [];
  if (matched.length > 0) details.push(`Index Cond: ${printConds(matched.map((p) => p.expr))}`);
  if (remaining.length > 0) details.push(`Filter: ${printConds(remaining.map((p) => p.expr))}`);
  return {
    node: {
      type: "Index Scan",
      title: `Index Scan${direction === "backward" ? " Backward" : ""} using ${printIdentifier(index.name)} on ${relationTitle(rel)}`,
      startupCost: descent,
      totalCost: total,
      rows: clampRows(t.rows * combinedSelectivity(preds)),
      details,
      children: [],
      relation: t.name,
      alias: rel.alias,
      indexName: index.name,
    },
    ordered: direction !== null,
  };
}

/** The vector column and operator when the first ORDER BY key is `column <op> constant`. */
function distanceOrder(ctx: PlanContext, rel: Relation): { column: string; op: DistanceOp } | null {
  const key = ctx.stmt.orderBy[0];
  if (!key || ctx.relations.length !== 1 || key.direction !== "asc") return null;
  const e = key.expr;
  if (e.kind !== "binary" || (e.op !== "<->" && e.op !== "<=>" && e.op !== "<#>")) return null;
  const column = columnOf(ctx, e.left, rel) ?? columnOf(ctx, e.right, rel);
  const constant = columnOf(ctx, e.left, rel) !== null ? e.right : e.left;
  if (column === null || !isConstantExpr(constant)) return null;
  return { column, op: e.op };
}

function hnswPath(ctx: PlanContext, rel: Relation, index: IndexDef, preds: readonly Predicate[]): AccessPath | null {
  const order = distanceOrder(ctx, rel);
  const limit = ctx.stmt.limit;
  if (!order || limit === null || index.columns[0] !== order.column || index.opclass !== VECTOR_OPCLASS[order.op]) return null;
  const t = rel.table;
  const k = Math.min(t.rows, limit + (ctx.stmt.offset ?? 0));
  const visits = Math.max(HNSW_EF_SEARCH, HNSW_EF_SEARCH * Math.ceil(log2(t.rows)));
  const startup = visits * VECTOR_DISTANCE_COST;
  const scanned = Math.max(k, HNSW_EF_SEARCH);
  const total = startup + scanned * (PG_COSTS.cpuTupleCost + PG_COSTS.randomPageCost + preds.length * PG_COSTS.cpuOperatorCost);
  const details = [`Order By: (${printExpr(ctx.stmt.orderBy[0]!.expr)})`];
  if (preds.length > 0) details.push(`Filter: ${printConds(preds.map((p) => p.expr))}`);
  return {
    node: {
      type: "Index Scan",
      title: `Index Scan using ${printIdentifier(index.name)} on ${relationTitle(rel)}`,
      startupCost: startup,
      totalCost: total,
      rows: clampRows(Math.min(scanned, t.rows) * combinedSelectivity(preds)),
      details,
      children: [],
      relation: t.name,
      alias: rel.alias,
      indexName: index.name,
    },
    ordered: true,
  };
}

function accessPaths(ctx: PlanContext, rel: Relation, preds: readonly Predicate[]): AccessPath[] {
  const paths: AccessPath[] = [{ node: seqScan(rel, preds), ordered: false }];
  for (const index of ctx.dataset.indexes) {
    if (index.table !== rel.table.name) continue;
    const path = (index.method ?? "btree") === "hnsw" ? hnswPath(ctx, rel, index, preds) : btreePath(ctx, rel, index, preds);
    if (path) paths.push(path);
  }
  return paths;
}

function cheapest(paths: readonly AccessPath[]): AccessPath {
  return paths.reduce((best, p) => (p.node.totalCost < best.node.totalCost ? p : best));
}

/* ═══════════════════════════ Upper plan nodes ═══════════════════════════ */

function sortNode(ctx: PlanContext, input: PlanNode): PlanNode {
  const n = input.rows;
  const limit = ctx.stmt.limit;
  const fetch = limit === null ? null : limit + (ctx.stmt.offset ?? 0);
  const topN = fetch !== null && fetch < n;
  const comparisons = topN ? n * log2(2 * fetch) : n * log2(n);
  const hasDistance = ctx.stmt.orderBy.some((o) => o.expr.kind === "binary" && (o.expr.op === "<->" || o.expr.op === "<=>" || o.expr.op === "<#>"));
  const cost = 2 * PG_COSTS.cpuOperatorCost * comparisons + (hasDistance ? n * VECTOR_DISTANCE_COST : 0);
  const total = input.totalCost + cost;
  return {
    type: "Sort",
    title: "Sort",
    startupCost: total,
    totalCost: total + n * PG_COSTS.cpuOperatorCost,
    rows: n,
    details: [
      `Sort Key: ${ctx.stmt.orderBy.map((o) => `${printExpr(o.expr)}${o.direction === "desc" ? " DESC" : ""}`).join(", ")}`,
      ...(topN ? [`Sort Method: top-N heapsort (${fetch} rows)`] : []),
    ],
    children: [input],
  };
}

function limitNode(ctx: PlanContext, input: PlanNode): PlanNode {
  const limit = ctx.stmt.limit!;
  const fetch = Math.min(input.rows, limit + (ctx.stmt.offset ?? 0));
  const fraction = input.rows > 0 ? fetch / input.rows : 1;
  return {
    type: "Limit",
    title: "Limit",
    startupCost: input.startupCost,
    totalCost: input.startupCost + (input.totalCost - input.startupCost) * fraction,
    rows: clampRows(Math.min(limit, Math.max(0, input.rows - (ctx.stmt.offset ?? 0)))),
    details: [],
    children: [input],
  };
}

function aggregateNode(ctx: PlanContext, input: PlanNode): PlanNode | null {
  const stmt = ctx.stmt;
  const hasAgg = stmt.columns.some((c) => c.kind === "expr" && containsAggregate(c.expr));
  if (stmt.groupBy.length === 0 && !hasAgg && !stmt.distinct) return null;
  if (stmt.groupBy.length === 0 && hasAgg) {
    const total = input.totalCost + input.rows * PG_COSTS.cpuOperatorCost;
    return { type: "Aggregate", title: "Aggregate", startupCost: total, totalCost: total + PG_COSTS.cpuTupleCost, rows: 1, details: [], children: [input] };
  }
  const keys = stmt.groupBy.length > 0 ? stmt.groupBy : stmt.columns.flatMap((c) => (c.kind === "expr" ? [c.expr] : []));
  let groups = 1;
  for (const key of keys) {
    const cols = columnRefs(key);
    const nd = key.kind === "column" && cols.length === 1 ? ctx.nDistinct(ctx.relationOf(cols[0]!), cols[0]!.name) : null;
    groups *= nd ?? 200;
  }
  groups = Math.min(input.rows, groups);
  let rows = clampRows(groups);
  const details = [`Group Key: ${keys.map(printExpr).join(", ") || "*"}`];
  if (stmt.having) {
    rows = clampRows(rows * DEFAULT_SELECTIVITY.unknown);
    details.push(`Filter: (${printExpr(stmt.having)})`);
  }
  const startup = input.totalCost + input.rows * PG_COSTS.cpuOperatorCost * Math.max(1, keys.length);
  return { type: "HashAggregate", title: "HashAggregate", startupCost: startup, totalCost: startup + groups * PG_COSTS.cpuTupleCost, rows, details, children: [input] };
}

/* ═══════════════════════════ Join planning ═══════════════════════════ */

interface EquiCondition {
  readonly expr: Expr;
  readonly outer: { readonly rel: Relation; readonly column: string };
  readonly inner: { readonly rel: Relation; readonly column: string };
}

function equiCondition(ctx: PlanContext, expr: Expr, joined: ReadonlySet<number>, inner: Relation): EquiCondition | null {
  if (expr.kind !== "binary" || expr.op !== "=" || expr.left.kind !== "column" || expr.right.kind !== "column") return null;
  const l = ctx.relationOf(expr.left);
  const r = ctx.relationOf(expr.right);
  if (l.index === inner.index && joined.has(r.index)) return { expr, outer: { rel: r, column: expr.right.name }, inner: { rel: l, column: expr.left.name } };
  if (r.index === inner.index && joined.has(l.index)) return { expr, outer: { rel: l, column: expr.left.name }, inner: { rel: r, column: expr.right.name } };
  return null;
}

function planJoin(
  ctx: PlanContext,
  outer: PlanNode,
  joined: ReadonlySet<number>,
  inner: Relation,
  innerPreds: readonly Predicate[],
  joinConds: readonly Expr[],
  type: "inner" | "left",
): PlanNode {
  const equi = joinConds.map((c) => equiCondition(ctx, c, joined, inner)).find((e): e is EquiCondition => e !== null) ?? null;
  const extra = joinConds.filter((c) => c !== equi?.expr);
  const innerBest = cheapest(accessPaths(ctx, inner, innerPreds)).node;
  const innerFilterSel = combinedSelectivity(innerPreds);

  let joinSel = DEFAULT_SELECTIVITY.unknown;
  if (equi) {
    const ndOuter = ctx.nDistinct(equi.outer.rel, equi.outer.column) ?? 200;
    const ndInner = ctx.nDistinct(equi.inner.rel, equi.inner.column) ?? 200;
    joinSel = 1 / Math.max(ndOuter, ndInner);
  }
  joinSel *= DEFAULT_SELECTIVITY.unknown ** extra.length;
  let rows = outer.rows * innerBest.rows * joinSel;
  if (type === "left") rows = Math.max(outer.rows, rows);
  rows = clampRows(rows);
  const suffix = type === "left" ? " Left Join" : "";
  const extraDetails = extra.length > 0 ? [`Join Filter: ${printConds(extra)}`] : [];

  const candidates: PlanNode[] = [];
  if (equi) {
    // Hash Join: build a hash table over the inner input, probe it with each outer row.
    const hash: PlanNode = {
      type: "Hash",
      title: "Hash",
      startupCost: innerBest.totalCost,
      totalCost: innerBest.totalCost,
      rows: innerBest.rows,
      details: [],
      children: [innerBest],
    };
    const build = innerBest.rows * (PG_COSTS.cpuTupleCost + PG_COSTS.cpuOperatorCost);
    const startup = outer.startupCost + innerBest.totalCost + build;
    candidates.push({
      type: "Hash Join",
      title: `Hash${suffix === "" ? " Join" : suffix}`,
      startupCost: startup,
      totalCost: outer.totalCost + innerBest.totalCost + build + outer.rows * PG_COSTS.cpuOperatorCost + rows * PG_COSTS.cpuTupleCost,
      rows,
      details: [`Hash Cond: (${printExpr(equi.expr)})`, ...extraDetails],
      children: [outer, hash],
    });

    // Nested Loop with a parameterized inner index scan on the join column.
    const index = ctx.dataset.indexes.find(
      (ix) => ix.table === inner.table.name && (ix.method ?? "btree") === "btree" && ix.columns[0] === equi.inner.column,
    );
    if (index) {
      const t = inner.table;
      const ndInner = ctx.nDistinct(inner, equi.inner.column) ?? 200;
      const perLoopMatched = Math.max(1, t.rows / ndInner);
      const descent = btreeDescentCost(t.rows);
      const perLoop =
        descent +
        perLoopMatched * (PG_COSTS.cpuIndexTupleCost + PG_COSTS.cpuTupleCost + innerPreds.length * PG_COSTS.cpuOperatorCost) +
        Math.min(perLoopMatched, t.pages) * PG_COSTS.randomPageCost;
      const innerScan: PlanNode = {
        type: "Index Scan",
        title: `Index Scan using ${printIdentifier(index.name)} on ${relationTitle(inner)}`,
        startupCost: descent,
        totalCost: perLoop,
        rows: clampRows(perLoopMatched * innerFilterSel),
        details: [
          `Index Cond: (${printExpr({ kind: "binary", op: "=", left: { kind: "column", table: inner.alias, name: equi.inner.column }, right: { kind: "column", table: equi.outer.rel.alias, name: equi.outer.column } })})`,
          ...(innerPreds.length > 0 ? [`Filter: ${printConds(innerPreds.map((p) => p.expr))}`] : []),
        ],
        children: [],
        relation: t.name,
        alias: inner.alias,
        indexName: index.name,
      };
      candidates.push({
        type: "Nested Loop",
        title: `Nested Loop${suffix}`,
        startupCost: outer.startupCost + descent,
        totalCost: outer.totalCost + outer.rows * perLoop + rows * PG_COSTS.cpuTupleCost,
        rows,
        details: extraDetails,
        children: [outer, innerScan],
      });
    }
  }
  if (candidates.length === 0) {
    candidates.push({
      type: "Nested Loop",
      title: `Nested Loop${suffix}`,
      startupCost: outer.startupCost + innerBest.startupCost,
      totalCost: outer.totalCost + innerBest.totalCost + outer.rows * innerBest.rows * PG_COSTS.cpuOperatorCost,
      rows,
      details: joinConds.length > 0 ? [`Join Filter: ${printConds(joinConds)}`] : [],
      children: [outer, innerBest],
    });
  }
  return candidates.reduce((best, c) => (c.totalCost < best.totalCost ? c : best));
}

/* ═══════════════════════════ Entry points ═══════════════════════════ */

function collect(node: PlanNode, out: PlanNode[] = []): PlanNode[] {
  out.push(node);
  node.children.forEach((c) => collect(c, out));
  return out;
}

function finalize(root: PlanNode): QueryPlan {
  const nodes = collect(root);
  const fullScans = nodes
    .filter((n) => n.type === "Seq Scan" && n.fullScan)
    .map((n) => ({ table: n.relation!, alias: n.alias!, tableRows: 0 }));
  return {
    root,
    startupCost: root.startupCost,
    totalCost: root.totalCost,
    rows: root.rows,
    latencyMs: root.totalCost * COST_UNIT_MS + ROUND_TRIP_MS,
    fullScans,
    usedIndexes: [...new Set(nodes.flatMap((n) => (n.indexName ? [n.indexName] : [])))],
  };
}

interface PreparedQuery {
  readonly ctx: PlanContext;
  readonly filters: ReadonlyMap<number, Predicate[]>;
  readonly joinPreds: readonly Expr[];
}

function prepare(stmt: SelectStatement, dataset: Dataset, options: PlanOptions): PreparedQuery {
  const ctx = new PlanContext(stmt, dataset, { arrayParamLength: options.arrayParamLength ?? DEFAULT_ARRAY_PARAM_LENGTH });
  const filters = new Map<number, Predicate[]>(ctx.relations.map((r) => [r.index, []]));
  const joinPreds: Expr[] = [];
  const conjuncts = [...splitConjuncts(stmt.where), ...stmt.joins.flatMap((j) => splitConjuncts(j.on))];
  for (const c of conjuncts) {
    const rels = ctx.relationSet(c);
    if (rels.size <= 1) {
      const rel = ctx.relations[rels.size === 1 ? [...rels][0]! : 0]!;
      filters.get(rel.index)!.push(analyzePredicate(ctx, c, rel));
    } else {
      joinPreds.push(c);
    }
  }
  return { ctx, filters, joinPreds };
}

/** Plan a parsed statement (or SQL text) against a dataset. Throws QueryPlanError for unknown tables/columns. */
export function planQuery(input: SelectStatement | string, dataset: Dataset, options: PlanOptions = {}): QueryPlan {
  const stmt = typeof input === "string" ? parseSql(input) : input;
  const { ctx, filters, joinPreds } = prepare(stmt, dataset, options);
  const first = ctx.relations[0]!;
  const firstPaths = accessPaths(ctx, first, filters.get(first.index)!);

  let root: PlanNode;
  if (ctx.relations.length === 1) {
    // Compare paths after ORDER BY / LIMIT, so an ordered index scan can win through early termination.
    const finish = (path: AccessPath): PlanNode => {
      let node = path.node;
      const agg = aggregateNode(ctx, node);
      if (agg) node = agg;
      if (stmt.orderBy.length > 0 && (!path.ordered || agg)) node = sortNode(ctx, node);
      if (stmt.limit !== null) node = limitNode(ctx, node);
      return node;
    };
    root = firstPaths.map(finish).reduce((best, n) => (n.totalCost < best.totalCost ? n : best));
  } else {
    let node = cheapest(firstPaths).node;
    const joined = new Set<number>([first.index]);
    const used = new Set<Expr>();
    stmt.joins.forEach((join, i) => {
      const inner = ctx.relations[i + 1]!;
      const conds = joinPreds.filter((c) => {
        if (used.has(c)) return false;
        const rels = ctx.relationSet(c);
        return rels.has(inner.index) && [...rels].every((r) => r === inner.index || joined.has(r));
      });
      conds.forEach((c) => used.add(c));
      node = planJoin(ctx, node, joined, inner, filters.get(inner.index)!, conds, join.type);
      joined.add(inner.index);
    });
    const agg = aggregateNode(ctx, node);
    if (agg) node = agg;
    if (stmt.orderBy.length > 0) node = sortNode(ctx, node);
    if (stmt.limit !== null) node = limitNode(ctx, node);
    root = node;
  }
  const plan = finalize(root);
  return {
    ...plan,
    fullScans: plan.fullScans.map((f) => ({ ...f, tableRows: dataset.tables[f.table]?.rows ?? 0 })),
  };
}

/* ═══════════════════════════ EXPLAIN text ═══════════════════════════ */

function formatNode(node: PlanNode): string {
  return `${node.title}  (cost=${node.startupCost.toFixed(2)}..${node.totalCost.toFixed(2)} rows=${node.rows})`;
}

/** PostgreSQL-style EXPLAIN output (without width). */
export function explainPlan(plan: QueryPlan): string {
  const lines: string[] = [];
  const visit = (node: PlanNode, depth: number) => {
    lines.push(depth === 0 ? formatNode(node) : `${" ".repeat(2 + 6 * (depth - 1))}->  ${formatNode(node)}`);
    const detailIndent = " ".repeat(depth === 0 ? 2 : 2 + 6 * depth);
    node.details.forEach((d) => lines.push(`${detailIndent}${d}`));
    node.children.forEach((c) => visit(c, depth + 1));
  };
  visit(plan.root, 0);
  return lines.join("\n");
}

/* ═══════════════════════════ Index advice ═══════════════════════════ */

function indexName(table: string, columns: readonly string[], suffix = ""): string {
  const raw = `idx_${table}_${columns.join("_")}${suffix}`.replace(/[^a-z0-9_]/g, "_");
  return raw.slice(0, 63);
}

export function indexDdl(index: IndexDef): string {
  const table = printIdentifier(index.table);
  const name = printIdentifier(index.name);
  if ((index.method ?? "btree") === "hnsw") {
    return `CREATE INDEX CONCURRENTLY ${name} ON ${table} USING hnsw (${printIdentifier(index.columns[0]!)} ${index.opclass ?? "vector_l2_ops"});`;
  }
  const cols = index.columns.map((c, i) => `${printIdentifier(c)}${index.descending?.[i] ? " DESC" : ""}`);
  return `CREATE INDEX CONCURRENTLY ${name} ON ${table} (${cols.join(", ")});`;
}

function hasPrefixIndex(dataset: Dataset, candidate: IndexDef): boolean {
  return dataset.indexes.some(
    (ix) =>
      ix.table === candidate.table &&
      (ix.method ?? "btree") === (candidate.method ?? "btree") &&
      candidate.columns.every((c, i) => ix.columns[i] === c) &&
      (candidate.method !== "hnsw" || ix.opclass === candidate.opclass),
  );
}

/** Add an index to a dataset (returns a new dataset; same-named indexes are replaced). */
export function withIndex(dataset: Dataset, index: IndexDef): Dataset {
  return { ...dataset, indexes: [...dataset.indexes.filter((ix) => ix.name !== index.name), index] };
}

/**
 * Recommend indexes for sequential scans on large tables. Column order: equality columns
 * (most selective first), then the ORDER BY column when the query has a LIMIT, otherwise the
 * range column. Join inner sides get an index on the join key. Distance ORDER BY gets HNSW.
 * Each recommendation is kept only if re-planning with it lowers the total cost by over 5%.
 */
export function recommendIndexes(input: SelectStatement | string, dataset: Dataset, options: PlanOptions = {}): IndexRecommendation[] {
  const stmt = typeof input === "string" ? parseSql(input) : input;
  const before = planQuery(stmt, dataset, options);
  const { ctx, filters, joinPreds } = prepare(stmt, dataset, options);
  const scans = collect(before.root).filter((n) => n.type === "Seq Scan" && n.fullScan);
  const candidates: Array<{ index: IndexDef; reason: string }> = [];

  for (const scan of scans) {
    const rel = ctx.relations.find((r) => r.alias === scan.alias);
    if (!rel) continue;
    const preds = filters.get(rel.index)!;
    const eqCols = [...new Set(preds.filter((p) => p.kind === "eq" && p.column).sort((a, b) => a.selectivity - b.selectivity).map((p) => p.column!))];
    const rangeCol = preds.find((p) => (p.kind === "lower" || p.kind === "upper" || p.kind === "between") && p.column && !eqCols.includes(p.column))?.column ?? null;
    const sortKeys =
      ctx.relations.length === 1 && stmt.limit !== null
        ? stmt.orderBy.map((o) => ({ column: columnOf(ctx, o.expr, rel), desc: o.direction === "desc" }))
        : [];
    const sortUsable = sortKeys.length > 0 && sortKeys.every((k) => k.column !== null);

    const vector = distanceOrder(ctx, rel);
    if (vector) {
      candidates.push({
        index: { name: indexName(rel.table.name, [vector.column], "_hnsw"), table: rel.table.name, columns: [vector.column], method: "hnsw", opclass: VECTOR_OPCLASS[vector.op] },
        reason: `ORDER BY ${vector.column} ${vector.op} ... LIMIT needs an HNSW index with ${VECTOR_OPCLASS[vector.op]}`,
      });
      continue;
    }

    const columns = [...eqCols];
    const descending: boolean[] = columns.map(() => false);
    if (sortUsable) {
      for (const key of sortKeys) {
        if (!columns.includes(key.column!)) {
          columns.push(key.column!);
          descending.push(key.desc);
        }
      }
    } else if (rangeCol) {
      columns.push(rangeCol);
      descending.push(false);
    }
    if (columns.length === 0 && rel.index > 0) {
      const joinCol = joinPreds
        .map((c) => (c.kind === "binary" && c.op === "=" ? [c.left, c.right] : []))
        .flat()
        .map((e) => columnOf(ctx, e, rel))
        .find((c): c is string => c !== null);
      if (joinCol) {
        columns.push(joinCol);
        descending.push(false);
      }
    }
    if (columns.length === 0) continue;
    candidates.push({
      index: { name: indexName(rel.table.name, columns), table: rel.table.name, columns, descending, method: "btree" },
      reason: `Seq Scan on ${rel.table.name} (${rel.table.rows.toLocaleString("en-US")} rows)`,
    });
  }

  const out: IndexRecommendation[] = [];
  const seen = new Set<string>();
  for (const { index, reason } of candidates) {
    if (seen.has(index.name) || hasPrefixIndex(dataset, index)) continue;
    seen.add(index.name);
    const after = planQuery(stmt, withIndex(dataset, index), options);
    if (after.totalCost < before.totalCost * 0.95) {
      out.push({ index, ddl: indexDdl(index), reason, costBefore: before.totalCost, costAfter: after.totalCost });
    }
  }
  return out;
}
