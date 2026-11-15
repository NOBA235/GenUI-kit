import { useSyncExternalStore } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { indexDdl, type IndexDef } from "../lib/chimera/query-planner.js";
import type { InterventionResult, NetworkTelemetry, PhysarumNetwork } from "../lib/chimera/bio-solver.js";
import { CHIMERA_SCENARIOS, createScenarioNetwork } from "../lib/chimera/scenarios.js";

/* ═══════════════════════════ Types ═══════════════════════════ */

export type LabMode = "workbench" | "landing";
export const CREW_AGENT_NAMES = ["chimera-architect", "index-surgeon", "deadlock-hunter"] as const;
export type CrewAgentName = (typeof CREW_AGENT_NAMES)[number];
export type ActivityAuthor = CrewAgentName | "operator";

export interface ActivityEntry {
  readonly seq: number;
  readonly author: ActivityAuthor;
  readonly title: string;
  readonly sql: string | null;
  /** Short content hash of the change, shown as a lab checkpoint (not a git commit). */
  readonly checkpoint: string;
  readonly latencyBeforeMs: number;
  readonly latencyAfterMs: number;
  readonly costBefore: number;
  readonly costAfter: number;
}

export interface WorkerSprite {
  readonly id: number;
  readonly agent: CrewAgentName;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  /** performance.now() when dispatched; the canvas animates for WORKER_FLIGHT_MS. */
  readonly startedAt: number;
}

export interface LabState {
  readonly scenarioId: string;
  readonly mode: LabMode;
  readonly running: boolean;
  readonly telemetry: NetworkTelemetry;
  readonly revision: number;
  readonly selectedNodeId: string | null;
  readonly selectedQueryId: string | null;
  readonly feed: readonly ActivityEntry[];
  readonly workers: readonly WorkerSprite[];
  readonly notice: string | null;
  readonly audioUnlocked: boolean;
  readonly audioMuted: boolean;
  readonly audioVolume: number;
  readonly rootHz: number;
}

export const MAX_FEED_ENTRIES = 40;
export const WORKER_FLIGHT_MS = 1400;
export const DEFAULT_SCENARIO_ID = CHIMERA_SCENARIOS[0]!.id;

/* ═══════════════════════════ Network + store singletons ═══════════════════════════ */

let network: PhysarumNetwork | null = null;
let store: StoreApi<LabState> | null = null;
let feedSeq = 0;
let workerSeq = 0;

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}

function initialState(scenarioId: string): LabState {
  network = createScenarioNetwork(scenarioId);
  return {
    scenarioId,
    mode: "workbench",
    running: true,
    telemetry: network.telemetry,
    revision: 0,
    selectedNodeId: null,
    selectedQueryId: network.telemetry.queries[0]?.id ?? null,
    feed: [],
    workers: [],
    notice: null,
    audioUnlocked: false,
    audioMuted: false,
    audioVolume: 0.7,
    rootHz: 55,
  };
}

export function getLabStore(): StoreApi<LabState> {
  if (!store) store = createStore<LabState>()(() => initialState(DEFAULT_SCENARIO_ID));
  return store;
}

/** The live network for the current scenario. */
export function getLabNetwork(): PhysarumNetwork {
  getLabStore();
  return network!;
}

export function resetLabStoreForTests(): void {
  store = null;
  network = null;
  feedSeq = 0;
  workerSeq = 0;
}

export function useLab<T>(selector: (state: LabState) => T): T {
  const s = getLabStore();
  return useSyncExternalStore(
    s.subscribe,
    () => selector(s.getState()),
    () => selector(s.getState()),
  );
}

export function setLab(patch: Partial<LabState>): void {
  getLabStore().setState(patch);
}

/* ═══════════════════════════ Actions ═══════════════════════════ */

function publish(extra: Partial<LabState> = {}): void {
  const s = getLabStore();
  s.setState({ telemetry: network!.telemetry, revision: s.getState().revision + 1, ...extra });
}

