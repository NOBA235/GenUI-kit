import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Eye,
  GitBranch,
  Layers,
  Link2,
} from "lucide-react";
import { getTemplateBySlug } from "@genui-studio/templates";
import {
  compileExcalidrawToGenUI,
  type ExcalidrawCompileResult,
} from "../lib/excalidraw-compiler.js";
import {
  buildDashboardSampleWireframeElements,
  buildSampleWireframeElements,
} from "../lib/sample-wireframe.js";
import {
  SAMPLE_WIREFRAME_FALLBACK_SLUG,
  SAMPLE_WIREFRAME_SLUG,
} from "../lib/workbench-entry.js";

type DemoArchetype = "landing" | "dashboard";
type InspectorTab = "preview" | "spec" | "mermaid";

interface HeroWorkbenchDemoProps {
  readonly onOpenWorkbench: (slug: string, loadSample: boolean) => void;
}

const STATE_OPTIONS: Record<DemoArchetype, readonly string[]> = {
  landing: ["Pro plan · $29/mo", "Team plan · $99/mo", "Enterprise · Custom"],
  dashboard: ["us-east-1 (Healthy)", "eu-central-1 (12ms)", "ap-northeast-1 (18ms)"],
};

function resolveStringProp(
  props: Record<string, unknown> | undefined,
  key: string,
  stateValue: string,
  fallback: string,
): string {
  const raw = props?.[key];
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "$state" in raw) {
    return stateValue;
  }
  return fallback;
}

