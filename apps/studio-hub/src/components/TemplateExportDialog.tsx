import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTemplateCliCommand,
  exportTemplateToShadcnRegistry,
  generateTemplateZip,
  type DualModeTemplateEntry,
} from "@genui-studio/templates";

export interface TemplateExportDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly template: DualModeTemplateEntry;
}

function triggerTextDownload(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export const TemplateExportDialog: React.FC<TemplateExportDialogProps> = ({
  isOpen,
  onClose,
  template,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<"CLI" | "SKILLS" | "ZIP" | "SHADCN">("CLI");
  const [licenseToken, setLicenseToken] = useState("kiroween-2026-judge-pass");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);

  const { manifest, skillMd, kiroPowerMd } = template;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inside) {
        dialog.close();
        onClose();
      }
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleDownloadZip = async () => {
    try {
      setIsGeneratingZip(true);
      setZipStatus(null);
      const bytes = await generateTemplateZip(template);
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${manifest.slug}-nextjs.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setZipStatus(
        `Exported ${manifest.slug}-nextjs.zip (${(bytes.byteLength / 1024).toFixed(1)} KB)`,
      );
    } catch (err) {
      setZipStatus(
        `Failed to build .zip: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const npxCommand = buildTemplateCliCommand(template, licenseToken);

  const shadcnPreviewJson = useMemo(() => {
    const res = exportTemplateToShadcnRegistry(template, {
      licenseToken: manifest.tier === "pro" ? licenseToken : null,
    });
    return JSON.stringify(res.item ?? res, null, 2);
  }, [template, licenseToken, manifest.tier]);

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, unknown>)}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-label="Export Website Template"
      data-testid="hub-export-dialog"
      className="studio-dialog fixed inset-0 m-auto h-fit max-h-[90dvh] w-[92vw] max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-950 p-0 text-slate-100 shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                Export Website · {manifest.title}
              </h2>
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  manifest.mode === "standalone"
                    ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                }`}
              >
                {manifest.mode === "standalone" ? "Mode B · Standalone" : "Mode A · Native"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              CLI Install, AI Skills (SKILL.md / POWER.md), Standalone Next.js .ZIP & Shadcn Registry
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
            data-testid="close-hub-export-btn"
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-slate-800 bg-slate-900/40 px-6 font-mono text-xs">
          {(
            [
              ["CLI", "1. npx CLI"],
              ["SKILLS", "2. SKILL.md & POWER.md"],
              ["ZIP", "3. Standalone Next.js .ZIP"],
              ["SHADCN", "4. Shadcn Registry JSON"],
            ] as const
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={`border-b-2 px-3.5 py-3 font-semibold transition cursor-pointer ${
                activeTab === tabId
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[65dvh] overflow-y-auto">
          {activeTab === "CLI" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-semibold text-slate-300">
                  Install directly via npx CLI:
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs">
                  <code className="text-cyan-300 flex-1 overflow-x-auto select-all">
                    {npxCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(npxCommand, "cli")}
                    data-testid="copy-npx-cli-btn"
                    className="shrink-0 rounded bg-cyan-500 px-3 py-1 font-semibold text-slate-950 hover:bg-cyan-400 transition cursor-pointer"
                  >
                    {copiedKey === "cli" ? "✔ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {manifest.tier === "pro" && (
                <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-semibold text-purple-300">
                      Bearer License Token
                    </span>
                    <span className="text-[11px] text-purple-400">
                      PRO · ${manifest.priceUsd}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={licenseToken}
                    onChange={(e) => setLicenseToken(e.target.value)}
                    aria-label="Bearer license token"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "SKILLS" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => triggerTextDownload(`${manifest.slug}-SKILL.md`, skillMd)}
                  data-testid="download-skill-md-btn"
                  className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 font-mono text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition cursor-pointer"
                >
                  ⬇ Download SKILL.md
                </button>
                <button
                  type="button"
                  onClick={() => triggerTextDownload(`${manifest.slug}-POWER.md`, kiroPowerMd)}
                  data-testid="download-power-md-btn"
                  className="rounded-lg border border-purple-500/40 bg-purple-500/15 px-4 py-2.5 font-mono text-xs font-semibold text-purple-200 hover:bg-purple-500/25 transition cursor-pointer"
                >
                  ⬇ Download Kiro POWER.md
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs text-slate-300">
                  <span>SKILL.md Preview</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(skillMd, "skill")}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    {copiedKey === "skill" ? "✔ Copied" : "Copy SKILL.md"}
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {skillMd}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs text-slate-300">
                  <span>Kiro POWER.md Preview</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(kiroPowerMd, "power")}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    {copiedKey === "power" ? "✔ Copied" : "Copy POWER.md"}
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {kiroPowerMd}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "ZIP" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {manifest.mode === "standalone"
                    ? "Download Clean Standalone Source + GenUI Bridge (.ZIP)"
                    : "Download Standalone Next.js 15 Project (base-nextjs-shell + Template .ZIP)"}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {manifest.mode === "standalone"
                    ? "Packages the clean standalone source tree (node_modules, .next, .git, and .env excluded) alongside genui/catalog.ts, SKILL.md, POWER.md, and ASSET_MANIFEST.md."
                    : "Merges GenUI Studio's base-nextjs-shell (Next.js 15 App Router, Tailwind v4, TypeScript) with this template's components, catalog.ts, scoped theme.css, SKILL.md, POWER.md, and ASSET_MANIFEST.md."}
                </p>
                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={handleDownloadZip}
                  data-testid="download-nextjs-zip-btn"
                  className="w-full rounded-lg border border-cyan-400/50 bg-cyan-500 py-2.5 font-mono text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition cursor-pointer"
                >
                  {isGeneratingZip
                    ? "Building Standalone Next.js .ZIP..."
                    : `⬇ Download ${manifest.slug}-nextjs.zip`}
                </button>
                {zipStatus && (
                  <p className="text-xs font-mono text-emerald-300 text-center">
                    {zipStatus}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "SHADCN" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono text-xs text-slate-300">
                <span>Shadcn Registry Item JSON (registry:block)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(shadcnPreviewJson, "shadcn")}
                  className="rounded bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  {copiedKey === "shadcn" ? "✔ Copied JSON" : "Copy JSON"}
                </button>
              </div>
              <pre className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 font-mono text-[11px] text-slate-300 max-h-64 overflow-y-auto">
                {shadcnPreviewJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
