/**
 * CHIMERA // LAB scenarios (`lib/chimera/scenarios.ts`).
 *
 * Six database and multi-agent scenarios. Row counts, page counts and distinct counts are
 * representative of production systems at that scale (8 KB pages); they are illustrative, not
 * measurements of any real deployment. Every query runs through the real parser and planner.
 */

import type { Dataset, IndexDef, TableStats } from "./query-planner.js";
import { PhysarumNetwork, type ScenarioSpec } from "./bio-solver.js";

function table(name: string, rows: number, pages: number, columns: Record<string, number>): TableStats {
  return {
    name,
    rows,
    pages,
    columns: Object.fromEntries(Object.entries(columns).map(([c, nDistinct]) => [c, { nDistinct }])),
  };
}

function btree(name: string, tableName: string, columns: string[], descending?: boolean[]): IndexDef {
  return descending ? { name, table: tableName, columns, descending, method: "btree" } : { name, table: tableName, columns, method: "btree" };
}

function dataset(id: string, label: string, tables: TableStats[], indexes: IndexDef[]): Dataset {
  return { id, label, tables: Object.fromEntries(tables.map((t) => [t.name, t])), indexes };
}

/* ═══════════════════════════ 1. Unindexed checkout spike ═══════════════════════════ */

const checkoutSpike: ScenarioSpec = {
  id: "checkout-spike",
  title: "Unindexed E-Commerce Checkout Spike",
  summary:
    "A flash sale floods checkout. Open-order lookups and line-item reads hit sequential scans on 4.2M orders and 11.8M order items, and the replicas saturate.",
  datasets: {
    shop: dataset(
      "shop",
      "shop (PostgreSQL 17)",
      [
        table("orders", 4_200_000, 52_000, { id: 4_200_000, user_id: 380_000, status: 6, created_at: 4_100_000, total_cents: 90_000 }),
        table("order_items", 11_800_000, 98_000, { id: 11_800_000, order_id: 4_200_000, product_id: 52_000, quantity: 40 }),
        table("products", 52_000, 900, { id: 52_000, sku: 52_000, price_cents: 9_000 }),
        table("inventory", 52_000, 600, { id: 52_000, product_id: 52_000, warehouse_id: 12, quantity: 3_000 }),
      ],
      [
        btree("orders_pkey", "orders", ["id"]),
        btree("order_items_pkey", "order_items", ["id"]),
        btree("products_pkey", "products", ["id"]),
        btree("inventory_product_warehouse", "inventory", ["product_id", "warehouse_id"]),
      ],
    ),
  },
  nodes: [
    { id: "edge", label: "Edge Gateway", kind: "gateway", x: 0.08, y: 0.5 },
    { id: "checkout-api-1", label: "Checkout API 1", kind: "service", x: 0.34, y: 0.28 },
    { id: "checkout-api-2", label: "Checkout API 2", kind: "service", x: 0.34, y: 0.72 },
    { id: "pg-primary", label: "PG Primary", kind: "primary", x: 0.68, y: 0.5, datasetId: "shop", workers: 32 },
    { id: "pg-replica-1", label: "PG Replica 1", kind: "replica", x: 0.9, y: 0.24, datasetId: "shop", workers: 16 },
    { id: "pg-replica-2", label: "PG Replica 2", kind: "replica", x: 0.9, y: 0.76, datasetId: "shop", workers: 16 },
  ],
  links: [
    { a: "edge", b: "checkout-api-1", latencyMs: 1.2 },
    { a: "edge", b: "checkout-api-2", latencyMs: 1.2 },
    { a: "checkout-api-1", b: "pg-primary", latencyMs: 0.6 },
    { a: "checkout-api-2", b: "pg-primary", latencyMs: 0.6 },
    { a: "checkout-api-1", b: "pg-replica-1", latencyMs: 0.8 },
    { a: "checkout-api-2", b: "pg-replica-2", latencyMs: 0.8 },
    { a: "checkout-api-1", b: "pg-replica-2", latencyMs: 1.6 },
    { a: "checkout-api-2", b: "pg-replica-1", latencyMs: 1.6 },
    { a: "pg-primary", b: "pg-replica-1", latencyMs: 0.4 },
    { a: "pg-primary", b: "pg-replica-2", latencyMs: 0.4 },
  ],
  queries: [
    {
      id: "open-orders",
      label: "Load open orders for user",
      sql: "SELECT id, total_cents FROM orders WHERE user_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 20",
      source: "edge",
      sinks: ["pg-replica-1", "pg-replica-2", "pg-primary"],
      requestsPerSecond: 120,
    },
    {
      id: "line-items",
      label: "Order line items with SKU",
      sql: "SELECT oi.product_id, oi.quantity, p.sku FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1",
      source: "edge",
      sinks: ["pg-replica-1", "pg-replica-2", "pg-primary"],
      requestsPerSecond: 300,
    },
    {
      id: "stock-check",
      label: "Warehouse stock check",
      sql: "SELECT quantity FROM inventory WHERE product_id = $1 AND warehouse_id = $2",
      source: "edge",
      sinks: ["pg-replica-1", "pg-replica-2", "pg-primary"],
      requestsPerSecond: 800,
    },
  ],
};