export const HeroWorkbenchDemo: React.FC<HeroWorkbenchDemoProps> = ({
  onOpenWorkbench,
}) => {
  const [archetype, setArchetype] = useState<DemoArchetype>("landing");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("preview");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [stateValueByArchetype, setStateValueByArchetype] = useState<
    Record<DemoArchetype, string>
  >({
    landing: STATE_OPTIONS.landing[0]!,
    dashboard: STATE_OPTIONS.dashboard[0]!,
  });
  const [copiedCode, setCopiedCode] = useState(false);

  const compiled = useMemo((): {
    readonly slug: string;
    readonly result: ExcalidrawCompileResult;
    readonly prettySpec: string;
  } | null => {
    const slug =
      archetype === "landing"
        ? SAMPLE_WIREFRAME_SLUG
        : SAMPLE_WIREFRAME_FALLBACK_SLUG;
    const template =
      getTemplateBySlug(slug) ??
      getTemplateBySlug(SAMPLE_WIREFRAME_FALLBACK_SLUG);
    if (!template) return null;

    const baseSpec = Object.values(template.pageSpecs)[0] ?? null;
    const elements =
      archetype === "landing"
        ? buildSampleWireframeElements()
        : buildDashboardSampleWireframeElements();

    const result = compileExcalidrawToGenUI(elements, {
      catalog: template.catalog,
      baseSpec,
      slug: template.manifest.slug,
    });

    return {
      slug: template.manifest.slug,
      result,
      prettySpec: JSON.stringify(result.spec, null, 2),
    };
  }, [archetype]);

  if (!compiled) return null;

  const { result, prettySpec, slug } = compiled;
  const activeBinding = result.stateBindings[0] ?? null;
  const activeStateValue = stateValueByArchetype[archetype];
  const healedProp = result.propDiagnostics.find((d) => d.status === "healed") ?? null;
  const warningCount =
    result.warnings.length +
    result.propDiagnostics.filter((d) => d.status === "healed").length;
  const errorCount =
    result.validationIssues.filter((i) => i.severity === "error").length +
    result.propDiagnostics.filter((d) => d.status === "rejected").length;

  const childKeys = result.spec.elements[result.spec.root]?.children ?? [];
  const activeFocusKey = selectedKey ?? childKeys[0] ?? result.spec.root;

  const handleCopyInspector = () => {
    const text = inspectorTab === "mermaid" ? result.mermaidDiagram : prettySpec;
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  return (
    <div
      data-testid="hero-workbench-preview"
      className="hub-window overflow-hidden text-left"
    >
      {/* Window Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 sm:px-4">
        {/* Left: Archetype Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-1.5 pr-2 sm:flex" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E7]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E7]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E7]" />
          </div>

          <div
            role="group"
            aria-label="Sample wireframe archetype"
            className="inline-flex items-center rounded-lg border border-[#E4E4E7] bg-white p-0.5 text-xs"
          >
            {(
              [
                ["landing", "Product Landing"],
                ["dashboard", "SaaS Dashboard"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={archetype === key}
                onClick={() => {
                  setArchetype(key);
                  setSelectedKey(null);
                }}
                className={`min-h-[28px] rounded-md px-2.5 py-1 font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 ${
                  archetype === key
                    ? "bg-[#09090B] text-white"
                    : "text-[#52525B] hover:text-[#09090B]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="hidden font-mono text-[0.6875rem] text-[#71717A] md:inline">
            {slug}
          </span>
        </div>

        {/* Right: Output View Mode */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Compiler output view"
            className="inline-flex items-center rounded-lg border border-[#E4E4E7] bg-white p-0.5 font-mono text-[0.6875rem]"
          >
            {(
              [
                ["preview", "Preview", Eye],
                ["spec", "Spec JSON", Code2],
                ["mermaid", "Mermaid", GitBranch],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={inspectorTab === id}
                onClick={() => setInspectorTab(id)}
                className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 ${
                  inspectorTab === id
                    ? "bg-[#F4F4F5] text-[#09090B] font-semibold"
                    : "text-[#71717A] hover:text-[#09090B]"
                }`}
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split Stage: Left Wireframe Graph / Right Live Compiled Output */}
      <div className="grid grid-cols-1 divide-y divide-[#E4E4E7] lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Left Pane: Real Compiled Wireframe Blocks & State Arrow */}
        <div className="lg:col-span-5 bg-[#FAFAFA] p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium text-[#52525B]">
                <Layers aria-hidden="true" className="h-3.5 w-3.5 text-[#71717A]" />
                <span>Excalidraw Scene</span>
              </div>
              <span className="font-mono text-[0.6875rem] tabular-nums text-[#71717A]">
                {result.resolvedMappings.length} blocks · 0 LLM calls
              </span>
            </div>

            {/* Frame Outline representing SiteShell */}
            <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-white p-3 space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[0.625rem] text-[#71717A]">
                <span className="font-semibold text-[#09090B]">
                  Frame · SiteShell
                </span>
                <span className="rounded bg-[#F4F4F5] px-1.5 py-0.5 text-[#52525B]">
                  root
                </span>
              </div>

              <div className="space-y-2">
                {childKeys.map((key, index) => {
                  const mapping = result.resolvedMappings.find(
                    (m) => m.specKey === key,
                  );
                  const element = result.spec.elements[key];
                  if (!element || !mapping) return null;

                  const isSelected = activeFocusKey === key;
                  const isHealedTarget = healedProp?.elementKey === key;
                  const isWarningBlock =
                    archetype === "landing" &&
                    mapping.componentType === "FeatureGrid";
                  const isBindingSource = activeBinding?.sourceSpecKey === key;
                  const isBindingTarget = activeBinding?.targetSpecKey === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      aria-pressed={isSelected}
                      className={`w-full rounded-lg border p-2.5 text-left transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 ${
                        isSelected
                          ? "border-[#09090B] bg-[#FAFAFA] shadow-xs"
                          : "border-[#E4E4E7] bg-white hover:border-[#A1A1AA]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[0.625rem] tabular-nums text-[#71717A]">
                            0{index + 1}
                          </span>
                          <span className="truncate font-mono text-xs font-semibold text-[#09090B]">
                            {mapping.componentType}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.625rem] font-medium ${
                            mapping.matchSource === "tag"
                              ? "bg-[#ECFDF5] text-[#047857]"
                              : "bg-[#EFF6FF] text-[#1D4ED8]"
                          }`}
                        >
                          {mapping.matchSource}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[0.625rem] text-[#71717A]">
                        <span className="truncate">{key}</span>
                        {isHealedTarget && (
                          <span className="rounded bg-[#FFFBEB] border border-[#FDE68A] px-1.5 py-0.5 text-[#B45309]">
                            uptimePercent: 140 → 100
                          </span>
                        )}
                        {isWarningBlock && (
                          <span className="rounded bg-[#FFFBEB] border border-[#FDE68A] px-1.5 py-0.5 text-[#B45309]">
                            PricingTable → FeatureGrid
                          </span>
                        )}
                        {isBindingSource && activeBinding && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[#1D4ED8]">
                            <Link2 aria-hidden="true" className="h-2.5 w-2.5" />
                            emits {activeBinding.label}
                          </span>
                        )}
                        {isBindingTarget && activeBinding && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[#1D4ED8]">
                            binds {activeBinding.boundPropName}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive $state Arrow Binding Control */}
          {activeBinding && (
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[0.6875rem]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#09090B]">
                  <Link2 aria-hidden="true" className="h-3.5 w-3.5 text-[#2563EB]" />
                  Live $state Binding
                </span>
                <code className="text-[0.625rem] text-[#2563EB]">
                  {activeBinding.pointerPath}
                </code>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATE_OPTIONS[archetype].map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={activeStateValue === option}
                    onClick={() =>
                      setStateValueByArchetype((prev) => ({
                        ...prev,
                        [archetype]: option,
                      }))
                    }
                    className={`min-h-[26px] rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 ${
                      activeStateValue === option
                        ? "border-[#2563EB] bg-[#EFF6FF] font-semibold text-[#1D4ED8]"
                        : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Compiled Preview / Spec JSON / Mermaid Output */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 flex flex-col justify-between gap-4">
          {inspectorTab === "preview" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[0.6875rem] font-medium text-[#52525B]">
                  SafeGenUIRenderer · Compiled Output
                </span>
                <span className="font-mono text-[0.625rem] text-[#71717A]">
                  Inspecting: <strong className="text-[#09090B]">{activeFocusKey}</strong>
                </span>
              </div>

              {/* Rendered Live Compiled Spec Cards */}
              <div className="rounded-xl border border-[#E4E4E7] bg-[#09090B] p-4 text-white space-y-3">
                {childKeys.map((key) => {
                  const el = result.spec.elements[key];
                  if (!el) return null;
                  const props = (el.props ?? {}) as Record<string, unknown>;
                  const isFocused = activeFocusKey === key;

                  if (el.type === "HeroSection") {
                    const headline = resolveStringProp(
                      props,
                      "headline",
                      activeStateValue,
                      "Compiled Hero",
                    );
                    const summary = resolveStringProp(
                      props,
                      "summary",
                      activeStateValue,
                      "Live bound summary",
                    );
                    const eyebrow = resolveStringProp(
                      props,
                      "eyebrow",
                      activeStateValue,
                      "GENUI SPEC",
                    );
                    return (
                      <div
                        key={key}
                        className={`rounded-lg border p-3.5 transition ${
                          isFocused
                            ? "border-[#3B82F6] bg-[#111827]"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[0.625rem] font-semibold text-[#60A5FA]">
                            {eyebrow}
                          </span>
                          <span className="font-mono text-[0.625rem] text-zinc-400">
                            HeroSection
                          </span>
                        </div>
                        <div className="mt-1 text-base font-semibold tracking-tight text-white">
                          {headline}
                        </div>
                        <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                          <span className="font-mono text-[0.625rem] text-[#60A5FA] mr-1.5">
                            [$state]
                          </span>
                          {summary}
                        </p>
                      </div>
                    );
                  }

                  if (el.type === "MetricStrip") {
                    const uptime =
                      typeof props.uptimePercent === "number"
                        ? props.uptimePercent
                        : 100;
                    const heading = resolveStringProp(
                      props,
                      "heading",
                      activeStateValue,
                      "Telemetry",
                    );
                    const primaryVal = resolveStringProp(
                      props,
                      "primaryValue",
                      activeStateValue,
                      "99.9%",
                    );
                    const secondaryVal = resolveStringProp(
                      props,
                      "secondaryValue",
                      activeStateValue,
                      "14ms",
                    );
                    return (
                      <div
                        key={key}
                        className={`rounded-lg border p-3.5 transition ${
                          isFocused
                            ? "border-[#3B82F6] bg-[#111827]"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-200">
                            {heading}
                          </span>
                          {healedProp?.elementKey === key ? (
                            <span className="rounded bg-amber-500/15 border border-amber-400/30 px-1.5 py-0.5 font-mono text-[0.625rem] text-amber-300">
                              Healed · 140 → {uptime}
                            </span>
                          ) : (
                            <span className="font-mono text-[0.625rem] text-emerald-400">
                              Schema Valid
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 grid grid-cols-3 gap-2 font-mono">
                          <div className="rounded border border-white/10 bg-black/40 p-2">
                            <div className="text-[0.625rem] text-zinc-400">Primary</div>
                            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                              {primaryVal}
                            </div>
                          </div>
                          <div className="rounded border border-white/10 bg-black/40 p-2">
                            <div className="text-[0.625rem] text-zinc-400">Latency</div>
                            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                              {secondaryVal}
                            </div>
                          </div>
                          <div className="rounded border border-white/10 bg-black/40 p-2">
                            <div className="text-[0.625rem] text-zinc-400">Uptime</div>
                            <div className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-400">
                              {uptime}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (el.type === "FeatureGrid") {
                    const sectionTitle = resolveStringProp(
                      props,
                      "sectionTitle",
                      activeStateValue,
                      "Capabilities",
                    );
                    const items = Array.isArray(props.items)
                      ? (props.items as readonly { title?: string; detail?: string }[])
                      : [];
                    return (
                      <div
                        key={key}
                        className={`rounded-lg border p-3.5 transition ${
                          isFocused
                            ? "border-[#3B82F6] bg-[#111827]"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-200">
                            {sectionTitle}
                          </span>
                          <span className="font-mono text-[0.625rem] text-zinc-400">
                            FeatureGrid ({items.length})
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                          {items.slice(0, 3).map((item, idx) => (
                            <div
                              key={`${key}-item-${idx}`}
                              className="rounded border border-white/10 bg-black/40 p-2"
                            >
                              <div className="truncate text-[0.6875rem] font-medium text-white">
                                {item.title ?? `Module ${idx + 1}`}
                              </div>
                              <div className="mt-0.5 line-clamp-2 text-[0.625rem] text-zinc-400">
                                {item.detail ?? "Catalog verified block"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[0.6875rem] font-medium text-[#52525B]">
                  {inspectorTab === "spec"
                    ? "Deterministic GenUI Spec (JSON)"
                    : `.kiro/specs/${slug}/design.md (Mermaid DAG)`}
                </span>
                <button
                  type="button"
                  onClick={handleCopyInspector}
                  className="inline-flex min-h-[26px] items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1"
                >
                  {copiedCode ? (
                    <>
                      <Check aria-hidden="true" className="h-3 w-3 text-[#047857]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="hub-code-surface flex-1 max-h-[340px] overflow-auto rounded-xl border border-white/10 p-3.5 font-mono text-[0.6875rem] leading-relaxed text-zinc-200">
                <code>
                  {inspectorTab === "mermaid" ? result.mermaidDiagram : prettySpec}
                </code>
              </pre>
            </div>
          )}

          {/* Diagnostics & Open in Workbench Footer Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E4E4E7] pt-3">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[0.6875rem]">
              {errorCount === 0 && warningCount === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 font-medium text-[#047857]">
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                  0 issues · Zod valid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 font-medium text-[#B45309]">
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                  {errorCount} errors · {warningCount} warnings
                </span>
              )}
              <span className="text-[#71717A] tabular-nums">
                {result.stateBindings.length} binding · DAG verified
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpenWorkbench(slug, archetype === "landing")}
              className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-1 text-xs font-medium text-[#09090B] hover:border-[#09090B] hover:bg-white transition cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2"
            >
              <span>Edit in Excalidraw</span>
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
