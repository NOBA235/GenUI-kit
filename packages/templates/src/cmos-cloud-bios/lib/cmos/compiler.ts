/**
 * BIOS // NECROMANCER — Infrastructure-as-Code Compiler (`lib/cmos/compiler.ts`)
 *
 * Pure and deterministic: the same CMOS registers and options always emit byte-identical
 * `docker-compose.yml`, `vercel.json` and `main.tf`. No Date, randomness, network, filesystem
 * or environment reads. Secrets never appear in output: Compose reads them from `.env`
 * (`${VAR:?}`), Terraform uses Secrets Manager-managed RDS passwords.
 */

import { z } from "zod";
import {
  simulateCmos,
  deriveCloudTopology,
  validateConfig,
  type CloudTopology,
  type CmosConfig,
  type CmosIssue,
  type CmosTelemetry,
} from "./engine.js";
import {
  YamlBlock,
  attr,
  block,
  call,
  comment,
  composeLiteral,
  emitHclDocument,
  emitYamlDocument,
  raw,
  tpl,
  type HclItem,
  type HclValue,
  type YamlValue,
} from "./emitters.js";

export const CompileOptionsSchema = z.strictObject({
  /** Lowercase project slug used for names, networks and resource prefixes. */
  projectName: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/, "Use 3-30 lowercase letters, digits or dashes.")
    .optional(),
  /** Vercel `functions` glob. Must match at least one function in the target project. */
  functionsGlob: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_\-./*[\]()]+$/, "Glob may only contain path characters and * [ ] ( ).")
    .optional(),
});
export type CompileOptions = z.infer<typeof CompileOptionsSchema>;

export const DEFAULT_PROJECT_NAME = "cmos-cloud";
export const DEFAULT_FUNCTIONS_GLOB = "app/api/**/*";

export type ArtifactPath = "docker-compose.yml" | "vercel.json" | "main.tf";

export interface CompiledArtifact {
  readonly path: ArtifactPath;
  readonly language: "yaml" | "json" | "hcl";
  readonly content: string;
  readonly bytes: number;
}

export interface CmosCompilation {
  readonly checksum: string;
  readonly projectName: string;
  readonly topology: CloudTopology;
  readonly telemetry: CmosTelemetry;
  readonly artifacts: readonly CompiledArtifact[];
  /** Deployment steps the files cannot express on their own (dashboard settings, quotas). */
  readonly notes: readonly string[];
  /** Compact cloud manifest JSON, the payload for the acoustic FSK modem. */
  readonly manifestJson: string;
}

export class CmosCompileError extends Error {
  constructor(readonly issues: readonly CmosIssue[]) {
    super(`CMOS CHECKSUM ERROR: ${issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ")}`);
    this.name = "CmosCompileError";
  }
}

const utf8 = new TextEncoder();

function artifact(path: ArtifactPath, language: CompiledArtifact["language"], content: string): CompiledArtifact {
  return { path, language, content, bytes: utf8.encode(content).length };
}

function cpus(value: number): string {
  return value.toFixed(2);
}

function headerLines(title: string, t: CloudTopology, telemetry: CmosTelemetry): string[] {
  return [
    `BIOS // NECROMANCER :: ${title}`,
    `CMOS checksum ${t.checksum} :: region ${t.region.awsRegion} / ${t.region.vercelRegion} (${t.region.city})`,
    `Estimated burn $${telemetry.monthlyCostUsd.toFixed(2)}/mo (list-price estimate, not a quote)`,
    "Generated deterministically from the CMOS registers. Re-compile instead of hand-editing.",
  ];
}

/* ═══════════════════════════ docker-compose.yml ═══════════════════════════ */

const POSTGRES_IMAGE = "postgres:17";
const PGVECTOR_IMAGE = "pgvector/pgvector:pg17";
const REDIS_IMAGE = "redis:7.4-alpine";
const TRAEFIK_IMAGE = "traefik:v3";
const PGDATA = "/var/lib/postgresql/data";

function pgInitScript(t: CloudTopology): string | null {
  const db = t.database;
  if (!db || (!db.vector && db.readReplicas === 0)) return null;
  const lines = ["#!/usr/bin/env bash", "# CMOS primary init (sourced by the postgres entrypoint on first boot)"];
  if (db.vector) {
    lines.push(
      'psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"',
    );
  }
  if (db.readReplicas > 0) {
    lines.push(
      'psql -v ON_ERROR_STOP=1 -v replication_password="$REPLICATION_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<\'SQL\'',
      "CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD :'replication_password';",
      "SQL",
      'echo "host replication replicator all scram-sha-256" >> "$PGDATA/pg_hba.conf"',
    );
    if (db.synchronousReplication) {
      lines.push(
        "# ECC + PATROL SCRUB: commits wait for one standby (applies after init finishes).",
        'psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "ALTER SYSTEM SET synchronous_standby_names = \'ANY 1 (*)\';"',
      );
    }
  }
  return composeLiteral(`${lines.join("\n")}\n`);
}

function replicaScript(): string {
  return composeLiteral(
    [
      "set -e",
      'if [ ! -s "$PGDATA/PG_VERSION" ]; then',
      '  until pg_basebackup --host=db --username=replicator --pgdata="$PGDATA" --wal-method=stream --write-recovery-conf --checkpoint=fast; do',
      '    echo "db-replica: waiting for primary"',
      '    find "$PGDATA" -mindepth 1 -delete',
      "    sleep 2",
      "  done",
      '  chmod 0700 "$PGDATA"',
      "fi",
      "exec postgres -c hot_standby=on",
    ].join("\n"),
  );
}

function appEnvironment(t: CloudTopology, includePort: boolean): Record<string, string> {
  const env: Record<string, string> = { NODE_ENV: "production" };
  if (includePort) env.PORT = "3000";
  env.CMOS_CHECKSUM = t.checksum;
  env.FUNCTION_CONCURRENCY = String(t.compute.concurrencyPerInstance);
  env.FUNCTION_TIMEOUT_SECONDS = String(t.compute.timeoutSec);
  if (t.database) {
    env.DATABASE_URL = "postgres://app:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}@db:5432/app";
    if (t.database.readReplicas > 0) {
      env.DATABASE_READ_REPLICA_URLS = Array.from(
        { length: t.database.readReplicas },
        (_, i) => `postgres://app:\${POSTGRES_PASSWORD}@db-replica-${i + 1}:5432/app`,
      ).join(",");
    }
    if (t.database.vector) env.VECTOR_STORE = "pgvector";
  }
  if (t.cache) env.REDIS_URL = "redis://:${REDIS_PASSWORD:?REDIS_PASSWORD is required}@cache:6379/0";
  if (t.queue) env.WEBHOOK_QUEUE_URL = "redis://:${QUEUE_PASSWORD:?QUEUE_PASSWORD is required}@queue:6379/0";
  return env;
}

function healthDependencies(t: CloudTopology): Record<string, YamlValue> | undefined {
  const deps: Record<string, YamlValue> = {};
  if (t.database) {
    deps.db = { condition: "service_healthy" };
    for (let i = 1; i <= t.database.readReplicas; i++) deps[`db-replica-${i}`] = { condition: "service_healthy" };
  }
  if (t.cache) deps.cache = { condition: "service_healthy" };
  if (t.queue) deps.queue = { condition: "service_healthy" };
  return Object.keys(deps).length > 0 ? deps : undefined;
}

function traefikLabels(t: CloudTopology): Record<string, string> {
  const labels: Record<string, string> = {
    "traefik.enable": "true",
    "traefik.http.routers.app.rule": "PathPrefix(`/`)",
    "traefik.http.routers.app.entrypoints": "web",
    "traefik.http.services.app.loadbalancer.server.port": "3000",
    "traefik.http.services.app.loadbalancer.healthcheck.path": "${HEALTHCHECK_PATH:-/api/health}",
    "traefik.http.services.app.loadbalancer.healthcheck.interval": "10s",
  };
  const middlewares: string[] = [];
  if (t.gateway) {
    labels["traefik.http.middlewares.cmos-gateway.ratelimit.average"] = String(t.gateway.rateLimitRps);
    labels["traefik.http.middlewares.cmos-gateway.ratelimit.burst"] = String(t.gateway.burstLimit);
    labels["traefik.http.middlewares.cmos-gateway.ratelimit.period"] = "1s";
    labels["traefik.http.middlewares.cmos-gateway.ratelimit.sourcecriterion.requesthost"] = "true";
    middlewares.push("cmos-gateway@docker");
  }
  if (t.edge) {
    labels["traefik.http.middlewares.cmos-ddos.ratelimit.average"] = String(t.edge.perClientRps);
    labels["traefik.http.middlewares.cmos-ddos.ratelimit.burst"] = String(t.edge.perClientRps * 2);
    labels["traefik.http.middlewares.cmos-ddos.ratelimit.period"] = "1s";
    labels["traefik.http.middlewares.cmos-secure.headers.framedeny"] = "true";
    labels["traefik.http.middlewares.cmos-secure.headers.contenttypenosniff"] = "true";
    labels["traefik.http.middlewares.cmos-secure.headers.referrerpolicy"] = "strict-origin-when-cross-origin";
    labels["traefik.http.middlewares.cmos-secure.headers.stsseconds"] = "63072000";
    middlewares.push("cmos-ddos@docker", "cmos-secure@docker");
  }
  if (middlewares.length > 0) labels["traefik.http.routers.app.middlewares"] = middlewares.join(",");
  return labels;
}

export function compileToDockerCompose(t: CloudTopology, telemetry: CmosTelemetry, projectName: string): string {
  const db = t.database;
  const useTraefik = Boolean(t.gateway || t.edge);
  const appReplicas = Math.min(8, Math.max(1, t.compute.minWarmInstances));
  const edgeNetwork = `${projectName}-edge`;
  const services: Record<string, YamlValue> = {};
  const volumes: Record<string, YamlValue> = {};
  const restart = "unless-stopped";

  if (useTraefik) {
    services.edge = {
      image: TRAEFIK_IMAGE,
      command: [
        "--providers.docker=true",
        "--providers.docker.exposedbydefault=false",
        `--providers.docker.network=${edgeNetwork}`,
        "--entrypoints.web.address=:80",
        "--ping=true",
        "--log.level=INFO",
      ],
      ports: ["80:80"],
      volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"],
      networks: ["edge"],
      healthcheck: { test: ["CMD", "traefik", "healthcheck", "--ping"], interval: "10s", timeout: "3s", retries: 5 },
      deploy: { resources: { limits: { cpus: "0.50", memory: "256M" } } },
      restart,
    };
  }

  services.app = {
    build: { context: "." },
    image: `\${APP_IMAGE:-${projectName}-app:latest}`,
    environment: appEnvironment(t, true),
    expose: useTraefik ? ["3000"] : undefined,
    ports: useTraefik ? undefined : [appReplicas === 1 ? "${APP_PORT:-3000}:3000" : "3000"],
    labels: useTraefik ? traefikLabels(t) : undefined,
    networks: ["edge", "backend"],
    depends_on: healthDependencies(t),
    healthcheck: {
      test: [
        "CMD",
        "node",
        "-e",
        "fetch('http://127.0.0.1:3000${HEALTHCHECK_PATH:-/api/health}').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
      ],
      interval: "10s",
      timeout: "5s",
      retries: 5,
      start_period: "30s",
    },
    deploy: {
      replicas: appReplicas,
      resources: {
        limits: { cpus: cpus(t.compute.vcpu), memory: `${t.compute.memoryMb}M` },
        reservations: { cpus: cpus(t.compute.vcpu / 2), memory: `${Math.max(64, t.compute.memoryMb / 2)}M` },
      },
    },
    restart,
  };

  if (db) {
    const initScript = pgInitScript(t);
    const image = db.vector ? PGVECTOR_IMAGE : POSTGRES_IMAGE;
    const pgHealth = {
      test: ["CMD-SHELL", composeLiteral('pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"')],
      interval: "5s",
      timeout: "5s",
      retries: 10,
      start_period: "20s",
    };
    const dbEnv: Record<string, string> = {
      POSTGRES_USER: "app",
      POSTGRES_DB: "app",
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}",
    };
    if (db.readReplicas > 0) dbEnv.REPLICATION_PASSWORD = "${REPLICATION_PASSWORD:?REPLICATION_PASSWORD is required}";
    if (db.dataChecksums) dbEnv.POSTGRES_INITDB_ARGS = "--data-checksums";
    services.db = {
      image,
      environment: dbEnv,
      configs: initScript ? [{ source: "cmos_pg_init", target: "/docker-entrypoint-initdb.d/10-cmos-init.sh" }] : undefined,
      volumes: [`pgdata:${PGDATA}`],
      shm_size: "256mb",
      networks: ["backend"],
      healthcheck: pgHealth,
      deploy: { resources: { limits: { cpus: cpus(db.spec.composeCpus), memory: `${db.spec.composeMemoryMb}M` } } },
      restart,
    };
    volumes.pgdata = {};
    for (let i = 1; i <= db.readReplicas; i++) {
      services[`db-replica-${i}`] = {
        image,
        user: "postgres",
        command: ["sh", "-c", replicaScript()],
        environment: {
          PGDATA,
          POSTGRES_USER: "app",
          POSTGRES_DB: "app",
          PGPASSWORD: "${REPLICATION_PASSWORD:?REPLICATION_PASSWORD is required}",
        },
        depends_on: { db: { condition: "service_healthy" } },
        volumes: [`pgreplica${i}:${PGDATA}`],
        shm_size: "256mb",
        networks: ["backend"],
        healthcheck: { ...pgHealth, start_period: "60s" },
        deploy: { resources: { limits: { cpus: cpus(db.spec.composeCpus), memory: `${db.spec.composeMemoryMb}M` } } },
        restart,
      };
      volumes[`pgreplica${i}`] = {};
    }
  }

  if (t.cache) {
    services.cache = {
      image: REDIS_IMAGE,
      command: [
        "sh",
        "-c",
        composeLiteral(
          `exec redis-server --maxmemory ${t.cache.maxMemoryMb}mb --maxmemory-policy allkeys-lru --save '' --appendonly no --requirepass "$REDIS_PASSWORD"`,
        ),
      ],
      environment: { REDIS_PASSWORD: "${REDIS_PASSWORD:?REDIS_PASSWORD is required}" },
      networks: ["backend"],
      healthcheck: {
        test: ["CMD-SHELL", composeLiteral('redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping | grep -q PONG')],
        interval: "5s",
        timeout: "3s",
        retries: 10,
      },
      deploy: { resources: { limits: { cpus: "0.50", memory: `${t.cache.spec.memoryMb}M` } } },
      restart,
    };
  }

  if (t.queue) {
    services.queue = {
      image: REDIS_IMAGE,
      command: [
        "sh",
        "-c",
        composeLiteral(
          'exec redis-server --appendonly yes --appendfsync everysec --maxmemory-policy noeviction --requirepass "$QUEUE_PASSWORD"',
        ),
      ],
      environment: { QUEUE_PASSWORD: "${QUEUE_PASSWORD:?QUEUE_PASSWORD is required}" },
      volumes: ["queuedata:/data"],
      networks: ["backend"],
      healthcheck: {
        test: ["CMD-SHELL", composeLiteral('redis-cli -a "$QUEUE_PASSWORD" --no-auth-warning ping | grep -q PONG')],
        interval: "5s",
        timeout: "3s",
        retries: 10,
      },
      deploy: { resources: { limits: { cpus: "0.25", memory: "256M" } } },
      restart,
    };
    volumes.queuedata = {};
    services.worker = {
      build: { context: "." },
      image: `\${APP_IMAGE:-${projectName}-app:latest}`,
      command: "${WORKER_COMMAND:-npm run worker}",
      environment: { ...appEnvironment(t, false), WORKER_CONCURRENCY: String(t.queue.maxConcurrency) },
      networks: ["edge", "backend"],
      depends_on: healthDependencies(t),
      deploy: {
        replicas: t.queue.slots,
        resources: { limits: { cpus: "0.50", memory: "512M" } },
      },
      restart,
    };
  }

  const initScript = pgInitScript(t);
  const doc: Record<string, YamlValue | undefined> = {
    name: projectName,
    services,
    networks: {
      edge: { name: edgeNetwork },
      backend: { name: `${projectName}-backend`, internal: true },
    },
    volumes: Object.keys(volumes).length > 0 ? volumes : undefined,
    configs: initScript ? { cmos_pg_init: { content: new YamlBlock(initScript) } } : undefined,
  };

  const header = [
    ...headerLines("docker-compose.yml", t, telemetry),
    "Requires Docker Compose v2.23+ (inline `configs.content`).",
    `Secrets from .env: ${[
      db ? "POSTGRES_PASSWORD" : null,
      db && db.readReplicas > 0 ? "REPLICATION_PASSWORD" : null,
      t.cache ? "REDIS_PASSWORD" : null,
      t.queue ? "QUEUE_PASSWORD" : null,
    ]
      .filter(Boolean)
      .join(", ") || "none"}.`,
    useTraefik ? "Traefik reads the Docker socket read-only to discover the app service." : "No gateway/edge slot: the app port is published directly.",
  ];
  return emitYamlDocument(header, doc);
}