/* ═══════════════════════════ 2. N+1 social feed ═══════════════════════════ */

const socialFeed: ScenarioSpec = {
  id: "social-feed-n1",
  title: "N+1 Social Feed Graph",
  summary:
    "The feed query is indexed, but the app hydrates each of 50 posts with its own author lookup and like count: 101 round trips per page view.",
  datasets: {
    social: dataset(
      "social",
      "social (PostgreSQL 17)",
      [
        table("users", 2_100_000, 30_000, { id: 2_100_000, handle: 2_100_000, avatar_url: 1_900_000 }),
        table("posts", 28_000_000, 410_000, { id: 28_000_000, author_id: 1_900_000, created_at: 27_000_000, body: 27_500_000 }),
        table("follows", 160_000_000, 1_100_000, { follower_id: 2_000_000, followee_id: 2_000_000 }),
        table("likes", 900_000_000, 4_500_000, { post_id: 26_000_000, user_id: 2_000_000 }),
      ],
      [
        btree("users_pkey", "users", ["id"]),
        btree("posts_pkey", "posts", ["id"]),
        btree("posts_author_created", "posts", ["author_id", "created_at"]),
        btree("follows_pkey", "follows", ["follower_id", "followee_id"]),
        btree("likes_post_id", "likes", ["post_id"]),
      ],
    ),
  },
  nodes: [
    { id: "mobile-gateway", label: "Mobile Gateway", kind: "gateway", x: 0.08, y: 0.5 },
    { id: "feed-svc-1", label: "Feed Service 1", kind: "service", x: 0.36, y: 0.3 },
    { id: "feed-svc-2", label: "Feed Service 2", kind: "service", x: 0.36, y: 0.7 },
    { id: "social-primary", label: "Social Primary", kind: "primary", x: 0.7, y: 0.5, datasetId: "social", workers: 32 },
    { id: "social-replica-1", label: "Social Replica 1", kind: "replica", x: 0.9, y: 0.22, datasetId: "social", workers: 24 },
    { id: "social-replica-2", label: "Social Replica 2", kind: "replica", x: 0.9, y: 0.78, datasetId: "social", workers: 24 },
  ],
  links: [
    { a: "mobile-gateway", b: "feed-svc-1", latencyMs: 1.5 },
    { a: "mobile-gateway", b: "feed-svc-2", latencyMs: 1.5 },
    { a: "feed-svc-1", b: "social-replica-1", latencyMs: 0.9 },
    { a: "feed-svc-2", b: "social-replica-2", latencyMs: 0.9 },
    { a: "feed-svc-1", b: "social-primary", latencyMs: 1.1 },
    { a: "feed-svc-2", b: "social-primary", latencyMs: 1.1 },
    { a: "feed-svc-1", b: "feed-svc-2", latencyMs: 0.5 },
    { a: "social-primary", b: "social-replica-1", latencyMs: 0.4 },
    { a: "social-primary", b: "social-replica-2", latencyMs: 0.4 },
  ],
  queries: [
    {
      id: "feed-timeline",
      label: "Home timeline (50 posts)",
      sql: "SELECT p.id, p.author_id, p.created_at FROM follows f JOIN posts p ON p.author_id = f.followee_id WHERE f.follower_id = $1 ORDER BY p.created_at DESC LIMIT 50",
      source: "mobile-gateway",
      sinks: ["social-replica-1", "social-replica-2", "social-primary"],
      requestsPerSecond: 40,
    },
    {
      id: "author-hydrate",
      label: "Author lookup per post (N+1)",
      sql: "SELECT id, handle, avatar_url FROM users WHERE id = $1",
      source: "mobile-gateway",
      sinks: ["social-replica-1", "social-replica-2", "social-primary"],
      requestsPerSecond: 40,
      perRequestCalls: 50,
    },
    {
      id: "like-count",
      label: "Like count per post (N+1)",
      sql: "SELECT COUNT(*) FROM likes WHERE post_id = $1",
      source: "mobile-gateway",
      sinks: ["social-replica-1", "social-replica-2", "social-primary"],
      requestsPerSecond: 40,
      perRequestCalls: 50,
    },
  ],
};

