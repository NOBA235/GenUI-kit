import { z } from "zod";
import type { Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog, specToJsonlStream } from "@genui-studio/core";
import { CHIMERA_SCENARIOS } from "./lib/chimera/scenarios.js";
import { MAX_SQL_LENGTH } from "./lib/chimera/sql-parser.js";

const SCENARIO_IDS = CHIMERA_SCENARIOS.map((s) => s.id) as [string, ...string[]];

const shortText = (max: number) => z.string().min(1).max(max);

export const verifiedCatalog = createVerifiedCatalog(schema, {
  components: {
    ChimeraLabShell: {
      description:
        "Root workspace for CHIMERA // LAB. Switches between CHIMERA LAB WORKBENCH (bio-network canvas + SQL, optimizer agent constellation and sonification deck) and AI RESEARCH SAAS LANDING PAGE modes, loads a Physarum query-network scenario, steps the solver on a timer, and can run the three local optimizer agents as a night shift.",
      props: z.object({
        workspaceTitle: shortText(80),
        defaultMode: z.enum(["workbench", "landing"]),
        scenarioId: z.enum(SCENARIO_IDS),
        autoStep: z.boolean(),
        stepHz: z.number().int().min(1).max(20),
        nightShift: z.boolean(),
      }),
      slots: ["default"],
    },
    BioNetworkCanvas: {
      description:
        "Live Physarum slime-mould network of services and databases on a 2D canvas: glowing cyan-emerald tubes carry query flux, crimson nodes pulse on full-table scans or saturation, amber diamonds are local optimizer agents. Click a node to sever it, inject an index or dispatch an agent; drag it to change link latency.",
      props: z.object({
        caption: shortText(80),
        // Matches MAX_PARTICLES in components/BioNetworkCanvas.tsx.
        particleBudget: z.number().int().min(0).max(1500),
        showLabels: z.boolean(),
      }),
      slots: [],
    },
    SqlAstExecutionCompare: {
      description:
        "SQL command deck: edit the selected query, inspect its parse tree, and compare the EXPLAIN plan BEFORE vs AFTER AGENT OPTIMIZATION with per-request planner estimates and 1-click index migrations or N+1 batching.",
      props: z.object({
        heading: shortText(60),
        showAst: z.boolean(),
      }),
      slots: [],
    },
    OptimizerAgentConstellation: {
      description:
        "Local SQL optimizer agent constellation for chimera-architect, index-surgeon and deadlock-hunter: deterministic agent profiles, audit cron schedule previews, dispatch buttons, and the lab activity feed as commit-style checkpoints.",
      props: z.object({
        heading: shortText(60),
        utcOffsetMinutes: z.number().int().min(-720).max(840),
        showCronPreview: z.boolean(),
      }),
      slots: [],
    },
    SonificationSpectrumHUD: {
      description:
        "Harmonic sonification analyzer: live FFT of the lab's Web Audio output with predicted FM partials overlaid, enable/mute/volume/root-frequency controls, and a text equivalent of the drone, synapse grains and Geiger clicks.",
      props: z.object({
        heading: shortText(60),
        showPartials: z.boolean(),
      }),
      slots: [],
    },
    BiotechHeroSection: {
      description:
        "Landing-page hero for AI RESEARCH SAAS LANDING PAGE mode with headline, install command, feature list and live network figures.",
      props: z.object({
        eyebrow: shortText(80),
        headline: shortText(120),
        subheadline: shortText(320),
        primaryCtaLabel: shortText(40),
        installCommand: shortText(80),
        features: z.array(shortText(120)).min(1).max(6),
      }),
      slots: [],
    },
    InteractiveBenchmarkBento: {
      description:
        "Landing-page benchmark matrix that runs every scenario through the solver and optimizer agent (rows load the scenario into the live canvas), plus an architecture bento grid.",
      props: z.object({
        heading: shortText(60),
        benchmarkCaption: shortText(240),
        architecture: z
          .array(z.object({ tag: shortText(24), title: shortText(60), body: shortText(240) }))
          .min(1)
          .max(8),
      }),
      slots: [],
    },
    PricingTiersSection: {
      description: "Landing-page pricing tiers with features and a call to action per tier.",
      props: z.object({
        heading: shortText(60),
        footnote: shortText(200),
        tiers: z
          .array(
            z.object({
              name: shortText(40),
              priceLabel: shortText(16),
              cadence: shortText(40),
              description: shortText(160),
              features: z.array(shortText(80)).min(1).max(8),
              ctaLabel: shortText(32),
              highlighted: z.boolean(),
            }),
          )
          .min(1)
          .max(4),
      }),
      slots: [],
    },
    ChemotaxisPacket: {
      description:
        "Streamed chemotaxis packet: an attractant pulse at a network node with strength 0-1, optionally carrying a SQL payload for a query. Props are healed by the catalog; packets with an unknown node, invalid strength or unparsable SQL are quarantined without changing the network.",
      props: z.object({
        packetId: shortText(32),
        nodeId: shortText(48),
        strength: z.number().min(0).max(1),
        queryId: z.string().max(48).nullable(),
        sql: z.string().max(MAX_SQL_LENGTH).nullable(),
      }),
      slots: ["default"],
    },
  },
  actions: {},
});