/* ═══════════════════════════ vercel.json ═══════════════════════════ */

export interface VercelHeader {
  readonly key: string;
  readonly value: string;
}

export interface VercelJson {
  readonly $schema: "https://openapi.vercel.sh/vercel.json";
  readonly fluid: true;
  readonly regions: readonly string[];
  readonly functions: Readonly<Record<string, { readonly maxDuration: number }>>;
  readonly headers?: readonly { readonly source: string; readonly headers: readonly VercelHeader[] }[];
}

/**
 * Builds the vercel.json object. With Fluid compute, memory/CPU cannot be set in vercel.json
 * (https://vercel.com/docs/functions/configuring-functions/memory), so the compiler reports the
 * required Function CPU size in `notes` instead. Rate-limit headers advertise the policy; Vercel
 * enforces rate limits through WAF rules, not vercel.json.
 */
export function buildVercelJson(t: CloudTopology, functionsGlob: string = DEFAULT_FUNCTIONS_GLOB): VercelJson {
  const headers: { source: string; headers: VercelHeader[] }[] = [];
  if (t.edge) {
    headers.push({
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    });
  }
  const policies: string[] = [];
  if (t.gateway) policies.push(`"cmos-gateway";q=${t.gateway.rateLimitRps};w=1`);
  if (t.edge) policies.push(`"cmos-client";q=${t.edge.perClientRps};w=1`);
  if (policies.length > 0) {
    headers.push({
      source: "/api/(.*)",
      headers: [
        { key: "RateLimit-Policy", value: policies.join(", ") },
        { key: "X-RateLimit-Limit", value: String(t.edge?.perClientRps ?? t.gateway?.rateLimitRps ?? 0) },
      ],
    });
  }
  return {
    $schema: "https://openapi.vercel.sh/vercel.json",
    fluid: true,
    regions: [t.region.vercelRegion],
    functions: { [functionsGlob]: { maxDuration: t.compute.timeoutSec } },
    headers: headers.length > 0 ? headers : undefined,
  };
}