/* ═══════════════════════════ 3. Vector shard imbalance ═══════════════════════════ */

const chunkColumns = (rows: number) => ({ id: rows, doc_id: Math.round(rows / 7.5), embedding: rows, content: rows });

const vectorShards: ScenarioSpec = {
  id: "vector-shard-imbalance",
  title: "Vector Embedding Shard Imbalance",
  summary:
    "Tenant A's shard holds 18M chunks and lost its HNSW index in a migration, so every retrieval sorts 18M cosine distances. Tenant B's shard is fine.",
  datasets: {
    "shard-a": dataset(
      "shard-a",
      "shard-a (pgvector 0.8, 1536 dims)",
      [table("chunks", 18_000_000, 2_400_000, chunkColumns(18_000_000))],
      [btree("chunks_pkey", "chunks", ["id"])],
    ),
    "shard-b": dataset(
      "shard-b",
      "shard-b (pgvector 0.8, 1536 dims)",
      [table("chunks", 3_000_000, 400_000, chunkColumns(3_000_000))],
      [
        btree("chunks_pkey", "chunks", ["id"]),
        { name: "chunks_embedding_hnsw", table: "chunks", columns: ["embedding"], method: "hnsw", opclass: "vector_cosine_ops" },
      ],
    ),
    docs: dataset(
      "docs",
      "docs (PostgreSQL 17)",
      [table("documents", 2_400_000, 40_000, { id: 2_400_000, title: 2_300_000, source_url: 2_400_000 })],
      [btree("documents_pkey", "documents", ["id"])],
    ),
  },
  nodes: [
    { id: "rag-gateway", label: "RAG Gateway", kind: "gateway", x: 0.08, y: 0.5 },
    { id: "retriever-agent", label: "Retriever Agent", kind: "agent", x: 0.36, y: 0.5 },
    { id: "shard-a-1", label: "Shard A-1", kind: "shard", x: 0.72, y: 0.16, datasetId: "shard-a", workers: 16 },
    { id: "shard-a-2", label: "Shard A-2", kind: "shard", x: 0.92, y: 0.34, datasetId: "shard-a", workers: 16 },
    { id: "shard-b-1", label: "Shard B-1", kind: "shard", x: 0.72, y: 0.84, datasetId: "shard-b", workers: 16 },
    { id: "docs-primary", label: "Docs Primary", kind: "primary", x: 0.92, y: 0.64, datasetId: "docs", workers: 16 },
  ],
  links: [
    { a: "rag-gateway", b: "retriever-agent", latencyMs: 2 },
    { a: "retriever-agent", b: "shard-a-1", latencyMs: 1.2 },
    { a: "retriever-agent", b: "shard-a-2", latencyMs: 1.4 },
    { a: "retriever-agent", b: "shard-b-1", latencyMs: 1.2 },
    { a: "retriever-agent", b: "docs-primary", latencyMs: 1 },
    { a: "shard-a-1", b: "shard-a-2", latencyMs: 0.5 },
  ],
  queries: [
    {
      id: "rag-tenant-a",
      label: "Top-8 chunks (tenant A)",
      sql: "SELECT id, doc_id FROM chunks ORDER BY embedding <=> $1 LIMIT 8",
      source: "rag-gateway",
      sinks: ["shard-a-1", "shard-a-2"],
      requestsPerSecond: 60,
    },
    {
      id: "rag-tenant-b",
      label: "Top-8 chunks (tenant B)",
      sql: "SELECT id, doc_id FROM chunks ORDER BY embedding <=> $1 LIMIT 8",
      source: "rag-gateway",
      sinks: ["shard-b-1"],
      requestsPerSecond: 25,
    },
    {
      id: "doc-metadata",
      label: "Citation metadata batch",
      sql: "SELECT id, title, source_url FROM documents WHERE id = ANY($1)",
      source: "rag-gateway",
      sinks: ["docs-primary"],
      requestsPerSecond: 85,
      arrayParamLength: 8,
    },
  ],
};