export const SHELL_KEY = "chimera-shell";
export const DEFAULT_WORKSPACE_TITLE = "CHIMERA // LAB  BIO-DIGITAL SQL SYNTHESIZER";

export const initialPageSpecs: Record<string, Spec> = {
  home: {
    root: SHELL_KEY,
    elements: {
      [SHELL_KEY]: {
        type: "ChimeraLabShell",
        props: {
          workspaceTitle: DEFAULT_WORKSPACE_TITLE,
          defaultMode: "workbench",
          scenarioId: "checkout-spike",
          autoStep: true,
          stepHz: 10,
          nightShift: false,
        },
        children: ["canvas", "sql", "crew", "spectrum", "hero", "bench", "pricing"],
      },
      canvas: {
        type: "BioNetworkCanvas",
        props: { caption: "PHYSARUM QUERY NETWORK", particleBudget: 900, showLabels: true },
        children: [],
      },
      sql: {
        type: "SqlAstExecutionCompare",
        props: { heading: "SQL / AST EXECUTION COMPARE", showAst: true },
        children: [],
      },
      crew: {
        type: "OptimizerAgentConstellation",
        props: { heading: "OPTIMIZER AGENT CONSTELLATION", utcOffsetMinutes: 0, showCronPreview: true },
        children: [],
      },
      spectrum: {
        type: "SonificationSpectrumHUD",
        props: { heading: "HARMONIC SONIFICATION", showPartials: true },
        children: [],
      },
      hero: {
        type: "BiotechHeroSection",
        props: {
          eyebrow: "OPEN SOURCE // GENUI STUDIO TEMPLATE",
          headline: "Grow your database like a slime mould.",
          subheadline:
            "CHIMERA // LAB models query traffic as a Physarum network. Full-table scans and N+1 loops glow crimson, local optimizer agents propose the composite indexes and batched rewrites that heal them, and you can hear the network settle.",
          primaryCtaLabel: "OPEN THE LAB",
          installCommand: "npx genui-studio add neuro-chimera-synth",
          features: [
            "Hand-written SQL parser and PostgreSQL-style cost planner, fully deterministic",
            "Physarum solver that re-routes traffic when you sever or drag a node",
            "Three deterministic SQL optimizer agents with schedule previews and checkpoint logs",
            "FM sonification with a live spectrum and text equivalents",
          ],
        },
        children: [],
      },
      bench: {
        type: "InteractiveBenchmarkBento",
        props: {
          heading: "BENCHMARK MATRIX // ARCHITECTURE",
          benchmarkCaption:
            "Each scenario runs 8 solver steps, the deterministic optimizer agent, then 8 more steps. Figures are simulator estimates from the planner's cost model, not measurements of a live database.",
          architecture: [
            {
              tag: "PARSER",
              title: "SQL to AST",
              body: "A bounded recursive-descent parser for a documented SELECT subset. Unsupported syntax fails with a character offset instead of a guess.",
            },
            {
              tag: "PLANNER",
              title: "Cost-based plans",
              body: "Seq Scan, Index Scan, Hash Join, Sort and HNSW paths priced with PostgreSQL's default cost constants, printed as EXPLAIN.",
            },
            {
              tag: "SOLVER",
              title: "Physarum flow network",
              body: "Kirchhoff flow with an implicit conductivity update: tubes carrying fast, indexed traffic thicken while scan-heavy routes wither.",
            },
            {
              tag: "AGENTS",
              title: "Optimizer agent hive",
              body: "chimera-architect, index-surgeon and deadlock-hunter run deterministically in the lab, proposing composite indexes and N+1 batching without mutating any external database.",
            },
            {
              tag: "AUDIO",
              title: "Sonification",
              body: "Health, entropy and full-scan rate drive an FM drone, synapse grains and Geiger clicks through the Web Audio API.",
            },
            {
              tag: "GENUI",
              title: "Verified catalog",
              body: "Every section is a Zod-checked catalog component. Corrupted streams are healed, cycles are severed and faults stay inside one element.",
            },
          ],
        },
        children: [],
      },
      pricing: {
        type: "PricingTiersSection",
        props: {
          heading: "PRICING",
          footnote: "Example tiers for an AI research SaaS landing page. The template itself is MIT licensed and free.",
          tiers: [
            {
              name: "Open Source",
              priceLabel: "$0",
              cadence: "forever",
              description: "The full lab, verified catalog and Next.js starter under the MIT license.",
              features: ["All 7 scenarios", "SQL parser, planner and solver", "Deterministic optimizer agents"],
              ctaLabel: "Open the lab",
              highlighted: false,
            },
            {
              name: "Research",
              priceLabel: "$49",
              cadence: "per seat / month",
              description: "A hosted lab with saved scenarios and team sharing.",
              features: ["Import pg_stat_statements snapshots", "Saved scenario history", "Shared optimization reports"],
              ctaLabel: "Start a trial",
              highlighted: true,
            },
            {
              name: "Enterprise",
              priceLabel: "Custom",
              cadence: "annual",
              description: "Private deployment with SSO and audit logs.",
              features: ["SSO and SCIM", "Read-only replica connectors", "Dedicated support"],
              ctaLabel: "Contact sales",
              highlighted: false,
            },
          ],
        },
        children: [],
      },
    },
  },
};