export function compileToVercelJson(t: CloudTopology, functionsGlob: string = DEFAULT_FUNCTIONS_GLOB): string {
  return `${JSON.stringify(buildVercelJson(t, functionsGlob), null, 2)}\n`;
}

/* ═══════════════════════════ main.tf ═══════════════════════════ */

const LAMBDA_RUNTIME = "nodejs22.x";
const LAMBDA_BASIC_POLICY = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole";
const LAMBDA_VPC_POLICY = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole";

function needsVpc(t: CloudTopology): boolean {
  return Boolean(t.database || t.cache);
}

function lambdaEnvironment(t: CloudTopology): Record<string, HclValue> {
  const env: Record<string, HclValue> = { CMOS_CHECKSUM: t.checksum };
  if (t.database) {
    env.DATABASE_HOST = raw("aws_db_instance.primary.address");
    env.DATABASE_NAME = "app";
    env.DATABASE_SECRET_ARN = raw("aws_db_instance.primary.master_user_secret[0].secret_arn");
    if (t.database.readReplicas > 0) env.DATABASE_READ_REPLICA_HOSTS = raw('join(",", aws_db_instance.replica[*].address)');
    if (t.database.vector) env.VECTOR_STORE = "pgvector";
  }
  if (t.cache) env.REDIS_URL = tpl("rediss://${aws_elasticache_replication_group.cache.primary_endpoint_address}:6379");
  if (t.queue) env.WEBHOOK_QUEUE_URL = raw("aws_sqs_queue.webhooks.url");
  return env;
}

