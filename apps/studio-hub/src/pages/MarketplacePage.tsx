import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  PackageCheck,
  Search,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import {
  getTemplateBySlug,
  getTemplateCounts,
  listTemplates,
  MARKETPLACE_FILTER_TAGS,
  type DualModeTemplateEntry,
  type MarketplaceFilterTag,
  type TemplateMode,
} from "@genui-studio/templates";
import { HeroWorkbenchDemo } from "../components/HeroWorkbenchDemo.js";
import { TemplateExportDialog } from "../components/TemplateExportDialog.js";
import {
  SAMPLE_WIREFRAME_FALLBACK_SLUG,
  SAMPLE_WIREFRAME_SLUG,
} from "../lib/workbench-entry.js";

export interface MarketplacePageProps {
  onOpenPreview: (slug: string) => void;
  /** Opens the workbench with Wireframe Architect and the sample scene loaded. */
  onOpenSampleWireframe?: () => void;
  /** Opens the playable workbench (`/play`) with the flagship playable starter. */
  onOpenPlayableStarter?: () => void;
}

const PIPELINE_STEPS: readonly {
  readonly title: string;
  readonly detail: string;
}[] = [
  {
    title: "Create or load a spec",
    detail: "Start from Signal Relay Vault, a wireframe sketch, or optional Quick Vibe / Master Prompt",
  },
  {
    title: "Configure rules",
    detail: "Sanitized Trigger → Guard → Effect rules with schema-healed props and offline Pivot Macros",
  },
  {
    title: "Play & inspect flow",
    detail: "Click, drag, and tick through the live UI while Flow Map pulses fired rules and history records snapshots",
  },
  {
    title: "Fuzz & replay traces",
    detail: "Verify whether win/lose outcomes are reachable with fast-check, catch dead rules, and replay shortest traces",
  },
  {
    title: "Export the result",
    detail: "Download a runnable Next.js 15 starter or an executable Agent Skill & Contract Pack (.zip)",
  },
];

const FLAGSHIP_SLUGS = [
  "afterdark-horror",
  "ninety9-archive",
  "cmos-cloud-bios",
  "neuro-chimera-synth",
] as const;

const FLAGSHIP_ARCHITECTURAL_NOTES: Record<string, string> = {
  "afterdark-horror":
    "5 WebGL cemetery & crypt scenes via THREE.InstancedMesh, procedural Web Audio synthesis, and dark-to-light theme restoration inside a scoped container.",
  "ninety9-archive":
    "Strict 5-tone monochrome token governance, 6 multi-page routes, 34 indexed 1990s dossiers, playable 1-bit arcade, and deterministic live JSONL remixes.",
  "cmos-cloud-bios":
    "Keyboard-first 1994 Award BIOS state machine, 3D PCB thermal twin, FSK modem audio, and deterministic Terraform, Docker Compose, and Vercel IaC compilation.",
  "neuro-chimera-synth":
    "Physarum bio-SQL network simulator, recursive-descent SQL parser with EXPLAIN cost planner, 3 local deterministic optimizer agents, and Web Audio FM synth.",
};

const CORE_PILLARS: readonly {
  readonly icon: typeof Cpu;
  readonly title: string;
  readonly summary: string;
  readonly metric: string;
}[] = [
  {
    icon: Cpu,
    title: "Playable behavioral engine & live Flow Map",
    summary:
      "Execute declarative Trigger → Guard → Effect rules on TimeTravelStateStore with Web Audio synth, live SVG rule pulses, and fast-check winnability fuzzing.",
    metric: "/play Signal Relay Vault · shortestTraces",
  },
  {
    icon: ShieldCheck,
    title: "Dual-mode BYO-LLM & zero-LLM wireframe compiler",
    summary:
      "Stream Quick Vibes or Markdown Master Prompts via Yantra AI / OpenAI / Gemini / Ollama with rollback safety, or compile Excalidraw & Pivot Macros offline.",
    metric: "0 fake NLP · 3-color DFS + Zod healing",
  },
  {
    icon: PackageCheck,
    title: "Universal Agent Skill Packs & Next.js 15 export",
    summary:
      "Export executable AppDriver contract suites (passing reference-driver vs failing production stub) for Kiro/Cursor/Claude Code/Codex, or runnable Next.js 15 starters.",
    metric: "MIT license · 163 automated tests",
  },
];