/* ═══════════════════════════ Remix presets ═══════════════════════════ */

export type ChimeraRemixKind = "night-shift" | "genomics" | "corrupted" | null;

export function classifyRemixPrompt(prompt: string): ChimeraRemixKind {
  const lower = prompt.toLowerCase();
  if (lower.includes("corrupt") || lower.includes("cyclic") || /\bnan\b/.test(lower)) return "corrupted";
  if (lower.includes("night-shift") || lower.includes("night shift") || lower.includes("parallel agents") || lower.includes("refactor")) {
    return "night-shift";
  }
  if (lower.includes("genomic") || lower.includes("protein") || lower.includes("biotech")) return "genomics";
  return null;
}

/** A recursive CTE: outside the parser's SELECT subset, so the SQL payload is rejected with an offset. */
export const CYCLIC_SQL_PAYLOAD = "WITH RECURSIVE loop AS (SELECT id FROM loop) SELECT id FROM loop";

/**
 * Two chemotaxis packets that reference each other (chaos-a → chaos-b → chaos-a), with a null
 * (NaN in transit) strength, an overflowing 1e308 strength, unknown node ids and a cyclic SQL
 * payload. The core severs the cycle and heals the props; the lab store quarantines the rest.
 */
export function buildChaosPacketElements(): Spec["elements"] {
  return {
    "chaos-a": {
      type: "ChemotaxisPacket",
      props: { packetId: "chaos-nan", nodeId: "node-NaN", strength: null, queryId: null, sql: CYCLIC_SQL_PAYLOAD },
      children: ["chaos-b"],
    },
    "chaos-b": {
      type: "ChemotaxisPacket",
      props: { packetId: "chaos-overflow", nodeId: "node-Infinity", strength: 1e308, queryId: null, sql: null },
      children: ["chaos-a"],
    },
  };
}

export function buildRemixJsonl(prompt: string, currentSpec: Spec | null): string {
  const base = currentSpec ?? initialPageSpecs.home!;
  const shell = base.elements[SHELL_KEY];
  const shellProps = (shell?.props as Record<string, unknown> | undefined) ?? {};
  const kind = classifyRemixPrompt(prompt);
  const elements: Spec["elements"] = { ...base.elements };
  const children = [...(shell?.children ?? [])];
  const props: Record<string, unknown> = { ...shellProps };

  if (kind === "night-shift") {
    Object.assign(props, {
      workspaceTitle: "CHIMERA // LAB  AUTONOMOUS AGENT NIGHT-SHIFT",
      defaultMode: "workbench",
      scenarioId: "autonomous-overnight-refactor",
      nightShift: true,
    });
  } else if (kind === "genomics") {
    Object.assign(props, {
      workspaceTitle: "CHIMERA // LAB  GENOMICS PIPELINE & PROTEIN FOLD TELEMETRY",
      defaultMode: "workbench",
      scenarioId: "genomics-pipeline",
      nightShift: false,
    });
  } else if (kind === "corrupted") {
    Object.assign(elements, buildChaosPacketElements());
    if (!children.includes("chaos-a")) children.push("chaos-a");
  }

  elements[SHELL_KEY] = {
    ...(shell ?? { type: "ChimeraLabShell", children: [] }),
    props,
    children,
  };
  return specToJsonlStream({ ...base, elements });
}

export function buildChaosPackets(rootKey: string): string[] {
  const chaos = buildChaosPacketElements();
  return [
    JSON.stringify({ op: "add", path: "/elements/chaos-a", value: chaos["chaos-a"] }),
    JSON.stringify({ op: "add", path: "/elements/chaos-b", value: chaos["chaos-b"] }),
    JSON.stringify({ op: "add", path: `/elements/${rootKey}/children/-`, value: "chaos-a" }),
  ];
}