function lambdaRoleItems(name: "api" | "worker", t: CloudTopology): HclItem[] {
  const statements: HclValue[] = [];
  if (t.database) {
    statements.push({
      Effect: "Allow",
      Action: ["secretsmanager:GetSecretValue"],
      Resource: raw("aws_db_instance.primary.master_user_secret[0].secret_arn"),
    });
  }
  if (t.queue && name === "api") {
    statements.push({ Effect: "Allow", Action: ["sqs:SendMessage"], Resource: raw("aws_sqs_queue.webhooks.arn") });
  }
  if (t.queue && name === "worker") {
    statements.push({
      Effect: "Allow",
      Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"],
      Resource: raw("aws_sqs_queue.webhooks.arn"),
    });
  }
  const items: HclItem[] = [
    block("resource", ["aws_iam_role", name], [
      attr("name_prefix", tpl(`\${local.name}-${name}-`)),
      attr("assume_role_policy", raw("data.aws_iam_policy_document.lambda_assume.json")),
    ]),
    block("resource", ["aws_iam_role_policy_attachment", `${name}_logs`], [
      attr("role", raw(`aws_iam_role.${name}.name`)),
      attr("policy_arn", LAMBDA_BASIC_POLICY),
    ]),
  ];
  if (needsVpc(t)) {
    items.push(
      block("resource", ["aws_iam_role_policy_attachment", `${name}_vpc`], [
        attr("role", raw(`aws_iam_role.${name}.name`)),
        attr("policy_arn", LAMBDA_VPC_POLICY),
      ]),
    );
  }
  if (statements.length > 0) {
    items.push(
      block("resource", ["aws_iam_role_policy", name], [
        attr("name", `cmos-${name}`),
        attr("role", raw(`aws_iam_role.${name}.id`)),
        attr("policy", call("jsonencode", { Version: "2012-10-17", Statement: statements })),
      ]),
    );
  }
  return items;
}

