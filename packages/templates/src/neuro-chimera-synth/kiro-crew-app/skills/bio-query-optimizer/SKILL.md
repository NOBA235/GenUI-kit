---
name: bio-query-optimizer
description: Find slow SQL, N+1 query loops and missing composite indexes in a PostgreSQL-backed codebase, propose safe fixes, and report them as tables or @json-render patches.
always: false
triggers: slow query, n+1, explain plan, missing index, composite index, query optimization, sequential scan, chimera audit
---

# Bio-Query Optimizer

Think of request traffic as a slime mould looking for food. Every query path is a tube. Cheap, indexed paths get reinforced; expensive paths starve. Your job is to find the starving tubes and show how to feed them.

## 1. Gather evidence (read-only)
1. Schema: read migrations or ORM models. With a read-only database URL, use `psql "$CHIMERA_DATABASE_URL" -c '\d+ <table>'` and `SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20;`.
2. Slow statements: if `pg_stat_statements` is enabled, read `SELECT query, calls, mean_exec_time, rows FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;`.
3. Recent changes: `git log --since="6 hours ago" --stat` and `git log -p` on data-access files.
4. Plans: `EXPLAIN (FORMAT TEXT) <query>` with representative parameter values.
   - `EXPLAIN ANALYZE` executes the statement. Only run it on a replica, or wrap it in `BEGIN; ... ROLLBACK;`.
   - Never run `EXPLAIN ANALYZE` on statements that write.

## 2. Read an EXPLAIN plan
- `Seq Scan on orders (cost=0.00..18334.00 rows=1 width=97)` reads every page of the table. It is fine on small tables and a problem above about 10,000 rows when only a few rows match.
- `cost=a..b` means a is the startup cost and b is the total cost, in planner units (`seq_page_cost = 1`). Rows are estimates.
- `Index Scan using idx_orders_user_id on orders` uses a B-tree descent and then fetches heap pages.
- `Bitmap Heap Scan` + `Bitmap Index Scan` gathers many matches, or ORs several indexes.
- `Nested Loop` with an inner `Index Scan` is cheap per outer row. A `Nested Loop` with an inner `Seq Scan` is a red flag.
- `Hash Join` builds a hash of the inner input and is good for large unsorted joins.
- `Sort` above a scan, when an `ORDER BY ... LIMIT` exists, means an index on the sort column could stop the sort early.
- With `ANALYZE, BUFFERS`: compare `rows=` estimated against actual. A 10× miss means stale statistics, so run `ANALYZE <table>`. `shared read` counts pages read from disk.

## 3. Detect N+1 loops
An N+1 loop is one query for a list, then one query per item:
```ts
const posts = await db.query("SELECT id, author_id FROM posts WHERE feed_id = $1", [feedId]);
for (const post of posts) {
  post.author = await db.query("SELECT * FROM users WHERE id = $1", [post.author_id]); // N queries
}
```
Signals:
- An `await` query, or an ORM lazy load (`post.author`, `.related()`), inside `for` / `map` / `forEach`.
- `pg_stat_statements` shows a statement with a huge `calls` count and tiny `rows` per call.
- Logs show the same statement with different id parameters in a burst.

Batched rewrite: one round trip, then group in memory.
```sql
SELECT * FROM users WHERE id = ANY($1);   -- $1 = array of author ids
```
Or join directly:
```sql
SELECT p.id, u.name FROM posts p JOIN users u ON u.id = p.author_id WHERE p.feed_id = $1;
```
ORM equivalents: Prisma `include`, Django `select_related` / `prefetch_related`, Rails `includes`, SQLAlchemy `selectinload`.

## 4. Design composite indexes
For one query, order the B-tree columns like this:
1. **Equality** columns (`col = $1`, `col IN (...)`). Put the most selective first when several queries share a prefix.
2. **Sort** column, when the query has `ORDER BY col [DESC] LIMIT n`. The index then returns rows in order and the scan stops after n rows.
3. **Range** column (`>`, `<`, `BETWEEN`). Anything after a range column cannot be used for ordering.

Example: `WHERE tenant_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 50`
```sql
CREATE INDEX CONCURRENTLY idx_tickets_tenant_status_created
  ON tickets (tenant_id, status, created_at DESC);
```
Rules:
- Always use `CREATE INDEX CONCURRENTLY` on live tables. It cannot run inside a transaction block.
- An index on `(a, b)` also serves queries on `a` alone. Do not add a separate index on `a`.
- Use partial indexes for hot subsets: `... WHERE status = 'open'`.
- Every index slows writes and uses disk. Prefer one composite index over several single-column ones.
- For pgvector, `ORDER BY embedding <=> $1 LIMIT k` needs an HNSW or IVFFlat index with the matching operator class (`vector_cosine_ops` for `<=>`, `vector_l2_ops` for `<->`, `vector_ip_ops` for `<#>`).

## 5. Report findings
Lead with a table:

| Severity | Finding | Location | Est. cost before → after | Proposed fix |
| --- | --- | --- | --- | --- |
| High | Seq Scan on `orders` (2.1M rows) | `src/checkout.ts:88` | 41,250 → 8.6 | `CREATE INDEX CONCURRENTLY idx_orders_user_status ON orders (user_id, status);` |

Say whether costs are EXPLAIN estimates or measured ANALYZE timings. Never claim a measured speed-up you did not measure.

## 6. Emit @json-render patches (on request)
When asked to update a GenUI dashboard, output RFC 6902 JSON Patch lines, one JSON object per line (JSONL). Only use element types that exist in the target catalog, and keep paths under `/elements/<key>/...` or `/state/...`:
```jsonl
{"op":"add","path":"/elements/finding-orders-seq-scan","value":{"type":"<CatalogComponent>","props":{"title":"Seq Scan on orders","severity":"high","costBefore":41250,"costAfter":8.6},"children":[]}}
{"op":"add","path":"/elements/findings-list/children/-","value":"finding-orders-seq-scan"}
```
Never emit raw HTML, script tags or `javascript:` URLs in props.

## 7. Safety
- Propose. Do not apply. DDL, migrations and code edits need the user's explicit approval for the exact change.
- Use read-only credentials. Never echo connection strings or passwords.
- Large index builds on big tables take time and I/O. Mention table size and suggest an off-peak window.