function record(author: ActivityAuthor, result: InterventionResult, title?: string): ActivityEntry {
  feedSeq += 1;
  const entry: ActivityEntry = {
    seq: feedSeq,
    author,
    title: title ?? result.detail,
    sql: result.sql,
    checkpoint: fnv1a(`${feedSeq}:${result.kind}:${result.target}:${result.sql ?? ""}`),
    latencyBeforeMs: result.before.meanRequestLatencyMs,
    latencyAfterMs: result.after.meanRequestLatencyMs,
    costBefore: result.before.costUnitsPerSecond,
    costAfter: result.after.costUnitsPerSecond,
  };
  const s = getLabStore();
  s.setState({ feed: [entry, ...s.getState().feed].slice(0, MAX_FEED_ENTRIES) });
  return entry;
}

/** Load a scenario. Loading the current one is a no-op unless `force` resets it. */
export function loadScenario(scenarioId: string, force = false): boolean {
  if (!CHIMERA_SCENARIOS.some((sc) => sc.id === scenarioId)) return false;
  const s = getLabStore();
  if (s.getState().scenarioId === scenarioId && !force) return true;
  network = createScenarioNetwork(scenarioId);
  publish({
    scenarioId,
    selectedNodeId: null,
    selectedQueryId: network.telemetry.queries[0]?.id ?? null,
    feed: [],
    workers: [],
    notice: `Loaded scenario ${scenarioId}`,
  });
  return true;
}

/** Advance the solver (called by the shell's timer, never by the render loop). */
export function stepLab(steps = 1): void {
  network!.step(steps);
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const workers = getLabStore().getState().workers.filter((w) => now - w.startedAt < WORKER_FLIGHT_MS);
  publish(workers.length !== getLabStore().getState().workers.length ? { workers } : {});
}

export function toggleNode(nodeId: string): void {
  const net = getLabNetwork();
  const result = net.isAlive(nodeId) ? net.severNode(nodeId) : net.reviveNode(nodeId);
  record("operator", result);
  publish();
}

export function moveLabNode(nodeId: string, x: number, y: number): void {
  getLabNetwork().moveNode(nodeId, x, y);
  publish();
}

/** Inject the best index for a database node's dataset. Returns false when there is nothing to add. */
export function injectBestIndex(nodeId: string, author: ActivityAuthor = "operator"): boolean {
  const net = getLabNetwork();
  const node = net.nodes.find((n) => n.id === nodeId);
  const candidates = net.indexCandidates(node?.datasetId);
  const best = candidates[0];
  if (!best) {
    setLab({ notice: `No index would lower cost for ${node?.datasetId ?? "the network"}` });
    return false;
  }
  record(author, net.injectIndex(best.datasetId, best.index), `${indexDdl(best.index)}`);
  publish({ notice: null });
  return true;
}

/** Apply one index migration (e.g. from the SQL deck's recommendations). */
export function injectIndex(datasetId: string, index: IndexDef, author: ActivityAuthor = "operator"): boolean {
  const net = getLabNetwork();
  if (!net.getDataset(datasetId)) return false;
  record(author, net.injectIndex(datasetId, index), indexDdl(index));
  publish({ notice: null });
  return true;
}

export function injectIndexes(datasetId: string, author: ActivityAuthor = "operator"): number {
  const net = getLabNetwork();
  let applied = 0;
  for (const candidate of net.indexCandidates(datasetId)) {
    record(author, net.injectIndex(candidate.datasetId, candidate.index));
    applied++;
  }
  publish();
  return applied;
}

export function batchQuery(queryId: string, author: ActivityAuthor = "operator"): boolean {
  const result = getLabNetwork().rewriteNPlusOne(queryId);
  if (!result) return false;
  record(author, result);
  publish();
  return true;
}

