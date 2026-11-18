import React, { useMemo, useState } from "react";
import {
  getTemplateBySlug,
  getTemplateCounts,
  listTemplates,
  MARKETPLACE_FILTER_TAGS,
  type DualModeTemplateEntry,
  type MarketplaceFilterTag,
  type TemplateMode,
} from "@genui-studio/templates";
import { TemplateExportDialog } from "../components/TemplateExportDialog";
import {
  SAMPLE_WIREFRAME_FALLBACK_SLUG,
  SAMPLE_WIREFRAME_SLUG,
} from "../lib/workbench-entry.js";

export interface MarketplacePageProps {
  onOpenPreview: (slug: string) => void;
  /** Opens the workbench with Wireframe Architect and the sample scene loaded. */
  onOpenSampleWireframe?: () => void;
}

const FIRST_SUCCESS_STEPS: readonly { readonly title: string; readonly detail: string }[] = [
  { title: "Open sample wireframe", detail: "A sketch with blocks, a state arrow and two deliberate faults" },
  { title: "Compile to Spec", detail: "Deterministic Excalidraw → GenUI Spec + Mermaid, no LLM call" },
  { title: "Inspect diagnostics", detail: "Block mappings, $state bindings, healed props and warnings" },
  { title: "Preview interactive UI", detail: "Rendered through SafeGenUIRenderer with fault isolation" },
  { title: "Export React starter", detail: "Runnable Next.js .zip with the catalog and Kiro spec" },
];

const FLAGSHIP_SLUGS = [
  "afterdark-horror",
  "ninety9-archive",
  "cmos-cloud-bios",
] as const;