function vpcConfig(t: CloudTopology): HclItem | null {
  if (!needsVpc(t)) return null;
  return block("vpc_config", [], [
    attr("subnet_ids", raw("module.vpc.private_subnets")),
    attr("security_group_ids", [raw("aws_security_group.lambda.id")]),
  ]);
}

function networkItems(t: CloudTopology): HclItem[] {
  if (!needsVpc(t)) return [];
  const items: HclItem[] = [
    block("data", ["aws_availability_zones", "available"], [attr("state", "available")]),
    block("module", ["vpc"], [
      attr("source", "terraform-aws-modules/vpc/aws"),
      attr("version", "~> 6.0"),
      attr("name", raw("local.name")),
      attr("cidr", "10.42.0.0/16"),
      attr("azs", raw("slice(data.aws_availability_zones.available.names, 0, 2)")),
      attr("private_subnets", ["10.42.1.0/24", "10.42.2.0/24"]),
      attr("public_subnets", ["10.42.101.0/24", "10.42.102.0/24"]),
      t.database ? attr("database_subnets", ["10.42.21.0/24", "10.42.22.0/24"]) : null,
      t.cache ? attr("elasticache_subnets", ["10.42.31.0/24", "10.42.32.0/24"]) : null,
      attr("enable_nat_gateway", true),
      attr("single_nat_gateway", true),
      attr("enable_dns_hostnames", true),
    ]),
    block("resource", ["aws_security_group", "lambda"], [
      attr("name_prefix", tpl("${local.name}-fn-")),
      attr("description", "CMOS functions: egress only"),
      attr("vpc_id", raw("module.vpc.vpc_id")),
      block("egress", [], [
        attr("from_port", 0),
        attr("to_port", 0),
        attr("protocol", "-1"),
        attr("cidr_blocks", ["0.0.0.0/0"]),
      ]),
    ]),
  ];
  const ingressFromLambda = (port: number) =>
    block("ingress", [], [
      attr("from_port", port),
      attr("to_port", port),
      attr("protocol", "tcp"),
      attr("security_groups", [raw("aws_security_group.lambda.id")]),
    ]);
  if (t.database) {
    items.push(
      block("resource", ["aws_security_group", "db"], [
        attr("name_prefix", tpl("${local.name}-db-")),
        attr("description", "CMOS IDE primary master: PostgreSQL from functions only"),
        attr("vpc_id", raw("module.vpc.vpc_id")),
        ingressFromLambda(5432),
      ]),
    );
  }
  if (t.cache) {
    items.push(
      block("resource", ["aws_security_group", "cache"], [
        attr("name_prefix", tpl("${local.name}-cache-")),
        attr("description", "CMOS IDE secondary master: Redis from functions only"),
        attr("vpc_id", raw("module.vpc.vpc_id")),
        ingressFromLambda(6379),
      ]),
    );
  }
  return items;
}

function databaseItems(t: CloudTopology): HclItem[] {
  const db = t.database;
  if (!db) return [];
  const items: HclItem[] = ([
    db.vector ? comment("pgvector: run `CREATE EXTENSION IF NOT EXISTS vector;` once on the primary after apply.") : null,
    block("resource", ["aws_db_instance", "primary"], [
      attr("identifier", tpl("${local.name}-pg")),
      attr("engine", "postgres"),
      attr("engine_version", "17"),
      attr("instance_class", db.spec.rdsClass),
      attr("allocated_storage", db.storageGb),
      attr("storage_type", "gp3"),
      attr("storage_encrypted", true),
      attr("db_name", "app"),
      attr("username", "app_admin"),
      attr("manage_master_user_password", true),
      attr("db_subnet_group_name", raw("module.vpc.database_subnet_group_name")),
      attr("vpc_security_group_ids", [raw("aws_security_group.db.id")]),
      attr("multi_az", db.multiAz),
      attr("backup_retention_period", db.backupRetentionDays),
      attr("copy_tags_to_snapshot", true),
      attr("auto_minor_version_upgrade", true),
      attr("deletion_protection", true),
      attr("skip_final_snapshot", false),
      attr("final_snapshot_identifier", tpl("${local.name}-pg-final")),
    ]),
  ] as (HclItem | null)[]).filter((item): item is HclItem => item !== null);
  if (db.readReplicas > 0) {
    items.push(
      block("resource", ["aws_db_instance", "replica"], [
        attr("count", db.readReplicas),
        attr("identifier", tpl("${local.name}-pg-replica-${count.index + 1}")),
        attr("replicate_source_db", raw("aws_db_instance.primary.identifier")),
        attr("instance_class", db.spec.rdsClass),
        attr("storage_encrypted", true),
        attr("vpc_security_group_ids", [raw("aws_security_group.db.id")]),
        attr("auto_minor_version_upgrade", true),
        attr("skip_final_snapshot", true),
      ]),
    );
  }
  return items;
}

function cacheItems(t: CloudTopology): HclItem[] {
  if (!t.cache) return [];
  return [
    block("resource", ["aws_elasticache_replication_group", "cache"], [
      attr("replication_group_id", tpl("${local.name}-cache")),
      attr("description", "CMOS secondary master cache tier"),
      attr("engine", "redis"),
      attr("engine_version", "7.1"),
      attr("node_type", t.cache.spec.node),
      attr("num_cache_clusters", 1),
      attr("port", 6379),
      attr("parameter_group_name", "default.redis7"),
      attr("subnet_group_name", raw("module.vpc.elasticache_subnet_group_name")),
      attr("security_group_ids", [raw("aws_security_group.cache.id")]),
      attr("at_rest_encryption_enabled", true),
      attr("transit_encryption_enabled", true),
      attr("automatic_failover_enabled", false),
    ]),
  ];
}