/* ═══════════════════════════ 4. Overnight autonomous PR refactor ═══════════════════════════ */

const crewRefactor: ScenarioSpec = {
  id: "autonomous-overnight-refactor",
  title: "Overnight Autonomous PR Refactor",
  summary:
    "Four parallel coding agents refactor a monorepo overnight. The refactor agent looks up call sites one symbol at a time, and symbol_refs has no index on symbol_id.",
  datasets: {
    "code-index": dataset(
      "code-index",
      "code-index (PostgreSQL 17)",
      [
        table("symbols", 3_400_000, 52_000, { id: 3_400_000, repo_id: 40, name: 900_000, path: 220_000, kind: 12 }),
        table("symbol_refs", 41_000_000, 380_000, { id: 41_000_000, symbol_id: 3_400_000, file_id: 220_000, line: 5_000 }),
        table("files", 220_000, 4_000, { id: 220_000, path: 220_000, repo_id: 40 }),
      ],
      [btree("symbols_pkey", "symbols", ["id"]), btree("symbols_repo_name", "symbols", ["repo_id", "name"]), btree("files_pkey", "files", ["id"])],
    ),
    ci: dataset(
      "ci",
      "ci (PostgreSQL 17)",
      [
        table("test_runs", 9_000_000, 110_000, { id: 9_000_000, pr_id: 120_000, status: 4, started_at: 8_900_000 }),
        table("pull_requests", 120_000, 2_600, { id: 120_000, repo_id: 40, state: 3, updated_at: 119_000, title: 118_000 }),
      ],
      [btree("test_runs_pkey", "test_runs", ["id"]), btree("test_runs_pr_id", "test_runs", ["pr_id"]), btree("pull_requests_pkey", "pull_requests", ["id"])],
    ),
  },
  nodes: [
    { id: "crew-gateway", label: "Agent Gateway", kind: "gateway", x: 0.06, y: 0.5 },
    { id: "planner-agent", label: "Planner Agent", kind: "agent", x: 0.32, y: 0.14 },
    { id: "refactor-agent", label: "Refactor Agent", kind: "agent", x: 0.32, y: 0.4 },
    { id: "test-agent", label: "Test Agent", kind: "agent", x: 0.32, y: 0.64 },
    { id: "review-agent", label: "Review Agent", kind: "agent", x: 0.32, y: 0.88 },
    { id: "code-index-primary", label: "Code Index Primary", kind: "primary", x: 0.72, y: 0.22, datasetId: "code-index", workers: 16 },
    { id: "code-index-replica", label: "Code Index Replica", kind: "replica", x: 0.92, y: 0.44, datasetId: "code-index", workers: 8 },
    { id: "ci-db", label: "CI Database", kind: "primary", x: 0.78, y: 0.8, datasetId: "ci", workers: 8 },
  ],
  links: [
    { a: "crew-gateway", b: "planner-agent", latencyMs: 0.5 },
    { a: "crew-gateway", b: "refactor-agent", latencyMs: 0.5 },
    { a: "crew-gateway", b: "test-agent", latencyMs: 0.5 },
    { a: "crew-gateway", b: "review-agent", latencyMs: 0.5 },
    { a: "planner-agent", b: "code-index-primary", latencyMs: 2 },
    { a: "refactor-agent", b: "code-index-primary", latencyMs: 2 },
    { a: "refactor-agent", b: "code-index-replica", latencyMs: 2.5 },
    { a: "planner-agent", b: "code-index-replica", latencyMs: 3 },
    { a: "test-agent", b: "ci-db", latencyMs: 2 },
    { a: "review-agent", b: "ci-db", latencyMs: 2 },
    { a: "code-index-primary", b: "code-index-replica", latencyMs: 0.3 },
  ],
  queries: [
    {
      id: "symbol-lookup",
      label: "Resolve symbol by name",
      sql: "SELECT id, path FROM symbols WHERE repo_id = $1 AND name = $2",
      source: "planner-agent",
      sinks: ["code-index-primary", "code-index-replica"],
      requestsPerSecond: 20,
    },
    {
      id: "call-sites",
      label: "Call sites per symbol (N+1)",
      sql: "SELECT file_id, line FROM symbol_refs WHERE symbol_id = $1",
      source: "refactor-agent",
      sinks: ["code-index-primary", "code-index-replica"],
      requestsPerSecond: 6,
      perRequestCalls: 30,
    },
    {
      id: "flaky-history",
      label: "Test outcomes for PR",
      sql: "SELECT status, COUNT(*) FROM test_runs WHERE pr_id = $1 GROUP BY status",
      source: "test-agent",
      sinks: ["ci-db"],
      requestsPerSecond: 10,
    },
    {
      id: "stale-prs",
      label: "Stale open PRs",
      sql: "SELECT id, title FROM pull_requests WHERE state = 'open' AND updated_at < $1 ORDER BY updated_at ASC LIMIT 100",
      source: "review-agent",
      sinks: ["ci-db"],
      requestsPerSecond: 2,
    },
  ],
};