/** Replace a query's SQL. Returns an error message, or null on success. */
export function applyQuerySql(queryId: string, sql: string): string | null {
  try {
    record("operator", getLabNetwork().setQuerySql(queryId, sql));
    publish({ notice: null });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Dispatch a Crew agent toward a node. The canvas animates the worker; the agent's change is
 * applied immediately and deterministically:
 * - chimera-architect: full audit (top indexes + N+1 batching)
 * - index-surgeon: best index for the target node's dataset (or the network)
 * - deadlock-hunter: batches N+1 round-trip storms and reports stalled statements
 */
export function dispatchAgent(agent: CrewAgentName, targetNodeId?: string | null): number {
  const net = getLabNetwork();
  const telemetry = net.telemetry;
  const source = net.nodes.find((n) => n.kind === "gateway") ?? net.nodes[0]!;
  const target = targetNodeId ?? telemetry.saturatedNodes[0] ?? net.nodes.find((n) => n.datasetId)?.id ?? source.id;
  workerSeq += 1;
  const sprite: WorkerSprite = {
    id: workerSeq,
    agent,
    fromNodeId: source.id,
    toNodeId: target,
    startedAt: typeof performance !== "undefined" ? performance.now() : 0,
  };
  setLab({ workers: [...getLabStore().getState().workers, sprite] });

  let changes = 0;
  if (agent === "chimera-architect") {
    const report = net.runOptimizerAgent();
    for (const action of report.actions) record(agent, action);
    changes = report.actions.length;
  } else if (agent === "index-surgeon") {
    changes = injectBestIndex(target, agent) ? 1 : 0;
  } else {
    for (const q of telemetry.queries) {
      const result = net.rewriteNPlusOne(q.id);
      if (result) {
        record(agent, result);
        changes++;
      }
    }
    const stalled = telemetry.queries.filter((q) => q.timedOut).map((q) => q.id);
    if (stalled.length > 0 || telemetry.saturatedNodes.length > 0) {
      setLab({
        notice: `deadlock-hunter: ${stalled.length} statement(s) hit statement_timeout; saturated: ${telemetry.saturatedNodes.join(", ") || "none"}`,
      });
    }
  }
  if (changes === 0 && agent !== "deadlock-hunter") setLab({ notice: `${agent}: nothing to change` });
  publish();
  return changes;
}

export interface ChemotaxisPacketInput {
  readonly packetId: string;
  readonly nodeId: string;
  readonly strength: number;
  /** Query to replace with `sql`; null targets the selected query. */
  readonly queryId: string | null;
  /** Optional SQL payload. It must parse and plan, or the packet is quarantined. */
  readonly sql: string | null;
}

export interface ChemotaxisOutcome {
  readonly pulseApplied: boolean;
  readonly sqlApplied: boolean;
  readonly quarantined: readonly string[];
  readonly notice: string;
}

/**
 * Apply a streamed chemotaxis packet. Each part is checked on its own: the pulse needs a live
 * node and a finite strength in [0, 1]; the SQL payload must parse and plan on every sink. Any
 * invalid part is quarantined and leaves the network unchanged.
 */
export function applyChemotaxisPacket(packet: ChemotaxisPacketInput): ChemotaxisOutcome {
  const net = getLabNetwork();
  const quarantined: string[] = [];
  let pulseApplied = false;
  let sqlApplied = false;

  const pulse = net.applyChemotaxisPulse(packet.nodeId, packet.strength);
  if (pulse) {
    record("operator", pulse);
    pulseApplied = true;
  } else {
    quarantined.push(`pulse (node "${packet.nodeId}", strength ${String(packet.strength)})`);
  }

  if (packet.sql !== null) {
    const queryId = packet.queryId ?? getLabStore().getState().selectedQueryId;
    const error = queryId ? applyQuerySql(queryId, packet.sql) : "no query selected";
    if (error === null) sqlApplied = true;
    else quarantined.push(`SQL payload (${error})`);
  }

  const notice =
    quarantined.length === 0
      ? `Chemotaxis packet ${packet.packetId} applied`
      : `CHEMOTAXIS PACKET ${packet.packetId} QUARANTINED: ${quarantined.join("; ")}. ${
          pulseApplied || sqlApplied ? "The valid parts were applied." : "Network unchanged."
        }`;
  publish({ notice });
  return { pulseApplied, sqlApplied, quarantined, notice };
}