function computeItems(t: CloudTopology): HclItem[] {
  const c = t.compute;
  const items: HclItem[] = [
    block("data", ["aws_iam_policy_document", "lambda_assume"], [
      block("statement", [], [
        attr("actions", ["sts:AssumeRole"]),
        block("principals", [], [attr("type", "Service"), attr("identifiers", ["lambda.amazonaws.com"])]),
      ]),
    ]),
    ...lambdaRoleItems("api", t),
  ];
  if (c.reservedConcurrency > 900) {
    items.push(comment(`Requires a Lambda concurrency quota of at least ${c.reservedConcurrency + 100} (default is 1000).`));
  }
  items.push(
    block("resource", ["aws_lambda_function", "api"], [
      attr("function_name", tpl("${local.name}-api")),
      attr("role", raw("aws_iam_role.api.arn")),
      attr("runtime", LAMBDA_RUNTIME),
      attr("handler", "index.handler"),
      attr("architectures", ["arm64"]),
      attr("filename", raw("var.lambda_package_path")),
      attr("source_code_hash", raw("filebase64sha256(var.lambda_package_path)")),
      attr("memory_size", c.lambdaMemoryMb),
      attr("timeout", c.timeoutSec),
      attr("reserved_concurrent_executions", c.reservedConcurrency),
      attr("publish", true),
      block("environment", [], [attr("variables", lambdaEnvironment(t))]),
      vpcConfig(t),
    ]),
    block("resource", ["aws_lambda_alias", "live"], [
      attr("name", "live"),
      attr("function_name", raw("aws_lambda_function.api.function_name")),
      attr("function_version", raw("aws_lambda_function.api.version")),
    ]),
  );
  if (c.provisionedConcurrency > 0) {
    items.push(
      block("resource", ["aws_lambda_provisioned_concurrency_config", "live"], [
        attr("function_name", raw("aws_lambda_alias.live.function_name")),
        attr("qualifier", raw("aws_lambda_alias.live.name")),
        attr("provisioned_concurrent_executions", c.provisionedConcurrency),
      ]),
    );
  }
  return items;
}

function apiGatewayItems(t: CloudTopology): HclItem[] {
  return [
    block("resource", ["aws_apigatewayv2_api", "http"], [
      attr("name", tpl("${local.name}-http")),
      attr("protocol_type", "HTTP"),
    ]),
    block("resource", ["aws_apigatewayv2_integration", "api"], [
      attr("api_id", raw("aws_apigatewayv2_api.http.id")),
      attr("integration_type", "AWS_PROXY"),
      attr("integration_uri", raw("aws_lambda_alias.live.invoke_arn")),
      attr("payload_format_version", "2.0"),
      // HTTP APIs cap integrations at 30 s regardless of the Lambda timeout.
      attr("timeout_milliseconds", Math.min(30000, t.compute.timeoutSec * 1000)),
    ]),
    block("resource", ["aws_apigatewayv2_route", "default"], [
      attr("api_id", raw("aws_apigatewayv2_api.http.id")),
      attr("route_key", "$default"),
      attr("target", tpl("integrations/${aws_apigatewayv2_integration.api.id}")),
    ]),
    block("resource", ["aws_apigatewayv2_stage", "default"], [
      attr("api_id", raw("aws_apigatewayv2_api.http.id")),
      attr("name", "$default"),
      attr("auto_deploy", true),
      t.gateway
        ? block("default_route_settings", [], [
            attr("throttling_rate_limit", t.gateway.rateLimitRps),
            attr("throttling_burst_limit", t.gateway.burstLimit),
          ])
        : null,
    ]),
    block("resource", ["aws_lambda_permission", "http_api"], [
      attr("statement_id", "AllowHttpApiInvoke"),
      attr("action", "lambda:InvokeFunction"),
      attr("function_name", raw("aws_lambda_function.api.function_name")),
      attr("qualifier", raw("aws_lambda_alias.live.name")),
      attr("principal", "apigateway.amazonaws.com"),
      attr("source_arn", tpl("${aws_apigatewayv2_api.http.execution_arn}/*/*")),
    ]),
  ];
}

function edgeItems(t: CloudTopology): HclItem[] {
  if (!t.edge) return [];
  const visibility = (metric: string) =>
    block("visibility_config", [], [
      attr("cloudwatch_metrics_enabled", true),
      attr("metric_name", tpl(`\${local.name}-${metric}`)),
      attr("sampled_requests_enabled", true),
    ]);
  return [
    block("data", ["aws_cloudfront_cache_policy", "caching_disabled"], [attr("name", "Managed-CachingDisabled")]),
    block("data", ["aws_cloudfront_origin_request_policy", "all_viewer_except_host"], [
      attr("name", "Managed-AllViewerExceptHostHeader"),
    ]),
    block("resource", ["aws_wafv2_web_acl", "edge"], [
      attr("provider", raw("aws.us_east_1")),
      attr("name", tpl("${local.name}-ddos-breaker")),
      attr("scope", "CLOUDFRONT"),
      block("default_action", [], [block("allow", [], [])]),
      block("rule", [], [
        attr("name", "per-client-rate-limit"),
        attr("priority", 1),
        block("action", [], [block("block", [], [])]),
        block("statement", [], [
          block("rate_based_statement", [], [attr("limit", t.edge.wafLimitPer5Min), attr("aggregate_key_type", "IP")]),
        ]),
        visibility("rate-limit"),
      ]),
      visibility("edge-acl"),
    ]),
    block("resource", ["aws_cloudfront_response_headers_policy", "edge"], [
      attr("name", tpl("${local.name}-edge-headers")),
      block("security_headers_config", [], [
        block("content_type_options", [], [attr("override", true)]),
        block("frame_options", [], [attr("frame_option", "DENY"), attr("override", true)]),
        block("referrer_policy", [], [attr("referrer_policy", "strict-origin-when-cross-origin"), attr("override", true)]),
        block("strict_transport_security", [], [
          attr("access_control_max_age_sec", 63072000),
          attr("include_subdomains", true),
          attr("preload", true),
          attr("override", true),
        ]),
      ]),
    ]),
    block("resource", ["aws_cloudfront_distribution", "edge"], [
      attr("enabled", true),
      attr("comment", "CMOS edge middleware"),
      attr("price_class", "PriceClass_100"),
      attr("web_acl_id", raw("aws_wafv2_web_acl.edge.arn")),
      block("origin", [], [
        attr("domain_name", raw('replace(aws_apigatewayv2_api.http.api_endpoint, "https://", "")')),
        attr("origin_id", "http-api"),
        block("custom_origin_config", [], [
          attr("http_port", 80),
          attr("https_port", 443),
          attr("origin_protocol_policy", "https-only"),
          attr("origin_ssl_protocols", ["TLSv1.2"]),
        ]),
      ]),
      block("default_cache_behavior", [], [
        attr("target_origin_id", "http-api"),
        attr("viewer_protocol_policy", "redirect-to-https"),
        attr("allowed_methods", ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]),
        attr("cached_methods", ["GET", "HEAD"]),
        attr("compress", true),
        attr("cache_policy_id", raw("data.aws_cloudfront_cache_policy.caching_disabled.id")),
        attr("origin_request_policy_id", raw("data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id")),
        attr("response_headers_policy_id", raw("aws_cloudfront_response_headers_policy.edge.id")),
      ]),
      block("restrictions", [], [block("geo_restriction", [], [attr("restriction_type", "none")])]),
      block("viewer_certificate", [], [attr("cloudfront_default_certificate", true)]),
    ]),
  ];
}

