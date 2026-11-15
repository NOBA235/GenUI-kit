/**
 * Before/after comparison for the SQL command deck (`lib/chimera/compare.ts`).
 *
 * "Before" plans the SQL on the query's dominant sink dataset as it is now. "After" applies
 * every recommended index (and the N+1 batching rewrite when the query loops), then re-plans.
 * Per-request figures are planner estimates of execution time only: they exclude network
 * round trips and queueing, which the solver adds on top.
 */

import { batchRewrite, type PhysarumNetwork } from "./bio-solver.js";
import { explainPlan, planQuery, recommendIndexes, withIndex, type IndexRecommendation, type PlanNode, type QueryPlan } from "./query-planner.js";
import { parseSql, SqlParseError, type SelectStatement } from "./sql-parser.js";

export interface PlanSide {
  readonly plan: QueryPlan;
  readonly explain: string;
  /** Distinct scan/join node types, root first (e.g. "Limit › Sort › Seq Scan"). */
  readonly shape: string;
  readonly fullScan: boolean;
  readonly callsPerRequest: number;
  readonly perRequestMs: number;
}

export type QueryComparison =
  | {
      readonly ok: true;
      readonly stmt: SelectStatement;
      readonly sinkId: string;
      readonly datasetId: string;
      readonly before: PlanSide;
      readonly after: PlanSide;
      readonly migrations: readonly IndexRecommendation[];
      readonly rewriteSql: string | null;
    }
  | { readonly ok: false; readonly error: string; readonly offset: number | null };

function shapeOf(root: PlanNode): string {
  const types: string[] = [];
  const visit = (n: PlanNode) => {
    if (!types.includes(n.type) && n.type !== "Hash") types.push(n.type);
    n.children.forEach(visit);
  };
  visit(root);
  return types.join(" › ");
}

function side(plan: QueryPlan, calls: number): PlanSide {
  return {
    plan,
    explain: explainPlan(plan),
    shape: shapeOf(plan.root),
    fullScan: plan.fullScans.length > 0,
    callsPerRequest: calls,
    perRequestMs: plan.latencyMs * calls,
  };
}

export function compareQuery(network: PhysarumNetwork, queryId: string, sqlOverride?: string): QueryComparison {
  const query = network.getQuery(queryId);
  const telemetry = network.telemetry.queries.find((q) => q.id === queryId);
  if (!query || !telemetry) return { ok: false, error: `Unknown query ${queryId}`, offset: null };

  let stmt: SelectStatement;
  try {
    stmt = parseSql(sqlOverride ?? query.sql);
  } catch (err) {
    return err instanceof SqlParseError
      ? { ok: false, error: err.message, offset: err.offset }
      : { ok: false, error: String(err), offset: null };
  }

  const sinkId = telemetry.dominantSinkId ?? network.nodes.find((n) => n.datasetId && telemetry.sinks.some((s) => s.nodeId === n.id))?.id;
  const sinkNode = network.nodes.find((n) => n.id === sinkId) ?? network.nodes.find((n) => n.datasetId);
  const datasetId = sinkNode?.datasetId;
  const dataset = datasetId ? network.getDataset(datasetId) : undefined;
  if (!sinkNode || !datasetId || !dataset) return { ok: false, error: "No database node to plan against", offset: null };

  const options = query.arrayParamLength === undefined ? {} : { arrayParamLength: query.arrayParamLength };
  try {
    const before = planQuery(stmt, dataset, options);
    const migrations = recommendIndexes(stmt, dataset, options);
    const optimized = migrations.reduce((ds, rec) => withIndex(ds, rec.index), dataset);
    const rewrite = query.perRequestCalls > 1 ? batchRewrite(stmt) : null;
    const afterStmt = rewrite?.stmt ?? stmt;
    const afterOptions = rewrite ? { arrayParamLength: query.perRequestCalls } : options;
    const after = planQuery(afterStmt, optimized, afterOptions);
    return {
      ok: true,
      stmt,
      sinkId: sinkNode.id,
      datasetId,
      before: side(before, query.perRequestCalls),
      after: side(after, rewrite ? 1 : query.perRequestCalls),
      migrations,
      rewriteSql: rewrite?.sql ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), offset: null };
  }
}