const FLAGSHIP_DEMONSTRATIONS: Record<string, string> = {
  "afterdark-horror":
    "Demonstrates 60 FPS Three.js instanced WebGL worlds, procedural Web Audio synthesis, and instant dark-to-light theme restoration inside a scoped GenUI container.",
  "ninety9-archive":
    "Demonstrates strict 5-tone monochrome token governance, multi-page route state (/ , /archive, /dossiers, /system), and deterministic live JSONL layout remixes.",
  "cmos-cloud-bios":
    "Demonstrates keyboard-first BIOS state machines, 3D PCB thermal telemetry, and live client-side Terraform + Docker Compose compilation.",
};

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  onOpenPreview,
  onOpenSampleWireframe,
}) => {
  const [modeFilter, setModeFilter] = useState<"all" | TemplateMode>("all");
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "pro">("all");
  const [activeTag, setActiveTag] = useState<"all" | MarketplaceFilterTag>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [exportTemplate, setExportTemplate] =
    useState<DualModeTemplateEntry | null>(null);

  const counts = getTemplateCounts();

  const filteredTemplates = useMemo(
    () =>
      listTemplates({
        mode: modeFilter,
        tag: activeTag,
        tier: tierFilter,
        searchQuery,
      }),
    [modeFilter, activeTag, tierFilter, searchQuery],
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

  return (
    <div className="min-h-dvh bg-white text-[#0B1221] flex flex-col selection:bg-[#DBEAFE] selection:text-[#1E3A8A]">
      {/* 1. Crisp Studio Header */}
      <header className="sticky top-0 z-30 border-b border-[#E8EDF5] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1324] font-mono text-xs font-bold text-white shadow-sm"
            >
              G
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-base font-bold tracking-tight text-[#0B1221]">
                  GenUI Studio Hub
                </span>
                <span className="hidden rounded-full border border-[#DBEAFE] bg-[#EFF4FF] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#2563EB] lg:inline">
                  Excalidraw-to-GenUI Workbench
                </span>
              </div>
              <p className="hidden truncate text-xs text-[#5B6B82] sm:block">
                Wireframe → validated UI preview → React starter
              </p>
            </div>
          </div>

          <nav
            aria-label="Platform sections"
            className="flex shrink-0 items-center gap-1.5 sm:gap-2"
          >
            <a
              href="#workflow"
              className="hub-cta hidden md:inline-flex min-h-[36px] items-center px-3.5 py-1.5 text-xs font-semibold text-[#5B6B82] hover:bg-[#F8FAFC] hover:text-[#0B1221] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition"
            >
              How It Works
            </a>
            <a
              href="#catalog"
              className="hub-cta hidden md:inline-flex min-h-[36px] items-center px-3.5 py-1.5 text-xs font-semibold text-[#5B6B82] hover:bg-[#F8FAFC] hover:text-[#0B1221] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition"
            >
              Starter Catalogs ({counts.total})
            </a>
            <a
              href="#featured"
              className="hub-cta hidden md:inline-flex min-h-[36px] items-center px-3.5 py-1.5 text-xs font-semibold text-[#5B6B82] hover:bg-[#F8FAFC] hover:text-[#0B1221] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition"
            >
              Reference Demos
            </a>
            <button
              type="button"
              onClick={openWorkbench}
              data-testid="header-open-sample-wireframe"
              className="inline-flex min-h-[36px] items-center rounded-full bg-[#0B1324] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#16223B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
            >
              Open Workbench
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 sm:px-8 sm:py-16 space-y-16 sm:space-y-24">
        {/* 2. Hero + Deep Navy Pill CTA + Multi-Device Layered Product Stage */}
        <section className="space-y-10">
          <div className="mx-auto max-w-[780px] text-center space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-[#F3F7FF] px-3.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[#2563EB]"
              />
              Excalidraw-to-GenUI Workbench
            </div>

            <h1 className="hub-display-heading font-extrabold text-[#0B1221]">
              Turn a wireframe into a validated, interactive UI preview.
            </h1>

            <p className="hub-body-copy mx-auto max-w-[60ch] text-base sm:text-lg text-[#5B6B82] leading-relaxed">
              Sketch with catalog-backed blocks in Excalidraw. The workbench
              compiles the sketch to a GenUI Spec, shows exactly which block
              became which component and what was healed, renders the live
              preview, and exports a usable React starter.
            </p>

            {/* Primary first-success CTA + Caption */}
            <div className="pt-2 space-y-3">
              <div className="mx-auto flex w-full max-w-[420px] flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={openWorkbench}
                  data-testid="hero-open-sample-wireframe"
                  className="inline-flex min-h-[48px] w-full items-center justify-center px-6 py-3.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-white bg-[#0B1324] shadow-[0_14px_30px_-6px_rgba(11,19,36,0.38)] hover:bg-[#16223B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer sm:w-auto sm:px-8"
                >
                  Open Sample Wireframe in Workbench
                </button>
                <a
                  href="#catalog"
                  className="hub-cta inline-flex min-h-[48px] w-full items-center justify-center border border-[#CBD5E1] bg-white px-6 py-3.5 text-center text-xs font-bold uppercase tracking-[0.06em] text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition sm:w-auto"
                >
                  Start From a Catalog
                </a>
              </div>
              <p className="text-xs font-medium text-[#64748B]">
                MIT runtime · Deterministic Excalidraw &amp; Zod compiler · No
                LLM call required
              </p>
            </div>

            {/* 5-step first-success path */}
            <ol
              data-testid="first-success-steps"
              aria-label="First-success path"
              className="mx-auto grid max-w-[900px] grid-cols-1 gap-2 pt-4 text-left sm:grid-cols-2 lg:grid-cols-5"
            >
              {FIRST_SUCCESS_STEPS.map((step, idx) => (
                <li
                  key={step.title}
                  className="rounded-xl border border-[#E8EDF5] bg-white px-3 py-2.5"
                >
                  <div className="font-mono text-[10px] font-bold text-[#2563EB]">
                    0{idx + 1}
                  </div>
                  <div className="text-xs font-bold text-[#0B1221]">
                    {step.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[#5B6B82]">
                    {step.detail}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Layered 3-Device Product Stage Composition (Desktop Workbench + Left Audit Card + Right Mobile Preview) */}
          <div className="relative mx-auto max-w-[1060px] pt-2 lg:pb-10">
            {/* Soft Ambient Radial Glow Behind Stage */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-12 -top-4 bottom-4 -z-10 rounded-[40px] bg-gradient-to-b from-[#EFF4FF]/80 via-[#F8FAFC]/50 to-transparent blur-2xl"
            />

            {/* Center Desktop Studio Workbench Window */}
            <div className="mx-auto max-w-[900px] rounded-[24px] border border-[#DCE4F0] bg-white shadow-[0_32px_80px_-20px_rgba(15,23,42,0.14)] overflow-hidden">
              {/* Browser / Workbench Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF2F6] bg-[#FAFBFD] px-4 py-2.5 font-mono text-[11px] text-[#64748B]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
                  <span className="ml-1 rounded-md bg-[#0B1324] px-2 py-0.5 text-[10px] font-semibold text-white">
                    Spec Canvas
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="hidden sm:inline">Width: 1280</span>
                  <span className="hidden sm:inline">Height: 800</span>
                  <span className="rounded bg-[#ECFDF5] px-1.5 py-0.5 font-semibold text-[#047857]">
                    ✓ DAG Verified
                  </span>
                </div>
              </div>

              {/* 3-Column Studio Workbench Interior */}
              <div className="grid grid-cols-1 md:grid-cols-12 md:min-h-[430px]">
                {/* Left Sidebar Rail (decorative; hidden on phones) */}
                <div className="hidden md:col-span-3 md:flex md:border-r border-[#EEF2F6] bg-white p-4 flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-bold text-white">
                        G
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#0B1221]">
                          GenUI Studio
                        </div>
                        <div className="font-mono text-[9px] text-[#64748B]">
                          v1.0 · Spec Engine
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex items-center gap-2 rounded-lg bg-[#EFF4FF] px-2.5 py-1.5 font-semibold text-[#2563EB]">
                        <span>✦</span>
                        <span>Design System</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[#5B6B82]">
                        <span>⊞</span>
                        <span>Wireframe Architect</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[#5B6B82]">
                        <span>◈</span>
                        <span>Zod Catalog</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[#5B6B82]">
                        <span>⚡</span>
                        <span>X-Ray &amp; PBT</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[#5B6B82]">
                        <span>⇪</span>
                        <span>SKILL.md &amp; MCP</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5 font-mono text-[10px] text-[#5B6B82]">
                    <div className="font-semibold text-[#0B1221]">
                      excalidraw-compiler.ts
                    </div>
                    <div className="mt-0.5 truncate">
                      Sorted by (y, x) · 0 cycles
                    </div>
                  </div>
                </div>

                {/* Center Spec Stage */}
                <div className="md:col-span-6 bg-[#FAFBFD] p-5 sm:p-6 flex flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                        GENUI STUDIO · FOUNDATIONS
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B1221]">
                        Design system
                      </div>
                      <p className="text-xs text-[#5B6B82] leading-relaxed">
                        A guardrailed visual language for streaming deterministic
                        2D and 3D React interfaces without runtime crashes or
                        schema drift.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                      <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 font-medium text-[#0B1221]">
                        ● Accessible by default
                      </span>
                      <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 font-medium text-[#0B1221]">
                        ● Responsive containers
                      </span>
                      <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 font-medium text-[#0B1221]">
                        ● Reusable skills
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[#E8EDF5] bg-white p-4 shadow-2xs space-y-3">
                      <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#2563EB]">
                        01 / LIVE SPEC BLOCKS
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-[#EEF2F6] bg-[#FAFBFD] p-3 space-y-1">
                          <div className="font-mono text-[9px] text-[#64748B]">
                            HeroSection · /elements/hero
                          </div>
                          <div className="text-sm font-extrabold tracking-tight text-[#0B1221]">
                            Make ideas matter.
                          </div>
                          <div className="text-[10px] text-[#5B6B82]">
                            Compiled from spatial box (x:40, y:24)
                          </div>
                        </div>
                        <div className="rounded-xl border border-[#EEF2F6] bg-[#FAFBFD] p-3 space-y-1">
                          <div className="font-mono text-[9px] text-[#64748B]">
                            MetricStrip · /elements/kpi
                          </div>
                          <div className="text-sm font-extrabold tracking-tight text-[#0B1221]">
                            Build with purpose.
                          </div>
                          <div className="text-[10px] text-[#5B6B82]">
                            State bound → /wireframeBindings/plan
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Live JSONL Remix Prompt Bar inside Stage */}
                  <div className="rounded-2xl border border-[#DCE4F0] bg-white p-2.5 shadow-sm flex items-center justify-between gap-2">
                    <div className="px-2 text-xs text-[#64748B] truncate">
                      Describe the interface patch you want to stream...
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded-lg bg-[#F1F5F9] px-2 py-1 font-mono text-[10px] font-semibold text-[#0B1221]">
                        RFC 6902 JSONL
                      </span>
                      {primaryWorkbenchSlug && (
                        <button
                          type="button"
                          onClick={openWorkbench}
                          aria-label="Open live workbench"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1324] text-xs font-bold text-white hover:bg-[#2563EB] transition cursor-pointer"
                        >
                          ↗
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Catalog & Pack Drawer */}
                <div className="hidden md:col-span-3 md:block md:border-l border-[#EEF2F6] bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0B1221]">
                      Installable Packs
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B]">
                      {counts.total} ready
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 font-mono text-[10px] text-[#64748B]">
                    npx genui-studio add...
                  </div>
                  <a
                    href="#catalog"
                    className="hub-cta block w-full bg-[#0B1324] py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#1E293B] transition"
                  >
                    Browse Catalog
                  </a>

                  <div className="grid grid-cols-2 md:grid-cols-1 gap-2 pt-1">
                    <div
                      style={{ colorScheme: "only dark" }}
                      className="rounded-xl bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#0B1324] p-2.5 text-white"
                    >
                      <div className="font-mono text-[9px] text-[#93C5FD]">
                        3D WEBGL + OTLP
                      </div>
                      <div className="text-xs font-bold">SpatialOps Pro</div>
                    </div>
                    <div
                      style={{ colorScheme: "only dark" }}
                      className="rounded-xl bg-gradient-to-br from-[#18090D] via-[#450A0A] to-[#09090B] p-2.5 text-white"
                    >
                      <div className="font-mono text-[9px] text-[#FCA5A5]">
                        60 FPS HORROR
                      </div>
                      <div className="text-xs font-bold">AFTERDARK 2.0</div>
                    </div>
                    <div className="rounded-xl border border-[#0B1221] bg-white p-2.5 text-[#0B1221]">
                      <div className="font-mono text-[9px] text-[#5B6B82]">
                        5-TONE ARCHIVE
                      </div>
                      <div className="text-xs font-bold">NINETY9 // 1999</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Overlapping Floating Card: MCP & PBT Guardrail Audit (Screenshot 3 Left Device) */}
            <div className="hidden md:block mt-6 lg:mt-0 lg:absolute lg:left-0 lg:-bottom-2 lg:w-[295px] rounded-[24px] border border-[#DCE4F0] bg-white p-5 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.18)] space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-2.5">
                <span className="font-mono text-[11px] font-bold text-[#0B1221]">
                  @genui-studio/mcp
                </span>
                <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#5B6B82]">
                  Audit
                </span>
              </div>

              <div className="ml-6 rounded-2xl rounded-tr-xs bg-[#EFF4FF] p-3 text-[11px] font-medium text-[#1E3A8A] leading-snug">
                Are there any runtime, schema, or accessibility issues before we
                ship this GenUI spec?
              </div>

              <div className="space-y-2 text-[11px] leading-relaxed text-[#475569]">
                <div className="font-bold text-[#0B1221]">
                  Verified runtime invariants
                </div>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    <strong className="text-[#0B1221]">
                      Acyclic DAG &amp; depth cap:
                    </strong>{" "}
                    DFS sanitizer severs cyclic child references and caps tree
                    depth at 16.
                  </li>
                  <li>
                    <strong className="text-[#0B1221]">
                      Self-healing Zod props:
                    </strong>{" "}
                    Out-of-bounds stream patches fall back cleanly without
                    unmounting sibling trees.
                  </li>
                  <li>
                    <strong className="text-[#0B1221]">
                      Scoped theme isolation:
                    </strong>{" "}
                    Each pack mounts inside{" "}
                    <code className="font-mono text-[10px] text-[#0B1221]">
                      [data-template-theme]
                    </code>
                    .
                  </li>
                </ol>
              </div>
            </div>

            {/* Right Overlapping Floating Mobile Viewport Preview (Screenshot 3 Right Device) */}
            <div className="hidden md:block mt-6 lg:mt-0 lg:absolute lg:right-0 lg:-bottom-2 lg:w-[255px] rounded-[28px] border-[5px] border-[#F8FAFC] ring-1 ring-[#DCE4F0] bg-white p-4 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.2)] space-y-3">
              <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                  <span className="font-mono text-[10px] font-bold text-[#0B1221]">
                    Mobile · 390px
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#047857] font-semibold">
                  Container Query
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#2563EB]">
                  GENUI STUDIO · MOBILE
                </div>
                <div className="text-lg font-extrabold tracking-tight text-[#0B1221]">
                  Design system
                </div>
                <p className="text-[10px] text-[#5B6B82] leading-snug">
                  Identical GenUI spec adapted automatically inside the Studio
                  mobile viewport stage.
                </p>
              </div>

              <div className="rounded-xl border border-[#EEF2F6] bg-[#FAFBFD] p-2.5 space-y-1">
                <div className="font-mono text-[9px] font-bold text-[#2563EB]">
                  01 / TYPOGRAPHY
                </div>
                <div className="text-xs font-extrabold text-[#0B1221]">
                  Make ideas matter.
                </div>
                <div className="text-[9px] text-[#64748B]">
                  Fluid clamp() · WCAG contrast verified
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 font-mono text-[9px] text-[#64748B]">
                <span>Stream patch...</span>
                <span className="text-[#2563EB] font-bold">JSONL →</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Continuous Loop Workflow (Screenshot 2 Style: 01 -> 02 -> 03 + Return Loop Pill) */}
        <section id="workflow" className="scroll-mt-24 space-y-10">
          <div className="mx-auto max-w-[680px] text-center space-y-3">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
              HOW THE WORKBENCH WORKS
            </div>
            <h2 className="hub-section-heading font-extrabold text-[#0B1221]">
              Sketch, check, and export in one workbench
            </h2>
            <p className="hub-body-copy text-sm sm:text-base text-[#5B6B82] leading-relaxed">
              Draw the layout, read the compile diagnostics next to the live
              preview, and export a React starter that contains the Spec you
              just compiled.
            </p>
          </div>

          <div className="mx-auto max-w-[1040px]">
            {/* 3 Cards + Horizontal Dashed Connectors */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-4">
              {/* Step 01: Author */}
              <article className="hub-bento-card p-7 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF4FF] text-[#2563EB]">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                      </svg>
                    </div>
                    <span className="font-sans text-4xl font-extrabold tracking-tight text-[#DCE6F7]">
                      01
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#0B1221]">
                      Sketch &amp; compile
                    </h3>
                    <p className="text-sm text-[#5B6B82] leading-relaxed">
                      Draw catalog-backed blocks and labelled state arrows in
                      Wireframe Architect. Every edit recompiles to a GenUI{" "}
                      <code className="font-mono text-xs text-[#0B1221]">
                        Spec
                      </code>{" "}
                      and Mermaid graph.
                    </p>
                  </div>
                </div>

                {primaryWorkbenchSlug && (
                  <button
                    type="button"
                    onClick={openWorkbench}
                    className="inline-flex min-h-[32px] w-fit items-center gap-1.5 text-sm font-bold text-[#2563EB] hover:text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 cursor-pointer"
                  >
                    <span>Open sample wireframe</span>
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </article>

              {/* Dashed Arrow 1 -> 2 */}
              <div
                aria-hidden="true"
                className="hidden lg:flex items-center justify-center px-1 text-[#3B82F6]"
              >
                <svg className="h-6 w-12" viewBox="0 0 48 24" fill="none">
                  <path
                    d="M2 12h38"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M36 7l6 5-6 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Step 02: Verify */}
              <article className="hub-bento-card p-7 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl border border-[#BFDBFE] p-1">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#2563EB]">
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 3v18h18" />
                          <path d="M7 14l4-4 4 4 5-6" />
                        </svg>
                      </div>
                    </div>
                    <span className="font-sans text-4xl font-extrabold tracking-tight text-[#DCE6F7]">
                      02
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#0B1221]">
                      Inspect &amp; preview
                    </h3>
                    <p className="text-sm text-[#5B6B82] leading-relaxed">
                      The diagnostics strip lists each block mapping, each{" "}
                      <code className="font-mono text-xs text-[#0B1221]">
                        $state
                      </code>{" "}
                      binding, and every healed prop or ignored tag, while the
                      preview renders the result with per-element fault
                      isolation.
                    </p>
                  </div>
                </div>

                {primaryWorkbenchSlug && (
                  <button
                    type="button"
                    onClick={openWorkbench}
                    className="inline-flex min-h-[32px] w-fit items-center gap-1.5 text-sm font-bold text-[#2563EB] hover:text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 cursor-pointer"
                  >
                    <span>See the diagnostics</span>
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </article>

              {/* Dashed Arrow 2 -> 3 */}
              <div
                aria-hidden="true"
                className="hidden lg:flex items-center justify-center px-1 text-[#3B82F6]"
              >
                <svg className="h-6 w-12" viewBox="0 0 48 24" fill="none">
                  <path
                    d="M2 12h38"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M36 7l6 5-6 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Step 03: Distribute */}
              <article className="hub-bento-card p-7 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF4FF] text-[#2563EB]">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                      </svg>
                    </div>
                    <span className="font-sans text-4xl font-extrabold tracking-tight text-[#DCE6F7]">
                      03
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#0B1221]">
                      Export a starter
                    </h3>
                    <p className="text-sm text-[#5B6B82] leading-relaxed">
                      Download a runnable Next.js{" "}
                      <code className="font-mono text-xs text-[#0B1221]">
                        .zip
                      </code>
                      , copy the{" "}
                      <code className="font-mono text-xs text-[#0B1221]">
                        design.md
                      </code>{" "}
                      Mermaid section, or install the catalog with{" "}
                      <code className="font-mono text-xs text-[#0B1221]">
                        npx genui-studio add
                      </code>
                      .
                    </p>
                  </div>
                </div>

                <a
                  href="#catalog"
                  className="inline-flex min-h-[32px] w-fit items-center gap-1.5 text-sm font-bold text-[#2563EB] hover:text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
                >
                  <span>Install Pack</span>
                  <span aria-hidden="true">→</span>
                </a>
              </article>
            </div>

            {/* Bottom Return Loop Connector & Pill ("SYNC TO KIRO SPECS, MCP & REPEAT") */}
            <div className="relative mt-4 pt-4 flex flex-col items-center">
              <svg
                aria-hidden="true"
                className="hidden lg:block w-full max-w-[760px] h-16 text-[#93C5FD]"
                viewBox="0 0 760 64"
                fill="none"
              >
                <path
                  d="M680 2 v26 a18 18 0 0 1 -18 18 H98 a18 18 0 0 1 -18 -18 V8"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeDasharray="3 4"
                />
                <path
                  d="M75 12 l5 -7 l5 7"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="80" cy="40" r="5" fill="#2563EB" />
                <circle
                  cx="80"
                  cy="40"
                  r="10"
                  fill="#2563EB"
                  fillOpacity="0.18"
                />
              </svg>

              <div className="lg:-mt-10 rounded-full border border-[#E2E8F0] bg-white px-6 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#1E3A8A] shadow-[0_10px_28px_-8px_rgba(15,23,42,0.12)]">
                SYNC TO KIRO SPECS, MCP &amp; AGENT SKILLS
              </div>
            </div>
          </div>
        </section>

        {/* 4. Asymmetric Bento Grid (Screenshot 1 Style: Speed Card + Templates Card + Donut Telemetry Card + Tall Dark MCP/CLI Card) */}
        <section id="bento" className="scroll-mt-24 space-y-10">
          <div className="mx-auto max-w-[680px] text-center space-y-3">
            <h2 className="hub-section-heading font-extrabold text-[#0B1221]">
              Why build agent interfaces with GenUI Studio?
            </h2>
            <p className="hub-body-copy text-sm sm:text-base text-[#5B6B82] leading-relaxed">
              Choose a system that doesn&apos;t just generate screens, but proves
              schema compliance, isolates themes, and packages reusable skills
              for every agent workflow.
            </p>
          </div>

          <div className="mx-auto max-w-[1040px] grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left 8 Columns: 2 Top Cards + 1 Wide Bottom Donut Card */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Top-Left Bento Card: Deterministic UI Generation + Registry Counts */}
              <article className="hub-bento-card p-6 sm:p-7 flex flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold leading-snug text-[#0B1221]">
                    Deterministic UI
                    <br />
                    Compilation
                  </h3>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-5xl font-extrabold tracking-tight tabular-nums text-[#0B1221]">
                    500+
                  </div>
                  <p className="text-xs sm:text-sm text-[#5B6B82] leading-snug">
                    fast-check PBT runs per suite with &lt;2ms DFS cycle &amp;
                    Zod prop healing
                  </p>
                </div>

                {/* Grounded Registry Counts (Preserving Test Hooks) */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#EEF2F6] font-mono text-[11px]">
                  <div className="rounded-xl bg-[#F8FAFC] px-2.5 py-2">
                    <span className="block text-[9px] font-semibold text-[#64748B]">
                      NATIVE
                    </span>
                    <span
                      data-testid="count-mode-a"
                      className="text-sm font-extrabold text-[#0B1221]"
                    >
                      {counts.native}
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#F8FAFC] px-2.5 py-2">
                    <span className="block text-[9px] font-semibold text-[#64748B]">
                      STANDALONE
                    </span>
                    <span
                      data-testid="count-mode-b"
                      className="text-sm font-extrabold text-[#0B1221]"
                    >
                      {counts.standalone}
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#ECFDF5] px-2.5 py-2">
                    <span className="block text-[9px] font-semibold text-[#047857]">
                      VERIFIED
                    </span>
                    <span
                      data-testid="count-verified"
                      className="text-sm font-extrabold text-[#047857]"
                    >
                      {counts.verified}
                    </span>
                  </div>
                </div>
              </article>

              {/* Top-Middle Bento Card: Skip the Blank Screen & Use a Template */}
              <article className="hub-bento-card-tinted p-6 sm:p-7 flex flex-col justify-between gap-6">
                {/* 3 Floating Miniature Wireframe Cards */}
                <div
                  aria-hidden="true"
                  className="grid grid-cols-3 gap-2.5 pt-1"
                >
                  <div className="rounded-xl border border-[#DCE6F7] bg-white p-2.5 shadow-2xs space-y-2">
                    <div className="h-2.5 w-10 rounded-full bg-[#2563EB]" />
                    <div className="h-2 w-full rounded bg-[#E2E8F0]" />
                    <div className="h-6 w-full rounded-md bg-[#F1F5F9]" />
                  </div>
                  <div className="rounded-xl border border-[#DCE6F7] bg-white p-2.5 shadow-2xs space-y-2">
                    <div className="h-2.5 w-8 rounded-full bg-[#93C5FD]" />
                    <div className="grid grid-cols-2 gap-1">
                      <div className="h-7 rounded bg-[#E2E8F0]" />
                      <div className="h-7 rounded bg-[#F1F5F9]" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#DCE6F7] bg-white p-2.5 shadow-2xs space-y-2">
                    <div className="h-5 w-full rounded bg-[#EFF4FF]" />
                    <div className="h-2.5 w-12 rounded-full bg-[#2563EB]" />
                    <div className="h-2 w-full rounded bg-[#E2E8F0]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                    ✦ VERIFIED CATALOG PACKS
                  </div>
                  <h3 className="text-xl font-bold leading-snug text-[#0B1221]">
                    Skip the blank screen and use a template.
                  </h3>
                  <p className="text-xs text-[#5B6B82] leading-relaxed">
                    Start from {counts.total} native and standalone React packs
                    with prebuilt Zod catalogs and Kiro specs.
                  </p>
                </div>
              </article>

              {/* Bottom Wide Bento Card: Guardrail Proof & Donut Breakdown */}
              <article className="sm:col-span-2 hub-bento-card p-6 sm:p-7 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                      ✦ RUNTIME &amp; PBT VERIFICATION TOOLS
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#0B1221]">
                      Get real proof on your UI guardrails
                    </h3>
                  </div>
                  {primaryWorkbenchSlug && (
                    <button
                      type="button"
                      onClick={openWorkbench}
                      aria-label="Inspect runtime telemetry in workbench"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF4FF] text-sm font-bold text-[#2563EB] hover:bg-[#DBEAFE] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                    >
                      ↗
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  {/* Segmented SVG Donut Ring Chart */}
                  <div className="sm:col-span-5 flex justify-center">
                    <div className="relative flex h-44 w-44 items-center justify-center">
                      <svg
                        className="h-full w-full -rotate-90"
                        viewBox="0 0 160 160"
                        aria-hidden="true"
                      >
                        <circle
                          cx="80"
                          cy="80"
                          r="60"
                          fill="none"
                          stroke="#F1F5F9"
                          strokeWidth="18"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="60"
                          fill="none"
                          stroke="#2563EB"
                          strokeWidth="18"
                          strokeDasharray="228 377"
                          strokeDashoffset="0"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="60"
                          fill="none"
                          stroke="#93C5FD"
                          strokeWidth="18"
                          strokeDasharray="86 377"
                          strokeDashoffset="-232"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="60"
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="18"
                          strokeDasharray="48 377"
                          strokeDashoffset="-322"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                        <span className="text-3xl font-extrabold tracking-tight text-[#0B1221]">
                          100%
                        </span>
                        <span className="text-[11px] font-medium text-[#5B6B82] leading-tight">
                          Verified catalog compliance
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown Legend & Hierarchy */}
                  <div className="sm:col-span-7 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-2.5 text-sm">
                      <div className="flex items-center gap-2.5 font-medium text-[#475569]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                        <span>Mode A · Native GenUI Catalogs</span>
                      </div>
                      <span className="font-bold text-[#0B1221]">
                        {counts.native} packs (67%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-2.5 text-sm">
                      <div className="flex items-center gap-2.5 font-medium text-[#475569]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#93C5FD]" />
                        <span>Mode B · Standalone reference apps</span>
                      </div>
                      <span className="font-bold text-[#0B1221]">
                        {counts.standalone} apps (33%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-1 text-sm">
                      <div className="flex items-center gap-2.5 font-medium text-[#475569]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                        <span>SpatialOps Reference App</span>
                      </div>
                      <a
                        href="http://localhost:5174"
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs font-bold text-[#2563EB] hover:underline"
                      >
                        localhost:5174 ↗
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            {/* Right 4 Columns: Tall Dark Card ("Export your design via CLI or MCP") */}
            <article className="lg:col-span-4 hub-dark-bento p-6 sm:p-7 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold leading-snug text-white">
                  Export your design
                  <br />
                  via CLI or MCP
                </h3>

                {/* Dark Code Window with Traffic Dots & Filename */}
                <div className="rounded-2xl border border-white/10 bg-[#070E1C] overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between border-b border-white/10 bg-[#0B1528] px-3.5 py-2.5 font-mono text-[11px] text-[#94A3B8]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#334155]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#334155]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#334155]" />
                    </div>
                    <span className="text-[#E2E8F0]">genui_mcp_export.ts</span>
                  </div>

                  <pre className="p-4 font-mono text-[11px] leading-relaxed overflow-x-auto text-[#E2E8F0]">
                    <code>
                      <span className="text-[#93C5FD]">import</span> &#123;
                      compileExcalidrawToGenUI &#125;{"\n"}
                      {"  "}
                      <span className="text-[#93C5FD]">from</span>{" "}
                      <span className="text-[#86EFAC]">
                        &quot;@genui-studio/core&quot;
                      </span>
                      ;{"\n\n"}
                      <span className="text-[#64748B]">
                        // 1. Compile spatial canvas to Spec
                      </span>
                      {"\n"}
                      <span className="text-[#93C5FD]">const</span> &#123; spec,
                      mermaidDiagram &#125; ={"\n"}
                      {"  "}compileExcalidrawToGenUI(&#123;{"\n"}
                      {"    "}slug:{" "}
                      <span className="text-[#86EFAC]">
                        &quot;spatial-ops-3d-pro&quot;
                      </span>
                      ,{"\n"}
                      {"    "}elements: sceneElements,{"\n"}
                      {"    "}catalog: template.catalog,{"\n"}
                      {"  "}&#125;);{"\n\n"}
                      <span className="text-[#64748B]">
                        // 2. Install pack + SKILL.md + POWER.md
                      </span>
                      {"\n"}
                      <span className="text-[#FDE047]">
                        $ npx genui-studio add afterdark-horror
                      </span>
                    </code>
                  </pre>

                  {/* Subtle Scrollbar Track Accent */}
                  <div className="bg-[#E2E8F0] px-3 py-1.5">
                    <div className="h-1.5 w-28 rounded-full bg-[#64748B]" />
                  </div>
                </div>
              </div>

              <a
                href="#catalog"
                className="hub-cta inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition"
              >
                <span>Explore Export Packs</span>
                <span aria-hidden="true">→</span>
              </a>
            </article>
          </div>
        </section>

        {/* 5. Featured Applications Built With GenUI Studio (AFTERDARK, NINETY9, CMOS BIOS) */}
        {featuredFlagships.length > 0 && (
          <section
            id="featured"
            data-testid="marketplace-featured-flagship"
            className="scroll-mt-24 space-y-8"
          >
            <div className="mx-auto max-w-[680px] text-center space-y-3">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
                OPTIONAL · STRESS-TEST FIXTURES
              </div>
              <h2 className="hub-section-heading font-extrabold text-[#0B1221]">
                Optional reference demos &amp; stress-test fixtures
              </h2>
              <p className="hub-body-copy text-sm sm:text-base text-[#5B6B82]">
                You don&apos;t need these to use the workbench. They run the same
                runtime inside a scoped{" "}
                <code className="font-mono text-xs text-[#0B1221]">
                  data-template-theme
                </code>{" "}
                container and exist to stress-test it with very different 2D
                and 3D interfaces. The SpatialOps SRE demo runs separately on{" "}
                <a
                  href="http://localhost:5174"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  localhost:5174 ↗
                </a>
                .
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {featuredFlagships.map((flagship, index) => {
                const slug = flagship.manifest.slug;
                const isMono = slug === "ninety9-archive";
                const isBios = slug === "cmos-cloud-bios";
                const demonstration =
                  FLAGSHIP_DEMONSTRATIONS[slug] ??
                  flagship.manifest.description;

                return (
                  <article
                    key={`featured-${slug}`}
                    data-testid={`marketplace-flagship-${slug}`}
                    className="hub-bento-card overflow-hidden flex flex-col justify-between transition hover:border-[#94A3B8]"
                  >
                    {/* Contained Miniature App Preview */}
                    <div className="p-4 bg-[#F8FAFC] border-b border-[#E8EDF5]">
                      {isMono ? (
                        <div
                          style={{ colorScheme: "only light" }}
                          className="min-h-[148px] rounded-xl border-2 border-[#000000] bg-[#FFFFFF] p-4 text-[#000000] shadow-[3px_3px_0px_#000000] flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between border-b border-[#000000] pb-2 font-mono text-[10px] font-bold">
                            <span>ARCHIVE // 1990–1999</span>
                            <span className="border border-[#000000] bg-[#D9D9D9] px-1.5 py-0.5">
                              5-TONE MONO
                            </span>
                          </div>
                          <div className="py-2 space-y-1">
                            <div className="font-mono text-xs font-bold tracking-tight">
                              34 Dossiers · 12 Sectors
                            </div>
                            <div className="text-[11px] text-[#292929]">
                              COBOL boot terminal · Paper-white CRT scanlines ·
                              Live monochrome remixes
                            </div>
                          </div>
                          <div className="flex gap-1.5 font-mono text-[9px] font-bold">
                            <span className="bg-[#000000] text-[#FFFFFF] px-1.5 py-0.5">
                              #FFFFFF
                            </span>
                            <span className="border border-[#000000] px-1.5 py-0.5">
                              0px RADIUS
                            </span>
                          </div>
                        </div>
                      ) : isBios ? (
                        <div
                          style={{ colorScheme: "only dark" }}
                          className="min-h-[148px] rounded-xl border-4 border-double border-[#FFFFFF] bg-[#0000AA] p-3.5 font-mono text-[#FFFFFF] shadow-[3px_3px_0px_#000000] flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between border-b border-[#00AAAA] pb-1.5 text-[10px]">
                            <span className="text-[#FFFF55] font-bold">
                              AWARD CMOS SETUP
                            </span>
                            <span className="text-[#00AAAA]">VGA 16-COLOR</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 py-2 text-[10px]">
                            <div className="bg-[#AA0000] px-1.5 py-0.5 text-[#FFFF55]">
                              ▶ CLOCK MULTIPLIER
                            </div>
                            <div className="px-1.5 py-0.5 text-[#FFFFFF]">
                              ▶ 3D PCB TWIN
                            </div>
                            <div className="px-1.5 py-0.5 text-[#00AAAA]">
                              F10: COMPILE IaC
                            </div>
                            <div className="px-1.5 py-0.5 text-[#FFFF55]">
                              main.tf + compose
                            </div>
                          </div>
                          <div className="border-t border-[#00AAAA] pt-1.5 text-[9px] text-[#FFFF55]">
                            FSK Modem Audio · FNV-1a CMOS Checksum
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{ colorScheme: "only dark" }}
                          className="min-h-[148px] rounded-xl border border-[#2A1B1E] bg-[#07070A] p-4 text-[#F1F5F9] flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-[#94A3B8]">
                              02:17 AM · WEBGL
                            </span>
                            <span className="rounded border border-[#DC2626]/60 bg-[#DC2626]/20 px-1.5 py-0.5 text-[#FCA5A5]">
                              ZONE E BREAKER
                            </span>
                          </div>
                          <div className="py-2 space-y-1">
                            <div className="text-sm font-semibold tracking-tight text-white">
                              AFTERDARK 2.0
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">
                              5 3D cemetery zones · Procedural Web Audio ·
                              Daylight editorial restoration
                            </div>
                          </div>
                          <div className="flex items-center justify-between font-mono text-[9px] text-[#CBD5E1]">
                            <span>THREE.InstancedMesh</span>
                            <span>PRO · $89</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Crisp Bento Card Body */}
                    <div className="p-6 flex-1 flex flex-col justify-between gap-5">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                          <span className="font-bold text-[#2563EB]">
                            Reference demo 0{index + 1} ·{" "}
                            {flagship.manifest.category}
                          </span>
                          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[#5B6B82] font-semibold">
                            {flagship.manifest.tier === "pro"
                              ? `PRO · $${flagship.manifest.priceUsd}`
                              : "FREE · MIT"}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-[#0B1221]">
                          {flagship.manifest.title}
                        </h3>

                        <p className="text-sm text-[#5B6B82] leading-relaxed">
                          {demonstration}
                        </p>

                        <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] px-3 py-2 font-mono text-[11px] text-[#5B6B82] flex items-center justify-between gap-2">
                          <code className="truncate text-[#0B1221]">
                            npx genui-studio add {slug}
                          </code>
                          <span className="shrink-0 text-[10px] font-semibold text-[#047857]">
                            {flagship.catalog.metadata.componentNames.length}{" "}
                            blocks
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-2 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => onOpenPreview(slug)}
                          data-testid={`flagship-enter-${slug}`}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#0B1324] px-3 py-2 font-semibold text-white hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                        >
                          Open Preview →
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportTemplate(flagship)}
                          data-testid={`flagship-export-${slug}`}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 font-semibold text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                        >
                          Export Pack
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Unified Installable Catalog Grid */}
        <section id="catalog" className="scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
                INSTALLABLE REGISTRY
              </div>
              <h2 className="hub-section-heading font-extrabold text-[#0B1221]">
                All Catalog Packs ({counts.total})
              </h2>
              <p className="text-sm text-[#5B6B82]">
                Filter by execution mode, tier, or capability tag. Every card
                includes a scoped live preview, Wireframe Architect, X-Ray PBT,
                and CLI/ZIP export.
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="hub-bento-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="group"
                aria-label="Filter by template mode"
                className="hub-scroll-row -mx-1 w-[calc(100%+0.5rem)] items-center gap-1.5 px-1 pb-0.5 font-mono text-xs sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0 sm:pb-0"
              >
                <button
                  type="button"
                  aria-pressed={modeFilter === "all"}
                  onClick={() => setModeFilter("all")}
                  data-testid="filter-mode-all"
                  className={`min-h-[36px] rounded-full px-4 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
                    modeFilter === "all"
                      ? "bg-[#0B1324] text-white"
                      : "border border-[#CBD5E1] bg-white text-[#5B6B82] hover:text-[#0B1221]"
                  }`}
                >
                  All ({counts.total})
                </button>
                <button
                  type="button"
                  aria-pressed={modeFilter === "native"}
                  onClick={() => setModeFilter("native")}
                  data-testid="filter-mode-native"
                  className={`min-h-[36px] rounded-full px-4 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
                    modeFilter === "native"
                      ? "bg-[#2563EB] text-white"
                      : "border border-[#CBD5E1] bg-white text-[#5B6B82] hover:text-[#0B1221]"
                  }`}
                >
                  Mode A · Native ({counts.native})
                </button>
                <button
                  type="button"
                  aria-pressed={modeFilter === "standalone"}
                  onClick={() => setModeFilter("standalone")}
                  data-testid="filter-mode-standalone"
                  className={`min-h-[36px] rounded-full px-4 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
                    modeFilter === "standalone"
                      ? "bg-[#2563EB] text-white"
                      : "border border-[#CBD5E1] bg-white text-[#5B6B82] hover:text-[#0B1221]"
                  }`}
                >
                  Mode B · Standalone ({counts.standalone})
                </button>

                <span
                  aria-hidden="true"
                  className="mx-1 h-4 w-px bg-[#E2E8F0]"
                />

                <button
                  type="button"
                  aria-pressed={tierFilter === "pro"}
                  onClick={() =>
                    setTierFilter((prev) => (prev === "pro" ? "all" : "pro"))
                  }
                  data-testid="filter-tier-pro"
                  className={`min-h-[36px] rounded-full px-4 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
                    tierFilter === "pro"
                      ? "bg-[#0B1324] text-white"
                      : "border border-[#CBD5E1] bg-white text-[#5B6B82] hover:text-[#0B1221]"
                  }`}
                >
                  PRO Packs Only
                </button>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search templates by name, category, or tag"
                  placeholder="Search packs, tags, or domain..."
                  data-testid="marketplace-search-input"
                  className="w-full min-h-[38px] rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-1.5 text-sm text-[#0B1221] placeholder:text-[#64748B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 focus:bg-white"
                />
              </div>
            </div>

            {/* Tag Pills */}
            <div className="hub-scroll-row items-center gap-1.5 pt-2 border-t border-[#EEF2F6] sm:flex-wrap">
              <span className="font-mono text-[11px] font-semibold text-[#5B6B82] mr-1">
                Tags:
              </span>
              <button
                type="button"
                aria-pressed={activeTag === "all"}
                onClick={() => setActiveTag("all")}
                data-testid="filter-tag-all"
                className={`min-h-[28px] rounded-full px-3 py-0.5 font-mono text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                  activeTag === "all"
                    ? "bg-[#0B1324] text-white"
                    : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#5B6B82] hover:border-[#94A3B8] hover:text-[#0B1221]"
                }`}
              >
                All Tags
              </button>
              {MARKETPLACE_FILTER_TAGS.map((tag) => {
                const isSelected = activeTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setActiveTag((prev) => (prev === tag ? "all" : tag))
                    }
                    data-testid={`filter-tag-${tag}`}
                    className={`min-h-[28px] rounded-full px-3 py-0.5 font-mono text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                      isSelected
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#5B6B82] hover:border-[#94A3B8] hover:text-[#0B1221]"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {activeTag !== "all" && (
                <button
                  type="button"
                  onClick={() => setActiveTag("all")}
                  data-testid="clear-tag-filter-btn"
                  className="min-h-[28px] rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] focus-visible:outline-2 focus-visible:outline-[#2563EB] cursor-pointer"
                >
                  Clear tag ✕
                </button>
              )}
            </div>
          </div>

          {/* Template Cards Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="hub-bento-card p-12 text-center">
              <p className="font-mono text-sm text-[#5B6B82]">
                No catalog packs match the current filter criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((entry) => {
                const { manifest, catalog } = entry;
                const isStandalone = manifest.mode === "standalone";

                return (
                  <article
                    key={manifest.slug}
                    data-testid={`marketplace-card-${manifest.slug}`}
                    className="hub-bento-card overflow-hidden flex flex-col justify-between transition hover:border-[#94A3B8]"
                  >
                    {/* Contained Theme Swatch Header */}
                    <div
                      style={{
                        colorScheme: `only ${manifest.theme.defaultColorScheme}`,
                        backgroundColor: manifest.theme.surfaceBg,
                        color: manifest.theme.textColor,
                      }}
                      className="p-5 border-b border-[#E8EDF5] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                        <span
                          className="rounded-full border px-2.5 py-0.5 font-semibold uppercase"
                          style={{
                            backgroundColor: "#0B1324",
                            color: "#F8FAFC",
                            borderColor: "rgba(255,255,255,0.22)",
                          }}
                        >
                          {isStandalone
                            ? "Mode B · Standalone"
                            : "Mode A · Native"}
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {manifest.verified && (
                            <span
                              className="rounded-full px-2.5 py-0.5 font-semibold"
                              style={{
                                backgroundColor: "#064E3B",
                                color: "#D1FAE5",
                              }}
                            >
                              ✓ GenUI Verified
                            </span>
                          )}
                          <span
                            className="rounded-full border px-2.5 py-0.5 font-semibold"
                            style={{
                              backgroundColor: "#0B1324",
                              color: "#F8FAFC",
                              borderColor: "rgba(255,255,255,0.22)",
                            }}
                          >
                            {manifest.tier === "pro"
                              ? `PRO · $${manifest.priceUsd}`
                              : "FREE · MIT"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 rounded-full shrink-0 border border-white/30"
                          style={{ backgroundColor: manifest.theme.accentColor }}
                        />
                        <h3
                          className="text-base font-bold tracking-tight truncate"
                          style={{ fontFamily: manifest.theme.displayFont }}
                        >
                          {manifest.title}
                        </h3>
                      </div>
                    </div>

                    {/* Clear Hierarchy: Purpose -> What Is Included -> Actions */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <p className="text-sm text-[#5B6B82] leading-relaxed line-clamp-3">
                          {manifest.description}
                        </p>

                        <div className="rounded-xl bg-[#F8FAFC] border border-[#E8EDF5] px-3 py-2 font-mono text-[11px] text-[#0B1221] flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">
                            {catalog.metadata.componentNames.length} catalog
                            blocks
                          </span>
                          <span className="text-[#5B6B82]">
                            {manifest.pages.length}{" "}
                            {manifest.pages.length === 1 ? "page" : "pages"} ·{" "}
                            {manifest.theme.defaultColorScheme}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                          {manifest.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[#5B6B82]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#EEF2F6] font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => onOpenPreview(manifest.slug)}
                          data-testid={`preview-btn-${manifest.slug}`}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#0B1324] px-3 py-2 font-semibold text-white hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                        >
                          Live Preview →
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportTemplate(entry)}
                          data-testid={`export-btn-${manifest.slug}`}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 font-semibold text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                        >
                          Export Pack
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Clean Studio Footer */}
      <footer className="border-t border-[#E8EDF5] bg-[#FAFBFD] mt-16">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8 text-xs text-[#5B6B82]">
          <div>
            <strong className="text-[#0B1221]">GenUI Studio Hub</strong> ·
            Powered by{" "}
            <code className="font-mono text-[#0B1221]">@genui-studio/core</code>
            , <code className="font-mono text-[#0B1221]">@json-render</code>, and{" "}
            <code className="font-mono text-[#0B1221]">
              @excalidraw/excalidraw
            </code>
          </div>
          <div className="font-mono text-[11px]">
            MIT License · Kiroween Skeleton Crew
          </div>
        </div>
      </footer>

      {exportTemplate && (
        <TemplateExportDialog
          isOpen={Boolean(exportTemplate)}
          onClose={() => setExportTemplate(null)}
          template={exportTemplate}
        />
      )}
    </div>
  );
};