function queueItems(t: CloudTopology): HclItem[] {
  if (!t.queue) return [];
  return [
    block("resource", ["aws_sqs_queue", "webhooks_dlq"], [
      attr("name", tpl("${local.name}-webhooks-dlq")),
      attr("message_retention_seconds", 1209600),
      attr("sqs_managed_sse_enabled", true),
    ]),
    block("resource", ["aws_sqs_queue", "webhooks"], [
      attr("name", tpl("${local.name}-webhooks")),
      attr("visibility_timeout_seconds", t.queue.visibilityTimeoutSec),
      attr("message_retention_seconds", 345600),
      attr("sqs_managed_sse_enabled", true),
      attr("redrive_policy", call("jsonencode", { deadLetterTargetArn: raw("aws_sqs_queue.webhooks_dlq.arn"), maxReceiveCount: 5 })),
    ]),
    ...lambdaRoleItems("worker", t),
    block("resource", ["aws_lambda_function", "webhook_worker"], [
      attr("function_name", tpl("${local.name}-webhook-worker")),
      attr("role", raw("aws_iam_role.worker.arn")),
      attr("runtime", LAMBDA_RUNTIME),
      attr("handler", "worker.handler"),
      attr("architectures", ["arm64"]),
      attr("filename", raw("var.lambda_package_path")),
      attr("source_code_hash", raw("filebase64sha256(var.lambda_package_path)")),
      attr("memory_size", 512),
      attr("timeout", t.compute.timeoutSec),
      block("environment", [], [attr("variables", lambdaEnvironment(t))]),
      vpcConfig(t),
    ]),
    block("resource", ["aws_lambda_event_source_mapping", "webhooks"], [
      attr("event_source_arn", raw("aws_sqs_queue.webhooks.arn")),
      attr("function_name", raw("aws_lambda_function.webhook_worker.arn")),
      attr("batch_size", 10),
      attr("function_response_types", ["ReportBatchItemFailures"]),
      block("scaling_config", [], [attr("maximum_concurrency", t.queue.maxConcurrency)]),
    ]),
  ];
}