/* ═══════════════════════════ 5. Analytics hot partition ═══════════════════════════ */

const analyticsHot: ScenarioSpec = {
  id: "analytics-hot-partition",
  title: "Multi-Tenant Analytics Hot Partition",
  summary:
    "Tenant dashboards filter 220M events by tenant and time, but the only index is on occurred_at, so the planner falls back to full scans.",
  datasets: {
    warehouse: dataset(
      "warehouse",
      "warehouse (PostgreSQL 17)",
      [
        table("events", 220_000_000, 2_900_000, { id: 220_000_000, tenant_id: 4_000, event_type: 60, occurred_at: 200_000_000, user_id: 30_000_000 }),
        table("tenants", 4_000, 60, { id: 4_000, plan: 4, region: 9 }),
      ],
      [btree("events_occurred_at", "events", ["occurred_at"]), btree("tenants_pkey", "tenants", ["id"])],
    ),
  },
  nodes: [
    { id: "bi-gateway", label: "BI Gateway", kind: "gateway", x: 0.08, y: 0.5 },
    { id: "analytics-api-1", label: "Analytics API 1", kind: "service", x: 0.36, y: 0.3 },
    { id: "analytics-api-2", label: "Analytics API 2", kind: "service", x: 0.36, y: 0.7 },
    { id: "wh-primary", label: "Warehouse Primary", kind: "primary", x: 0.7, y: 0.5, datasetId: "warehouse", workers: 48 },
    { id: "wh-replica-1", label: "Warehouse Replica 1", kind: "replica", x: 0.9, y: 0.22, datasetId: "warehouse", workers: 32 },
    { id: "wh-replica-2", label: "Warehouse Replica 2", kind: "replica", x: 0.9, y: 0.78, datasetId: "warehouse", workers: 32 },
  ],
  links: [
    { a: "bi-gateway", b: "analytics-api-1", latencyMs: 1 },
    { a: "bi-gateway", b: "analytics-api-2", latencyMs: 1 },
    { a: "analytics-api-1", b: "wh-replica-1", latencyMs: 0.7 },
    { a: "analytics-api-2", b: "wh-replica-2", latencyMs: 0.7 },
    { a: "analytics-api-1", b: "wh-primary", latencyMs: 0.9 },
    { a: "analytics-api-2", b: "wh-primary", latencyMs: 0.9 },
    { a: "wh-primary", b: "wh-replica-1", latencyMs: 0.4 },
    { a: "wh-primary", b: "wh-replica-2", latencyMs: 0.4 },
  ],
  queries: [
    {
      id: "tenant-dashboard",
      label: "Tenant dashboard, last 24h",
      sql: "SELECT event_type, COUNT(*) FROM events WHERE tenant_id = $1 AND occurred_at >= $2 GROUP BY event_type",
      source: "bi-gateway",
      sinks: ["wh-replica-1", "wh-replica-2", "wh-primary"],
      requestsPerSecond: 30,
    },
    {
      id: "top-buyers",
      label: "Top 10 purchasers",
      sql: "SELECT user_id, COUNT(*) FROM events WHERE tenant_id = $1 AND event_type = 'purchase' GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 10",
      source: "bi-gateway",
      sinks: ["wh-replica-1", "wh-replica-2", "wh-primary"],
      requestsPerSecond: 5,
    },
    {
      id: "tenant-lookup",
      label: "Tenant plan lookup",
      sql: "SELECT plan, region FROM tenants WHERE id = $1",
      source: "bi-gateway",
      sinks: ["wh-replica-1", "wh-replica-2", "wh-primary"],
      requestsPerSecond: 200,
    },
  ],
};