/**
 * Restrained, high-craft miniature UI previews tailored to each of the 4 reference apps.
 * Pure declarative JSX (zero raw HTML, zero fake decorative charts).
 */
const ShowcaseThumbnail: React.FC<{ readonly slug: string }> = ({ slug }) => {
  if (slug === "afterdark-horror") {
    return (
      <div
        aria-hidden="true"
        className="relative h-40 w-full overflow-hidden border-b border-[#E4E4E7] bg-[#070709] p-4 font-mono text-[0.625rem] text-zinc-400 select-none"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 75% 25%, rgba(220,38,38,0.18), transparent 55%)",
          }}
        />
        <div className="relative flex items-center justify-between border-b border-white/10 pb-2">
          <span className="text-red-400 font-semibold tracking-wider">
            SIGNAL LOST // 02:17 AM
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[0.5625rem] text-zinc-400">
            WebGL · 5 Zones
          </span>
        </div>
        <div className="relative mt-4 grid grid-cols-12 gap-2.5 items-end">
          <div className="col-span-7 space-y-1.5">
            <div className="text-sm font-semibold tracking-tight text-zinc-100">
              AFTERDARK 2.0
            </div>
            <div className="text-[0.625rem] text-zinc-400 leading-snug">
              InstancedMesh crypt · Web Audio · 10-stage Light Mode transition
            </div>
          </div>
          <div className="col-span-5 rounded-md border border-red-500/25 bg-black/70 p-2 space-y-1">
            <div className="flex justify-between text-[0.5625rem] text-zinc-500">
              <span>CLUES</span>
              <span className="text-zinc-200 tabular-nums">3/3</span>
            </div>
            <div className="flex justify-between text-[0.5625rem] text-zinc-500">
              <span>BREAKER</span>
              <span className="text-red-400">ZONE E</span>
            </div>
            <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full w-3/4 bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slug === "ninety9-archive") {
    return (
      <div
        aria-hidden="true"
        className="relative h-40 w-full overflow-hidden border-b border-[#E4E4E7] bg-[#FFFFFF] p-4 font-mono text-[0.625rem] text-[#09090B] select-none"
      >
        <div className="flex items-center justify-between border-b-2 border-[#09090B] pb-1.5 font-bold">
          <span>NINETY9 // 1997 WORKSTATION</span>
          <span className="bg-[#09090B] px-1.5 py-0.5 text-[0.5625rem] text-white">
            5-TONE MONO
          </span>
        </div>
        <div className="mt-3 grid grid-cols-12 gap-2">
          <div className="col-span-5 border border-[#09090B] p-2 space-y-1">
            <div className="text-[0.5625rem] text-[#52525B]">ROUTES (6)</div>
            <div className="text-[0.625rem] font-bold">/archive · /timeline</div>
            <div className="text-[0.625rem] text-[#52525B]">/categories · /arcade</div>
          </div>
          <div className="col-span-7 border border-[#09090B] bg-[#F4F4F5] p-2 space-y-1.5">
            <div className="flex justify-between border-b border-[#D4D4D8] pb-1 text-[0.5625rem]">
              <span className="font-bold">DOSSIER INDEX</span>
              <span className="tabular-nums">34 RECORDS</span>
            </div>
            <div className="space-y-1 text-[0.5625rem] text-[#3F3F46]">
              <div className="flex justify-between">
                <span>01 · NeXTSTEP 3.3</span>
                <span>1995</span>
              </div>
              <div className="flex justify-between">
                <span>02 · BeOS PR2</span>
                <span>1997</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slug === "cmos-cloud-bios") {
    return (
      <div
        aria-hidden="true"
        className="relative h-40 w-full overflow-hidden border-b border-[#E4E4E7] bg-[#0000AA] p-4 font-mono text-[0.625rem] text-[#FFFFFF] select-none"
      >
        <div className="border-2 border-double border-white/90 h-full p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/40 pb-1 text-[#FFFF55] font-bold">
            <span>AWARD MODULAR BIOS v4.51PG</span>
            <span>3D PCB</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[0.5625rem]">
            <div className="space-y-0.5">
              <div className="bg-[#AA0000] px-1 text-[#FFFF55]">
                &gt; Standard CMOS Setup
              </div>
              <div className="px-1 text-white/90">PC Health &amp; Thermal</div>
              <div className="px-1 text-white/90">Cloud IaC Compiler</div>
            </div>
            <div className="border-l border-white/30 pl-2 space-y-0.5 text-white/90">
              <div>docker-compose.yml</div>
              <div>vercel.json</div>
              <div>main.tf · FSK audio</div>
            </div>
          </div>
          <div className="flex justify-between border-t border-white/40 pt-1 text-[0.5625rem] text-[#FFFF55]">
            <span>F10: Save &amp; Compile</span>
            <span>ESC: Exit</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="relative h-40 w-full overflow-hidden border-b border-[#E4E4E7] bg-[#041016] p-4 font-mono text-[0.625rem] text-teal-100 select-none"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 80%, rgba(0,245,184,0.16), transparent 55%)",
        }}
      />
      <div className="relative flex items-center justify-between border-b border-teal-400/20 pb-1.5">
        <span className="font-semibold text-[#00F5B8]">
          CHIMERA // LAB · BIO-SQL
        </span>
        <span className="text-[0.5625rem] text-amber-300">3 Local Agents</span>
      </div>
      <div className="relative mt-3 grid grid-cols-12 gap-2">
        <div className="col-span-7 rounded border border-teal-400/25 bg-black/50 p-2 space-y-1">
          <div className="text-[0.5625rem] text-teal-300">SELECT node, latency</div>
          <div className="text-[0.5625rem] text-zinc-400">
            FROM physarum_mesh WHERE cost &lt; 12
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-[0.5625rem] text-[#00F5B8]">
            <span>EXPLAIN COST: 4.18</span>
            <span>·</span>
            <span>FM AUDIO</span>
          </div>
        </div>
        <div className="col-span-5 rounded border border-teal-400/20 bg-black/40 p-2 flex flex-col justify-between">
          <div className="text-[0.5625rem] text-zinc-400">PHYSARUM FLUX</div>
          <div className="flex items-end gap-1 h-10">
            <span className="w-1/4 h-4 bg-teal-400/40 rounded-xs" />
            <span className="w-1/4 h-7 bg-teal-400/65 rounded-xs" />
            <span className="w-1/4 h-5 bg-amber-300/75 rounded-xs" />
            <span className="w-1/4 h-9 bg-[#00F5B8] rounded-xs" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  onOpenPreview,
  onOpenSampleWireframe,
  onOpenPlayableStarter,
}) => {
  const [modeFilter, setModeFilter] = useState<"all" | TemplateMode>("all");
  const [activeTag, setActiveTag] = useState<"all" | MarketplaceFilterTag>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [exportTemplate, setExportTemplate] =
    useState<DualModeTemplateEntry | null>(null);

  const counts = getTemplateCounts();

  const filteredTemplates = useMemo(
    () =>
      listTemplates({
        mode: modeFilter,
        tag: activeTag,
        tier: "all",
        searchQuery,
      }),
    [modeFilter, activeTag, searchQuery],
  );

  const featuredFlagships = useMemo(
    () =>
      FLAGSHIP_SLUGS.map((slug) => getTemplateBySlug(slug)).filter(
        (t): t is DualModeTemplateEntry => Boolean(t),
      ),
    [],
  );

  const primaryWorkbenchSlug = useMemo(() => {
    const preferred =
      getTemplateBySlug(SAMPLE_WIREFRAME_SLUG) ??
      getTemplateBySlug(SAMPLE_WIREFRAME_FALLBACK_SLUG);
    return (
      preferred?.manifest.slug ??
      filteredTemplates[0]?.manifest.slug ??
      SAMPLE_WIREFRAME_FALLBACK_SLUG
    );
  }, [filteredTemplates]);

  const openWorkbench = () => {
    if (onOpenSampleWireframe) onOpenSampleWireframe();
    else onOpenPreview(primaryWorkbenchSlug);
  };

  const handleCopyCommand = (command: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(command);
      setCopiedSlug(key);
      setTimeout(() => setCopiedSlug(null), 1800);
    }
  };

  const hasActiveFilters =
    modeFilter !== "all" || activeTag !== "all" || searchQuery.trim().length > 0;

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-[#09090B] flex flex-col selection:bg-[#DBEAFE] selection:text-[#1E3A8A]">
      {/* Skip link targeting the main heading per WCAG 2.4.1 & screen magnifier best practice */}
      <a href="#main-content" className="visually-hidden hub-skip-link">
        Skip to main content
      </a>

      {/* 1. Minimal Sticky Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E4E4E7] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-[1160px] flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-2.5 text-[#09090B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 rounded-md"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] shadow-sm ring-2 ring-[#BFDBFE]"
            >
              <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none">
                <path
                  d="M7.6 13.2c3.3-1.1 6.3-3.4 9.4-9.1 1.4 3.6 4 6.2 7.4 8.1-5.1 2.2-11.2 2.8-16.8 1Z"
                  fill="#60A5FA"
                  stroke="#BFDBFE"
                  strokeLinejoin="round"
                  strokeWidth="1.1"
                />
                <path
                  d="M6 14.1c5.9-2.1 14.2-2.1 20 0-2.6 2.5-16.9 3.3-20 0Z"
                  fill="#FBBF24"
                />
                <path
                  d="m16.7 6.8.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2.7-1.5Z"
                  fill="#FEF3C7"
                />
                <path
                  d="M10 15.1c1.7-1 9.9-1 11.8.1l-.4 5.4c-.2 2.6-2.1 4.5-5.6 7.1-3.5-2.6-5.4-4.5-5.6-7.1l-.2-5.5Z"
                  fill="#F8FAFC"
                />
                <path
                  d="M12.1 15.5c1.1-.8 5.9-.8 7 0l-.5 3.4c-.3 1.6-1.4 2.4-3 2.4s-2.7-.8-3-2.4l-.5-3.4Z"
                  fill="#F4C99A"
                />
                <path
                  d="M13.8 17.4h.1m3.9 0h.1"
                  stroke="#1E293B"
                  strokeLinecap="round"
                  strokeWidth="1.3"
                />
                <path
                  d="M14.4 19.2c.8.5 1.6.5 2.4 0"
                  stroke="#92400E"
                  strokeLinecap="round"
                  strokeWidth=".9"
                />
              </svg>
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">
              WizFrame
            </span>
            <span className="hidden rounded border border-[#E4E4E7] bg-[#FAFAFA] px-1.5 py-0.5 font-mono text-[0.625rem] font-medium text-[#52525B] sm:inline">
              Interactive UI Workbench
            </span>
          </a>

          <nav
            aria-label="Primary"
            className="flex shrink-0 items-center gap-1 sm:gap-2"
          >
            <a
              href="#workflow"
              className="hidden md:inline-flex min-h-[32px] items-center rounded-md px-2.5 text-xs font-medium text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F5] transition focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
            >
              Architecture
            </a>
            <a
              href="#featured"
              className="hidden md:inline-flex min-h-[32px] items-center rounded-md px-2.5 text-xs font-medium text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F5] transition focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
            >
              Applications
            </a>
            <a
              href="#catalog"
              className="hidden md:inline-flex min-h-[32px] items-center rounded-md px-2.5 text-xs font-medium text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F5] transition focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
            >
              Registry ({counts.total})
            </a>
            {onOpenPlayableStarter ? (
              <button
                type="button"
                onClick={onOpenPlayableStarter}
                data-testid="header-open-playable-starter"
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
              >
                <span>Play Workbench (/play)</span>
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={openWorkbench}
              data-testid="header-open-sample-wireframe"
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-[#09090B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#18181B] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
            >
              <span>Wireframe Architect</span>
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* 2. Hero + Real Interactive Wireframe Compiler Sandbox */}
        <section className="relative border-b border-[#E4E4E7] bg-white">
          <div
            aria-hidden="true"
            className="hub-dot-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]"
          />

          <div className="relative mx-auto max-w-[1160px] px-4 pt-12 pb-14 sm:px-6 sm:pt-16 sm:pb-20 space-y-10">
            <div className="mx-auto max-w-[740px] text-center space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-white px-3 py-1 font-mono text-[0.6875rem] font-medium text-[#52525B] shadow-2xs">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[#2563EB]"
                />
                <span>WizFrame — Interactive UI Workbench · built on @genui-studio/core &amp; @json-render v0.22</span>
              </div>

              <h1
                id="main-content"
                tabIndex={-1}
                className="hub-display-heading font-bold text-[#09090B] focus:outline-none"
              >
                Turn a brief or wireframe into a playable, testable UI.
              </h1>

              <p className="hub-body-copy mx-auto max-w-[60ch] text-base text-[#52525B] leading-relaxed sm:text-[1.0625rem]">
                WizFrame turns a creative brief or wireframe into an interactive
                UI, lets you inspect and fuzz-test the behavior behind it, and
                exports the result as a runnable Next.js 15 app or a reusable
                agent skill pack.
              </p>

              {/* Primary & Secondary CTAs */}
              <div className="flex flex-col items-stretch justify-center gap-2.5 pt-1 sm:flex-row sm:items-center">
                {onOpenPlayableStarter ? (
                  <button
                    type="button"
                    onClick={onOpenPlayableStarter}
                    data-testid="hero-open-playable-starter"
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#09090B] px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-[#18181B] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                  >
                    <span>Play the Signal Relay Vault</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openWorkbench}
                  data-testid="hero-open-sample-wireframe"
                  className={
                    onOpenPlayableStarter
                      ? "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-5 py-2.5 text-sm font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                      : "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#09090B] px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-[#18181B] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                  }
                >
                  <span>Open Sample Wireframe in Workbench</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
                <a
                  href="#catalog"
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-5 py-2.5 text-sm font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] transition focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                >
                  <span>Browse Registry</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 font-mono text-[0.6875rem] text-[#71717A]">
                <span>MIT licensed</span>
                <span aria-hidden="true">·</span>
                <span>Offline-ready + optional BYO-LLM (.env.local)</span>
                <span aria-hidden="true">·</span>
                <span>163 automated tests &amp; fast-check PBT</span>
              </div>
            </div>

            {/* Real Interactive Compiler Preview (replaces fake marketing mockups) */}
            <HeroWorkbenchDemo
              onOpenWorkbench={(slug, loadSample) => {
                if (loadSample && onOpenSampleWireframe) onOpenSampleWireframe();
                else onOpenPreview(slug);
              }}
            />

            {/* Compact 5-Step Pipeline Rail */}
            <ol
              role="list"
              data-testid="first-success-steps"
              aria-label="Wireframe-to-application pipeline"
              className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#E4E4E7] sm:grid-cols-2 lg:grid-cols-5"
            >
              {PIPELINE_STEPS.map((step, idx) => (
                <li
                  key={step.title}
                  className="bg-white px-4 py-3.5 flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[0.6875rem] font-semibold tabular-nums text-[#2563EB]">
                      0{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-[#09090B]">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#52525B] leading-snug">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3. Engineering Architecture Guarantees */}
        <section
          id="workflow"
          className="mx-auto max-w-[1160px] px-4 py-14 sm:px-6 sm:py-16 space-y-8"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <p className="font-mono text-xs font-medium text-[#2563EB]">
                @genui-studio/core
              </p>
              <h2 className="hub-section-heading font-bold text-[#09090B]">
                Built for deterministic UI generation, not fragile prompts.
              </h2>
            </div>
            <p className="max-w-[44ch] text-sm text-[#52525B]">
              One guardrailed runtime powers every template, wireframe, and
              standalone app in the workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CORE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="hub-card p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] text-[#09090B]">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#09090B]">
                      {pillar.title}
                    </h3>
                    <p className="hub-body-copy text-xs text-[#52525B] leading-relaxed">
                      {pillar.summary}
                    </p>
                  </div>
                  <div className="border-t border-[#F4F4F5] pt-3 font-mono text-[0.6875rem] text-[#71717A]">
                    {pillar.metric}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Copyable CLI Quickstart Bar */}
          <div className="hub-code-surface flex flex-col items-stretch justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5 min-w-0 font-mono text-xs">
              <Terminal aria-hidden="true" className="h-4 w-4 shrink-0 text-[#60A5FA]" />
              <code className="truncate text-zinc-200 select-all">
                npx genui-studio add product-landing-starter
              </code>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopyCommand(
                  "npx genui-studio add product-landing-starter",
                  "cli-quickstart",
                )
              }
              className="inline-flex min-h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-3 py-1 font-mono text-[0.6875rem] font-medium text-white hover:bg-white/15 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              {copiedSlug === "cli-quickstart" ? (
                <>
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Copy command</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* 4. Reference Applications Built on the Skeleton */}
        <section
          id="featured"
          data-testid="marketplace-featured-flagship"
          className="border-y border-[#E4E4E7] bg-white"
        >
          <div className="mx-auto max-w-[1160px] px-4 py-14 sm:px-6 sm:py-16 space-y-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <p className="font-mono text-xs font-medium text-[#2563EB]">
                  Foundation Examples
                </p>
                <h2 className="hub-section-heading font-bold text-[#09090B]">
                  Example apps built on the same core engine.
                </h2>
              </div>
              <p className="max-w-[46ch] text-sm text-[#52525B]">
                Supporting MIT-licensed examples demonstrating what the
                underlying @genui-studio/core engine can run—previewable inside
                scoped containers and exportable as Next.js starters.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {featuredFlagships.map((entry) => {
                const { manifest } = entry;
                const cliCmd = `npx genui-studio add ${manifest.slug}`;
                const modeLabel =
                  manifest.mode === "standalone"
                    ? "Mode B · Standalone"
                    : "Mode A · Native";

                return (
                  <article
                    key={manifest.slug}
                    className="hub-card overflow-hidden flex flex-col justify-between transition hover:border-[#D4D4D8]"
                  >
                    <div>
                      <ShowcaseThumbnail slug={manifest.slug} />
                      <div className="p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-base font-semibold tracking-tight text-[#09090B]">
                            {manifest.title}
                          </h3>
                          <span className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2 py-0.5 font-mono text-[0.625rem] font-medium text-[#52525B]">
                            {modeLabel}
                          </span>
                        </div>

                        <p className="hub-body-copy text-xs text-[#52525B] leading-relaxed">
                          {FLAGSHIP_ARCHITECTURAL_NOTES[manifest.slug] ??
                            manifest.description}
                        </p>

                        {/* Copyable CLI Install Command */}
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-1.5 font-mono text-[0.6875rem] text-[#3F3F46]">
                          <code className="truncate select-all">{cliCmd}</code>
                          <button
                            type="button"
                            onClick={() => handleCopyCommand(cliCmd, manifest.slug)}
                            aria-label={`Copy CLI command for ${manifest.title}`}
                            className="inline-flex min-h-[24px] shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium text-[#52525B] hover:bg-[#E4E4E7]/60 hover:text-[#09090B] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1"
                          >
                            {copiedSlug === manifest.slug ? (
                              <>
                                <Check aria-hidden="true" className="h-3 w-3 text-[#047857]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy aria-hidden="true" className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t border-[#F4F4F5] bg-[#FAFAFA]/70 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenPreview(manifest.slug)}
                        aria-label={`Open Preview for ${manifest.title}`}
                        className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#09090B] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#18181B] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                      >
                        <span>Open Preview</span>
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportTemplate(entry)}
                        aria-label={`Export ${manifest.title}`}
                        className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                      >
                        <Download aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Export</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. Filterable Starter & Template Registry */}
        <section
          id="catalog"
          className="mx-auto max-w-[1160px] px-4 py-14 sm:px-6 sm:py-16 space-y-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="font-mono text-xs font-medium text-[#2563EB]">
                Catalog Registry
              </p>
              <h2 className="hub-section-heading font-bold text-[#09090B]">
                Starter packs &amp; dual-mode templates
              </h2>
            </div>
            <div className="font-mono text-xs tabular-nums text-[#71717A]">
              Showing {filteredTemplates.length} of {counts.total} packs ·{" "}
              {counts.native} native · {counts.standalone} standalone
            </div>
          </div>

          {/* Unified Filter Toolbar */}
          <div className="hub-card p-3 space-y-3">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
              {/* Accessible Search Input */}
              <div className="relative flex-1 max-w-md">
                <label htmlFor="registry-search" className="visually-hidden">
                  Search templates and starter packs
                </label>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]"
                />
                <input
                  id="registry-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, slug, or capability..."
                  className="min-h-[36px] w-full rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] pl-9 pr-3 py-1.5 text-xs text-[#09090B] placeholder:text-[#71717A] focus:border-[#2563EB] focus:bg-white focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition"
                />
              </div>

              {/* Segmented Mode Filter */}
              <div
                role="group"
                aria-label="Filter by template mode"
                className="inline-flex items-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-0.5 text-xs self-start md:self-auto"
              >
                {(
                  [
                    ["all", `All (${counts.total})`],
                    ["native", "Mode A · Native"],
                    ["standalone", "Mode B · Standalone"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={modeFilter === mode}
                    onClick={() => setModeFilter(mode)}
                    className={`min-h-[30px] rounded-md px-3 py-1 font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 ${
                      modeFilter === mode
                        ? "bg-white text-[#09090B] shadow-2xs font-semibold"
                        : "text-[#52525B] hover:text-[#09090B]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Tag Strip */}
            <div
              role="group"
              aria-label="Filter by capability tag"
              className="hub-scroll-row items-center gap-1.5 border-t border-[#F4F4F5] pt-2.5 sm:flex-wrap"
            >
              <button
                type="button"
                aria-pressed={activeTag === "all"}
                onClick={() => setActiveTag("all")}
                className={`min-h-[28px] rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 ${
                  activeTag === "all"
                    ? "border-[#09090B] bg-[#09090B] text-white"
                    : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
                }`}
              >
                All tags
              </button>
              {MARKETPLACE_FILTER_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={activeTag === tag}
                  onClick={() => setActiveTag(tag)}
                  className={`min-h-[28px] rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 ${
                    activeTag === tag
                      ? "border-[#09090B] bg-[#09090B] text-white"
                      : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
                  }`}
                >
                  {tag}
                </button>
              ))}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setModeFilter("all");
                    setActiveTag("all");
                    setSearchQuery("");
                  }}
                  className="ml-auto inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#52525B] hover:text-[#09090B] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Registry Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="hub-card p-10 text-center space-y-2">
              <p className="text-sm font-medium text-[#09090B]">
                No templates match the current filters.
              </p>
              <p className="text-xs text-[#71717A]">
                Try clearing the search query or switching back to all modes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((entry) => {
                const { manifest } = entry;
                const componentCount = entry.catalog.metadata.componentNames.length;
                const modeLabel =
                  manifest.mode === "standalone"
                    ? "Mode B · Standalone"
                    : "Mode A · Native";

                return (
                  <article
                    key={manifest.slug}
                    data-testid={`marketplace-card-${manifest.slug}`}
                    className="hub-card hub-registry-card p-5 flex flex-col justify-between gap-4 transition hover:border-[#D4D4D8]"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[0.625rem] font-medium ${
                            manifest.mode === "standalone"
                              ? "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
                              : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: manifest.theme.accentColor }}
                          />
                          {modeLabel}
                        </span>
                        <span className="font-mono text-[0.625rem] text-[#71717A]">
                          {manifest.license}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold tracking-tight text-[#09090B]">
                          {manifest.title}
                        </h3>
                        <p className="line-clamp-2 text-xs text-[#52525B] leading-relaxed">
                          {manifest.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] tabular-nums text-[#71717A]">
                        <span>{componentCount} blocks</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {manifest.pages.length}{" "}
                          {manifest.pages.length === 1 ? "route" : "routes"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{manifest.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t border-[#F4F4F5] pt-3.5">
                      <button
                        type="button"
                        onClick={() => onOpenPreview(manifest.slug)}
                        data-testid={`preview-btn-${manifest.slug}`}
                        aria-label={`Open Preview for ${manifest.title}`}
                        className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#09090B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#18181B] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                      >
                        <span>Open Preview</span>
                        <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportTemplate(entry)}
                        aria-label={`Export ${manifest.title}`}
                        className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                      >
                        <Download aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Export</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 6. Restrained Footer */}
      <footer className="border-t border-[#E4E4E7] bg-white">
        <div className="mx-auto flex max-w-[1160px] flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-[#71717A] sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#09090B]">WizFrame</span>
            <span aria-hidden="true">·</span>
            <span>Interactive UI Workbench</span>
            <span aria-hidden="true">·</span>
            <span>MIT License</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[0.6875rem]">@genui-studio/core</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#workflow"
              className="hover:text-[#09090B] transition focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 rounded"
            >
              Architecture
            </a>
            <a
              href="#featured"
              className="hover:text-[#09090B] transition focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 rounded"
            >
              Applications
            </a>
            <a
              href="#catalog"
              className="hover:text-[#09090B] transition focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 rounded"
            >
              Registry
            </a>
          </div>
        </div>
      </footer>

      {exportTemplate && (
        <TemplateExportDialog
          isOpen
          onClose={() => setExportTemplate(null)}
          template={exportTemplate}
        />
      )}
    </div>
  );
};
