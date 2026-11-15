import React, { useId, useMemo, useState } from "react";
import { outlineStatement } from "../lib/chimera/ast-outline.js";
import { compareQuery, type PlanSide } from "../lib/chimera/compare.js";
import type { PlanNode } from "../lib/chimera/query-planner.js";
import { MAX_SQL_LENGTH } from "../lib/chimera/sql-parser.js";
import { formatMs } from "./format.js";
import { applyQuerySql, batchQuery, getLabNetwork, injectIndex, setLab, useLab } from "./lab-store.js";

export interface SqlAstExecutionCompareProps {
  readonly heading: string;
  readonly showAst: boolean;
}

/** The scan that decides the plan's cost: a full-table Seq Scan if there is one, else the first scan node. */
export function primaryScan(root: PlanNode): string {
  let first: string | null = null;
  let full = false;
  const visit = (n: PlanNode) => {
    if (n.fullScan) full = true;
    if (first === null && (n.type === "Seq Scan" || n.type === "Index Scan")) first = n.type;
    n.children.forEach(visit);
  };
  visit(root);
  return full ? "Seq Scan" : (first ?? root.type);
}

const PlanPanel: React.FC<{ readonly title: string; readonly side: PlanSide; readonly tone: "before" | "after" }> = ({ title, side, tone }) => {
  const scan = primaryScan(side.plan.root);
  return (
    <div className="space-y-2" data-testid={`chimera-plan-${tone}`}>
      <p className={`chimera-mono text-[11px] font-semibold ${side.fullScan ? "chimera-mutation" : tone === "after" ? "chimera-flux" : "chimera-synapse"}`}>
        {`${title} (${scan}: ${formatMs(side.perRequestMs)})`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className={`chimera-badge ${side.fullScan ? "chimera-mutation" : "chimera-flux"}`}>
          {side.fullScan ? "▲ full-table scan" : "● index path"}
        </span>
        <span className="chimera-badge chimera-muted">{side.callsPerRequest} call(s) / request</span>
        <span className="chimera-badge chimera-muted">cost {side.plan.totalCost.toFixed(0)}</span>
      </div>
      <p className="chimera-mono text-[11px] chimera-muted">{side.shape}</p>
      <pre className="chimera-code" aria-label={`${title} EXPLAIN`}>
        {side.explain}
      </pre>
    </div>
  );
};

/**
 * SQL command deck: edit a query, inspect its parse tree, and compare the plan before and after
 * the recommended index migrations (and N+1 batching). Figures are planner estimates of
 * execution time per request; the live network adds round trips and queueing on top.
 */
export const SqlAstExecutionCompare: React.FC<SqlAstExecutionCompareProps> = ({ heading, showAst }) => {
  const mode = useLab((s) => s.mode);
  const scenarioId = useLab((s) => s.scenarioId);
  const selectedQueryId = useLab((s) => s.selectedQueryId);
  const feedHead = useLab((s) => s.feed[0]?.seq ?? 0);
  const queries = useLab((s) => s.telemetry.queries);
  const [draft, setDraft] = useState<{ readonly queryId: string; readonly sql: string } | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const textareaId = useId();

  const query = queries.find((q) => q.id === selectedQueryId) ?? queries[0];
  const queryId = query?.id ?? "";
  const dominantSinkId = query?.dominantSinkId ?? null;
  const network = getLabNetwork();
  const liveSql = network.getQuery(queryId)?.sql ?? "";
  const editing = draft !== null && draft.queryId === queryId ? draft.sql : null;
  const sql = editing ?? liveSql;
  const dirty = editing !== null && editing !== liveSql;

  // Re-plan only when the SQL, the scenario, an intervention (feed head) or the dominant sink
  // changes. Those last three are not read inside the memo: they signal changes to state the
  // network holds (indexes, rewritten SQL, routing).
  const comparison = useMemo(
    () => (queryId ? compareQuery(network, queryId, sql) : null),
    [network, scenarioId, queryId, sql, feedHead, dominantSinkId],
  );
  const outline = useMemo(() => (comparison?.ok ? outlineStatement(comparison.stmt) : null), [comparison]);

  if (mode !== "workbench") return null;

  const selectQuery = (id: string) => {
    setDraft(null);
    setApplyError(null);
    setLab({ selectedQueryId: id });
  };
  const applySql = () => {
    if (editing === null) return;
    const error = applyQuerySql(queryId, editing);
    setApplyError(error);
    if (error === null) setDraft(null);
  };

  return (
    <section data-chimera-area="sql" className="chimera-panel space-y-3" aria-label={heading} data-testid="chimera-sql-compare">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="chimera-heading">{heading}</h2>
        <label className="flex items-center gap-2 chimera-mono text-[11px] chimera-muted">
          Query
          <select className="chimera-input !w-auto !py-1" value={queryId} onChange={(e) => selectQuery(e.target.value)}>
            {queries.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query && (
        <p className="chimera-mono text-[11px] chimera-muted">
          Live in the network: {formatMs(query.requestLatencyMs)} per request incl. network and queueing ·{" "}
          {query.statementsPerSecond.toFixed(0)} stmt/s
          {query.timedOut ? <span className="chimera-mutation"> · ▲ hit statement_timeout</span> : null}
          {query.status === "failed" ? <span className="chimera-mutation"> · ✕ {query.failureReason}</span> : null}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor={textareaId} className="chimera-mono text-[11px] chimera-muted">
          SQL {dirty ? "· WHAT-IF: planning your edit. Apply SQL to load it into the network." : "· live statement"}
        </label>
        <textarea
          id={textareaId}
          className="chimera-input"
          rows={5}
          spellCheck={false}
          maxLength={MAX_SQL_LENGTH}
          value={sql}
          onChange={(e) => {
            setApplyError(null);
            setDraft({ queryId, sql: e.target.value });
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="chimera-button" data-variant="primary" disabled={!dirty || comparison?.ok !== true} onClick={applySql}>
            Apply SQL
          </button>
          <button type="button" className="chimera-button" disabled={editing === null} onClick={() => setDraft(null)}>
            Reset
          </button>
        </div>
        {applyError && (
          <p role="alert" className="chimera-mono text-[11px] chimera-mutation">
            ✕ {applyError}
          </p>
        )}
      </div>

      {comparison && !comparison.ok && (
        <div role="alert" className="space-y-1">
          <p className="chimera-mono text-[11px] chimera-mutation">✕ {comparison.error}</p>
          {comparison.offset !== null && (
            <pre className="chimera-code !max-h-24" aria-label="Error position">
              {`${sql.slice(Math.max(0, comparison.offset - 40), comparison.offset + 40).replace(/\s/g, " ")}\n${" ".repeat(
                Math.min(40, comparison.offset),
              )}^`}
            </pre>
          )}
        </div>
      )}

      {comparison?.ok && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <PlanPanel title="BEFORE" side={comparison.before} tone="before" />
            <PlanPanel title="AFTER KIRO CREW OPTIMIZATION" side={comparison.after} tone="after" />
          </div>
          <p className="chimera-mono text-[11px] chimera-muted">
            Planned on {comparison.sinkId} ({comparison.datasetId}). PostgreSQL-style cost model; estimates, not measurements.
          </p>

          <div className="space-y-2" data-testid="chimera-migrations">
            <p className="chimera-heading">Migrations</p>
            {comparison.migrations.length === 0 && comparison.rewriteSql === null && (
              <p className="chimera-mono text-[11px] chimera-flux">● No index or rewrite lowers this query's cost.</p>
            )}
            {comparison.migrations.map((rec) => (
              <div key={rec.index.name} className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <code className="chimera-mono block break-all text-[11px] chimera-synapse">{rec.ddl}</code>
                  <p className="chimera-mono text-[10px] chimera-muted">
                    {rec.reason} · cost {rec.costBefore.toFixed(0)} → {rec.costAfter.toFixed(0)}
                  </p>
                </div>
                <button
                  type="button"
                  className="chimera-button"
                  disabled={dirty}
                  onClick={() => injectIndex(comparison.datasetId, rec.index)}
                >
                  Apply
                </button>
              </div>
            ))}
            {comparison.rewriteSql !== null && (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <code className="chimera-mono block break-all text-[11px] chimera-synapse">{comparison.rewriteSql}</code>
                  <p className="chimera-mono text-[10px] chimera-muted">
                    Batch the N+1 loop: {comparison.before.callsPerRequest} statements per request become 1.
                  </p>
                </div>
                <button type="button" className="chimera-button" disabled={dirty} onClick={() => batchQuery(queryId)}>
                  Batch
                </button>
              </div>
            )}
            {comparison.migrations.length + (comparison.rewriteSql ? 1 : 0) > 1 && (
              <button
                type="button"
                className="chimera-button"
                data-variant="primary"
                disabled={dirty}
                onClick={() => {
                  for (const rec of comparison.migrations) injectIndex(comparison.datasetId, rec.index);
                  if (comparison.rewriteSql) batchQuery(queryId);
                }}
              >
                Apply all {comparison.migrations.length + (comparison.rewriteSql ? 1 : 0)} migrations
              </button>
            )}
            {dirty && <p className="chimera-mono text-[10px] chimera-muted">Apply or reset your SQL edit before migrating.</p>}
          </div>

          {showAst && outline && (
            <details className="space-y-1" data-testid="chimera-ast-inspector">
              <summary className="chimera-heading cursor-pointer">AST inspector ({outline.lines.length} nodes)</summary>
              <ul className="chimera-code !whitespace-normal" aria-label="Parse tree">
                {outline.lines.map((line, i) => (
                  <li key={i} style={{ paddingLeft: `${line.depth * 14}px` }}>
                    <span className="chimera-flux">{line.node}</span>
                    {line.detail ? <span className="chimera-muted"> {line.detail}</span> : null}
                  </li>
                ))}
                {outline.truncated && <li className="chimera-synapse">… outline truncated</li>}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
};