/* ═══════════════════════════ 6. Ride dispatch region failover ═══════════════════════════ */

const rideFailover: ScenarioSpec = {
  id: "ride-dispatch-failover",
  title: "Ride-Hailing Dispatch Region Failover",
  summary:
    "Dispatch runs in two regions over one replicated database. Sever the east region and watch traffic reroute across the 70 ms inter-region link.",
  datasets: {
    dispatch: dataset(
      "dispatch",
      "dispatch (PostgreSQL 17)",
      [
        table("drivers", 1_400_000, 21_000, { id: 1_400_000, city_id: 900, status: 5, geohash: 600_000, updated_at: 1_390_000 }),
        table("trips", 380_000_000, 5_200_000, { id: 380_000_000, rider_id: 60_000_000, status: 6, requested_at: 370_000_000 }),
        table("surge_zones", 18_000, 220, { id: 18_000, city_id: 900, geohash: 18_000, multiplier: 40 }),
      ],
      [
        btree("drivers_pkey", "drivers", ["id"]),
        btree("drivers_city_status", "drivers", ["city_id", "status"]),
        btree("trips_pkey", "trips", ["id"]),
        btree("trips_rider_id", "trips", ["rider_id"]),
        btree("surge_zones_pkey", "surge_zones", ["id"]),
      ],
    ),
  },
  nodes: [
    { id: "gateway-east", label: "Gateway us-east", kind: "gateway", x: 0.06, y: 0.28 },
    { id: "gateway-west", label: "Gateway us-west", kind: "gateway", x: 0.06, y: 0.74 },
    { id: "dispatch-east", label: "Dispatch us-east", kind: "service", x: 0.34, y: 0.28 },
    { id: "dispatch-west", label: "Dispatch us-west", kind: "service", x: 0.34, y: 0.74 },
    { id: "pg-east-primary", label: "PG us-east Primary", kind: "primary", x: 0.72, y: 0.16, datasetId: "dispatch", workers: 32 },
    { id: "pg-east-replica", label: "PG us-east Replica", kind: "replica", x: 0.92, y: 0.36, datasetId: "dispatch", workers: 16 },
    { id: "pg-west-replica", label: "PG us-west Replica", kind: "replica", x: 0.8, y: 0.82, datasetId: "dispatch", workers: 16 },
  ],
  links: [
    { a: "gateway-east", b: "dispatch-east", latencyMs: 0.8 },
    { a: "gateway-west", b: "dispatch-west", latencyMs: 0.8 },
    { a: "dispatch-east", b: "pg-east-primary", latencyMs: 0.5 },
    { a: "dispatch-east", b: "pg-east-replica", latencyMs: 0.6 },
    { a: "dispatch-west", b: "pg-west-replica", latencyMs: 0.5 },
    { a: "dispatch-east", b: "dispatch-west", latencyMs: 70 },
    { a: "pg-east-primary", b: "pg-east-replica", latencyMs: 0.3 },
    { a: "pg-east-primary", b: "pg-west-replica", latencyMs: 68 },
  ],
  queries: [
    {
      id: "nearby-drivers-east",
      label: "Nearby drivers (east riders)",
      sql: "SELECT id, geohash FROM drivers WHERE city_id = $1 AND status = 'available' AND geohash LIKE $2 LIMIT 40",
      source: "gateway-east",
      sinks: ["pg-east-replica", "pg-east-primary", "pg-west-replica"],
      requestsPerSecond: 400,
    },
    {
      id: "nearby-drivers-west",
      label: "Nearby drivers (west riders)",
      sql: "SELECT id, geohash FROM drivers WHERE city_id = $1 AND status = 'available' AND geohash LIKE $2 LIMIT 40",
      source: "gateway-west",
      sinks: ["pg-west-replica", "pg-east-replica", "pg-east-primary"],
      requestsPerSecond: 250,
    },
    {
      id: "rider-active-trip",
      label: "Rider's active trip",
      sql: "SELECT id, status FROM trips WHERE rider_id = $1 AND status = 'active' LIMIT 1",
      source: "gateway-east",
      sinks: ["pg-east-replica", "pg-east-primary", "pg-west-replica"],
      requestsPerSecond: 300,
    },
    {
      id: "surge-multiplier",
      label: "Surge multiplier for zone",
      sql: "SELECT multiplier FROM surge_zones WHERE city_id = $1 AND geohash = $2",
      source: "gateway-west",
      sinks: ["pg-west-replica", "pg-east-replica", "pg-east-primary"],
      requestsPerSecond: 650,
    },
  ],
};

