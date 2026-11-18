import React from "react";
import type {
  ExcalidrawCompileResult,
  WireframeMatchSource,
} from "../lib/excalidraw-compiler.js";

export interface WireframeDiagnosticsStripProps {
  readonly result: ExcalidrawCompileResult;
}

type DiagnosticSeverity = "error" | "warning" | "info";

interface DiagnosticRow {
  readonly key: string;
  readonly severity: DiagnosticSeverity;
  readonly source: string;
  readonly message: string;
}

const MATCH_SOURCE_LABEL: Record<WireframeMatchSource, string> = {
  tag: "tag",
  label: "label",
  fallback: "fallback",
};

const MATCH_SOURCE_CLASS: Record<WireframeMatchSource, string> = {
  tag: "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]",
  label: "border-[#BFDBFE] bg-[#EFF4FF] text-[#1D4ED8]",
  fallback: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
};

const SEVERITY_CLASS: Record<DiagnosticSeverity, string> = {
  error: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  warning: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  info: "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]",
};

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.slice(0, 40));
  if (value === undefined) return "undefined";
  try {
    const json = JSON.stringify(value);
    return json.length > 40 ? `${json.slice(0, 39)}…` : json;
  } catch {
    return String(value);
  }
}

/**
 * Builds the ordered issue list shown in the strip: compiler warnings, catalog prop
 * healing / rejection, then structural issues from `catalog.validateFull()`.
 */
export function collectWireframeDiagnostics(
  result: ExcalidrawCompileResult,
): readonly DiagnosticRow[] {
  const rows: DiagnosticRow[] = [];

  result.warnings.forEach((message, idx) => {
    rows.push({ key: `w-${idx}`, severity: "warning", source: "compiler", message });
  });

  result.propDiagnostics.forEach((d, idx) => {
    rows.push({
      key: `p-${idx}`,
      severity: d.status === "rejected" ? "error" : "warning",
      source: `${d.elementKey}.${d.propName}`,
      message:
        d.status === "rejected"
          ? `${d.componentType}.${d.propName} rejected: ${d.reason}`
          : `${d.componentType}.${d.propName} healed ${formatValue(d.originalValue)} → ${formatValue(d.resolvedValue)}: ${d.reason}`,
    });
  });

  result.validationIssues.forEach((issue, idx) => {
    rows.push({
      key: `v-${idx}`,
      severity: issue.severity,
      source: issue.elementKey ?? issue.code,
      message: `${issue.code}: ${issue.message}`,
    });
  });

  return rows;
}

/**
 * Compact, inspectable compile report for Wireframe Architect: which shape became which
 * Spec element and catalog component, which arrows became `$state` bindings, and every
 * warning / healed prop / validation issue produced by the compile.
 */
export const WireframeDiagnosticsStrip: React.FC<WireframeDiagnosticsStripProps> = ({
  result,
}) => {
  const diagnostics = collectWireframeDiagnostics(result);
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
  const status: "clean" | "warning" | "error" =
    errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "clean";

  const statusClass =
    status === "error"
      ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
      : status === "warning"
        ? "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
        : "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]";

  return (
    <section
      data-testid="wireframe-diagnostics-strip"
      data-diagnostics-status={status}
      aria-label="Compile and validation diagnostics"
      className="border-b border-[#E8EDF5] bg-white px-4 py-3 font-mono text-[11px] text-[#0B1221]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">Compile &amp; Validation Diagnostics</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[#475569]">
            {result.resolvedMappings.length} blocks
          </span>
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[#475569]">
            {result.stateBindings.length} bindings
          </span>
          <span
            data-testid="wireframe-diagnostics-status"
            className={`rounded-full border px-2 py-0.5 font-semibold ${statusClass}`}
          >
            {status === "clean"
              ? "✓ 0 issues"
              : `${errorCount} errors · ${warningCount} warnings`}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
        <details open className="min-w-0 rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2">
          <summary className="cursor-pointer font-semibold text-[#5B6B82]">
            Block mappings (shape → spec key → component)
          </summary>
          {result.resolvedMappings.length === 0 ? (
            <p className="mt-1.5 text-[#64748B]">
              No blocks yet. Draw a rectangle or frame, or insert a catalog shape.
            </p>
          ) : (
            <ul data-testid="wireframe-diagnostics-mappings" className="mt-1.5 max-h-36 space-y-1 overflow-auto">
              {result.resolvedMappings.map((m) => (
                <li key={m.elementId} className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[#64748B]" title={m.elementId}>
                    {m.elementId}
                  </span>
                  <span aria-hidden="true" className="text-[#94A3B8]">→</span>
                  <span className="truncate" title={m.specKey}>{m.specKey}</span>
                  <span aria-hidden="true" className="text-[#94A3B8]">→</span>
                  <strong className="truncate">{m.componentType}</strong>
                  <span
                    title={`Matched by ${m.matchSource}`}
                    className={`ml-auto shrink-0 rounded border px-1 text-[9px] font-semibold uppercase ${MATCH_SOURCE_CLASS[m.matchSource]}`}
                  >
                    {MATCH_SOURCE_LABEL[m.matchSource]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details open className="min-w-0 rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2">
          <summary className="cursor-pointer font-semibold text-[#5B6B82]">
            $state bindings (arrows)
          </summary>
          {result.stateBindings.length === 0 ? (
            <p className="mt-1.5 text-[#64748B]">
              No bindings. Connect two blocks with a labelled arrow to bind state.
            </p>
          ) : (
            <ul data-testid="wireframe-diagnostics-bindings" className="mt-1.5 max-h-36 space-y-1 overflow-auto">
              {result.stateBindings.map((b) => (
                <li key={b.arrowId} className="min-w-0 truncate" title={b.label}>
                  <span className="text-[#64748B]">{b.sourceSpecKey}</span>
                  <span aria-hidden="true" className="text-[#94A3B8]"> → </span>
                  <span className="text-[#1D4ED8]">{b.pointerPath}</span>
                  <span aria-hidden="true" className="text-[#94A3B8]"> → </span>
                  <span>
                    {b.targetSpecKey}.{b.boundPropName ?? "(state only)"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details open className="min-w-0 rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2">
          <summary className="cursor-pointer font-semibold text-[#5B6B82]">
            Warnings, healed props &amp; issues
          </summary>
          {diagnostics.length === 0 ? (
            <p className="mt-1.5 text-[#047857]">
              Every block maps to a catalog component and every prop passed Zod validation.
            </p>
          ) : (
            <ul data-testid="wireframe-diagnostics-issues" className="mt-1.5 max-h-36 space-y-1 overflow-auto">
              {diagnostics.map((d) => (
                <li
                  key={d.key}
                  data-severity={d.severity}
                  className={`rounded border px-1.5 py-0.5 leading-snug ${SEVERITY_CLASS[d.severity]}`}
                >
                  <span className="font-semibold">{d.source}</span>{" "}
                  <span className="break-words">{d.message}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </section>
  );
};