export function compileToTerraform(t: CloudTopology, telemetry: CmosTelemetry, projectName: string): string {
  const tags = { Project: raw("var.project_name"), ManagedBy: "genui-cmos-cloud-bios", CmosChecksum: t.checksum };
  const items: HclItem[] = ([
    block("terraform", [], [
      attr("required_version", ">= 1.6.0"),
      block("required_providers", [], [attr("aws", { source: "hashicorp/aws", version: "~> 6.0" })]),
    ]),
    block("provider", ["aws"], [
      attr("region", raw("var.aws_region")),
      block("default_tags", [], [attr("tags", tags)]),
    ]),
    t.edge
      ? block("provider", ["aws"], [
          comment("CloudFront-scoped WAF ACLs must live in us-east-1."),
          attr("alias", "us_east_1"),
          attr("region", "us-east-1"),
          block("default_tags", [], [attr("tags", tags)]),
        ])
      : null,
    block("variable", ["project_name"], [
      attr("type", raw("string")),
      attr("default", projectName),
      attr("description", "Prefix for every resource name."),
    ]),
    block("variable", ["aws_region"], [
      attr("type", raw("string")),
      attr("default", t.region.awsRegion),
      attr("description", `CMOS time zone ${t.region.timeZone} (${t.region.city}).`),
    ]),
    block("variable", ["lambda_package_path"], [
      attr("type", raw("string")),
      attr("default", "build/lambda.zip"),
      attr("description", t.queue ? "Zip exporting index.handler (API) and worker.handler (webhooks)." : "Zip exporting index.handler."),
    ]),
    block("variable", ["budget_alert_email"], [
      attr("type", raw("string")),
      attr("description", "Receives CMOS power-budget alerts."),
    ]),
    block("locals", [], [attr("name", raw("var.project_name"))]),
  ] as (HclItem | null)[]).filter((item): item is HclItem => item !== null);

  items.push(
    ...networkItems(t),
    ...databaseItems(t),
    ...cacheItems(t),
    ...computeItems(t),
    ...apiGatewayItems(t),
    ...edgeItems(t),
    ...queueItems(t),
  );

  const notification = (threshold: number, type: "FORECASTED" | "ACTUAL") =>
    block("notification", [], [
      attr("comparison_operator", "GREATER_THAN"),
      attr("threshold", threshold),
      attr("threshold_type", "PERCENTAGE"),
      attr("notification_type", type),
      attr("subscriber_email_addresses", [raw("var.budget_alert_email")]),
    ]);
  items.push(
    block("resource", ["aws_budgets_budget", "cmos_power"], [
      attr("name", tpl("${local.name}-cmos-power")),
      attr("budget_type", "COST"),
      attr("limit_amount", String(t.budgetCapUsd)),
      attr("limit_unit", "USD"),
      attr("time_unit", "MONTHLY"),
      notification(80, "FORECASTED"),
      notification(100, "ACTUAL"),
    ]),
  );

  const output = (name: string, value: HclValue) => block("output", [name], [attr("value", value)]);
  items.push(output("api_endpoint", raw("aws_apigatewayv2_api.http.api_endpoint")));
  if (t.edge) items.push(output("edge_domain", raw("aws_cloudfront_distribution.edge.domain_name")));
  if (t.database) {
    items.push(output("database_endpoint", raw("aws_db_instance.primary.address")));
    if (t.database.readReplicas > 0) items.push(output("read_replica_endpoints", raw("aws_db_instance.replica[*].address")));
  }
  if (t.cache) items.push(output("cache_endpoint", raw("aws_elasticache_replication_group.cache.primary_endpoint_address")));
  if (t.queue) items.push(output("webhook_queue_url", raw("aws_sqs_queue.webhooks.url")));
  items.push(output("cmos_checksum", t.checksum));

  return emitHclDocument(
    [...headerLines("main.tf", t, telemetry), "Requires Terraform >= 1.6 and AWS provider 6.x. Build var.lambda_package_path before `terraform plan`."],
    items,
  );
}

/* ═══════════════════════════ Manifest + top-level compile ═══════════════════════════ */

/** Compact cloud manifest (a few hundred bytes), sized for the 300-baud acoustic modem. */
export function compileCloudManifest(t: CloudTopology): string {
  return JSON.stringify({
    v: 1,
    sum: t.checksum,
    region: t.region.awsRegion,
    compute: {
      vcpu: t.compute.vcpu,
      memMb: t.compute.lambdaMemoryMb,
      warm: t.compute.minWarmInstances,
      max: t.compute.maxInstances,
      conc: t.compute.concurrencyPerInstance,
      timeoutS: t.compute.timeoutSec,
    },
    db: t.database
      ? { class: t.database.spec.rdsClass, gb: t.database.storageGb, replicas: t.database.readReplicas, multiAz: t.database.multiAz, vector: t.database.vector }
      : null,
    cache: t.cache ? t.cache.spec.node : null,
    gatewayRps: t.gateway?.rateLimitRps ?? null,
    edgeRpsPerIp: t.edge?.perClientRps ?? null,
    queueConcurrency: t.queue?.maxConcurrency ?? null,
    budgetUsd: t.budgetCapUsd,
  });
}

function deploymentNotes(t: CloudTopology): string[] {
  const notes = [
    `Vercel: set Project Settings > Functions > Function CPU to ${
      t.compute.vercelFunctionCpu === "performance" ? "Performance (4 GB / 2 vCPU)" : "Standard (2 GB / 1 vCPU)"
    }. vercel.json cannot set memory with Fluid compute.`,
  ];
  if (t.edge) notes.push(`Vercel: add a WAF rate-limit rule of ${t.edge.perClientRps} requests/second per IP on /api/*.`);
  if (t.queue) notes.push("Vercel: webhook queue consumers run on AWS (main.tf) or Compose; vercel.json has no queue config.");
  if (t.database?.vector) notes.push("Terraform: run `CREATE EXTENSION IF NOT EXISTS vector;` on the RDS primary after apply.");
  if (t.compute.reservedConcurrency > 900) {
    notes.push(`AWS: request a Lambda concurrency quota of at least ${t.compute.reservedConcurrency + 100} before apply.`);
  }
  if (t.compute.timeoutSec > 30) notes.push("AWS: HTTP API integrations time out at 30 s even though the Lambda timeout is longer.");
  return notes;
}

/** Validate the registers, then compile all three artifacts. Throws CmosCompileError on invalid input. */
export function compileCmos(configInput: CmosConfig, optionsInput: CompileOptions = {}): CmosCompilation {
  const validated = validateConfig(configInput);
  if (!validated.ok) throw new CmosCompileError(validated.issues);
  const options = CompileOptionsSchema.safeParse(optionsInput);
  if (!options.success) {
    throw new CmosCompileError(
      options.error.issues.map((i) => ({ path: `options.${i.path.map(String).join(".")}`, message: i.message })),
    );
  }
  const projectName = options.data.projectName ?? DEFAULT_PROJECT_NAME;
  const functionsGlob = options.data.functionsGlob ?? DEFAULT_FUNCTIONS_GLOB;
  const topology = deriveCloudTopology(validated.config);
  const telemetry = simulateCmos(validated.config, topology);

  return {
    checksum: topology.checksum,
    projectName,
    topology,
    telemetry,
    artifacts: [
      artifact("docker-compose.yml", "yaml", compileToDockerCompose(topology, telemetry, projectName)),
      artifact("vercel.json", "json", compileToVercelJson(topology, functionsGlob)),
      artifact("main.tf", "hcl", compileToTerraform(topology, telemetry, projectName)),
    ],
    notes: deploymentNotes(topology),
    manifestJson: compileCloudManifest(topology),
  };
}