/* ═══════════════════════════ 7. Genomics pipeline ═══════════════════════════ */

const genomicsPipeline: ScenarioSpec = {
  id: "genomics-pipeline",
  title: "Biotech Genomics Pipeline & Protein Fold Search",
  summary:
    "Variant-calling workers query 850M variants by genomic region with no (chrom, pos) index, and the folding agent ranks 220k protein structures by embedding distance without an HNSW index.",
  datasets: {
    variants: dataset(
      "variants",
      "variants (PostgreSQL 17)",
      [
        table("variants", 850_000_000, 11_000_000, { id: 850_000_000, sample_id: 120_000, chrom: 25, pos: 250_000_000, gene_id: 20_000, allele: 12 }),
        table("samples", 120_000, 2_000, { id: 120_000, cohort_id: 300 }),
        table("genes", 20_000, 300, { id: 20_000, symbol: 20_000 }),
      ],
      [btree("variants_pkey", "variants", ["id"]), btree("samples_pkey", "samples", ["id"]), btree("genes_pkey", "genes", ["id"]), btree("genes_symbol", "genes", ["symbol"])],
    ),
    structures: dataset(
      "structures",
      "structures (pgvector 0.8, 1024 dims)",
      [table("protein_structures", 220_000, 180_000, { id: 220_000, uniprot_id: 220_000, fold_embedding: 220_000, plddt: 1_000 })],
      [btree("protein_structures_pkey", "protein_structures", ["id"])],
    ),
  },
  nodes: [
    { id: "lims-gateway", label: "LIMS Gateway", kind: "gateway", x: 0.06, y: 0.5 },
    { id: "alignment-worker", label: "Alignment Worker", kind: "agent", x: 0.34, y: 0.28 },
    { id: "folding-agent", label: "Folding Agent", kind: "agent", x: 0.34, y: 0.74 },
    { id: "variant-primary", label: "Variant Store Primary", kind: "primary", x: 0.72, y: 0.18, datasetId: "variants", workers: 48 },
    { id: "variant-replica", label: "Variant Store Replica", kind: "replica", x: 0.92, y: 0.42, datasetId: "variants", workers: 32 },
    { id: "structure-db", label: "Structure DB", kind: "primary", x: 0.8, y: 0.82, datasetId: "structures", workers: 16 },
  ],
  links: [
    { a: "lims-gateway", b: "alignment-worker", latencyMs: 1 },
    { a: "lims-gateway", b: "folding-agent", latencyMs: 1 },
    { a: "alignment-worker", b: "variant-primary", latencyMs: 0.8 },
    { a: "alignment-worker", b: "variant-replica", latencyMs: 1 },
    { a: "folding-agent", b: "structure-db", latencyMs: 0.8 },
    { a: "folding-agent", b: "variant-replica", latencyMs: 1.5 },
    { a: "variant-primary", b: "variant-replica", latencyMs: 0.3 },
  ],
  queries: [
    {
      id: "region-variants",
      label: "Region browser page (500 variants)",
      sql: "SELECT sample_id, pos, allele FROM variants WHERE chrom = $1 AND pos BETWEEN $2 AND $3 ORDER BY pos ASC LIMIT 500",
      source: "alignment-worker",
      sinks: ["variant-replica", "variant-primary"],
      requestsPerSecond: 25,
    },
    {
      id: "gene-burden",
      label: "Gene burden for a 50-sample cohort",
      sql: "SELECT sample_id, COUNT(*) FROM variants WHERE gene_id = $1 AND sample_id = ANY($2) GROUP BY sample_id",
      source: "alignment-worker",
      sinks: ["variant-replica", "variant-primary"],
      requestsPerSecond: 10,
      arrayParamLength: 50,
    },
    {
      id: "similar-folds",
      label: "Nearest protein folds",
      sql: "SELECT id, uniprot_id FROM protein_structures ORDER BY fold_embedding <=> $1 LIMIT 10",
      source: "folding-agent",
      sinks: ["structure-db"],
      requestsPerSecond: 15,
    },
    {
      id: "sample-cohort",
      label: "Cohort for sample batch",
      sql: "SELECT id, cohort_id FROM samples WHERE id = ANY($1)",
      source: "lims-gateway",
      sinks: ["variant-replica", "variant-primary"],
      requestsPerSecond: 30,
      arrayParamLength: 50,
    },
  ],
};

export const CHIMERA_SCENARIOS: readonly ScenarioSpec[] = [
  checkoutSpike,
  socialFeed,
  vectorShards,
  crewRefactor,
  analyticsHot,
  rideFailover,
  genomicsPipeline,
];

export type ChimeraScenarioId = (typeof CHIMERA_SCENARIOS)[number]["id"];

export function getScenario(id: string): ScenarioSpec | undefined {
  return CHIMERA_SCENARIOS.find((s) => s.id === id);
}

/** Build a fresh network for a scenario id. Throws for unknown ids. */
export function createScenarioNetwork(id: string): PhysarumNetwork {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`Unknown CHIMERA scenario ${id}`);
  return new PhysarumNetwork(scenario);
}
