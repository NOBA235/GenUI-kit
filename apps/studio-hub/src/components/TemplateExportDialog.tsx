import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTemplateCliCommand,
  exportTemplateToShadcnRegistry,
  generateTemplateZip,
  type DualModeTemplateEntry,
  type TemplateWireframeExport,
} from "@genui-studio/templates";

export interface TemplateExportDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly template: DualModeTemplateEntry;
  /** Latest Wireframe Architect compile; when set the .zip renders it instead of the template default. */
  readonly wireframeExport?: TemplateWireframeExport | null;
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
  wireframeExport = null,
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
      const bytes = await generateTemplateZip(template, {
        wireframe: wireframeExport,
      });
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = zipFilename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setZipStatus(
        `Exported ${zipFilename} (${(bytes.byteLength / 1024).toFixed(1)} KB)`,
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
  const zipFilename = wireframeExport
    ? `${manifest.slug}-wireframe-nextjs.zip`
    : `${manifest.slug}-nextjs.zip`;
  const wireframeElementCount = wireframeExport
    ? Object.keys(wireframeExport.spec.elements).length
    : 0;

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
      className="studio-dialog fixed inset-0 m-auto h-fit max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl rounded-3xl border border-[#E8EDF5] bg-white p-0 text-[#0B1221] shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E8EDF5] bg-[#FAFBFD] px-4 py-4 sm:gap-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0B1221]">
                Export Website · {manifest.title}
              </h2>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                  manifest.mode === "standalone"
                    ? "border-[#D97706]/40 bg-[#FEF3C7] text-[#92400E]"
                    : "border-[#E2E8F0] bg-white text-[#5B6B82]"
                }`}
              >
                {manifest.mode === "standalone" ? "Mode B · Standalone" : "Mode A · Native"}
              </span>
            </div>
            <p className="text-xs text-[#5B6B82] mt-0.5">
              CLI Install, AI Skills (SKILL.md / POWER.md), Standalone Next.js .ZIP &amp; Shadcn Registry
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
            data-testid="close-hub-export-btn"
            className="shrink-0 min-h-[34px] rounded-full border border-[#CBD5E1] bg-white px-3.5 py-1 font-mono text-xs font-semibold text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        {/* Tabs (pill segmented control, matching the X-Ray drawer; scrolls on phones) */}
        <div
          role="group"
          aria-label="Export format"
          className="hub-scroll-row gap-1.5 border-b border-[#E8EDF5] bg-white px-4 py-3 font-mono text-xs sm:flex-wrap sm:px-6"
        >
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
              aria-pressed={activeTab === tabId}
              onClick={() => setActiveTab(tabId)}
              className={`min-h-[32px] border px-3.5 py-1 font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                activeTab === tabId
                  ? "border-[#0B1324] bg-[#0B1324] text-white"
                  : "border-[#CBD5E1] bg-white text-[#5B6B82] hover:border-[#0B1221] hover:text-[#0B1221]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-4 space-y-5 max-h-[65dvh] overflow-y-auto bg-white sm:p-6">
          {activeTab === "CLI" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-bold text-[#0B1221]">
                  Install directly via npx CLI:
                </label>
                <div className="hub-code-surface flex items-center gap-2 rounded-2xl border border-white/10 p-3 font-mono text-xs">
                  <code className="text-[#93C5FD] flex-1 overflow-x-auto select-all">
                    {npxCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(npxCommand, "cli")}
                    data-testid="copy-npx-cli-btn"
                    className="shrink-0 min-h-[32px] rounded-full bg-[#2563EB] px-4 py-1 font-semibold text-white hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition cursor-pointer"
                  >
                    {copiedKey === "cli" ? "✔ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {manifest.tier === "pro" && (
                <div className="rounded-2xl border border-[#E8EDF5] bg-[#F8FAFC] p-4 space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-[#0B1221]">
                      Bearer License Token
                    </span>
                    <span className="text-[11px] font-semibold text-[#5B6B82]">
                      PRO · ${manifest.priceUsd}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={licenseToken}
                    onChange={(e) => setLicenseToken(e.target.value)}
                    aria-label="Bearer license token"
                    className="min-h-[38px] w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-1.5 font-mono text-xs text-[#0B1221] focus:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1"
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
                  className="min-h-[40px] rounded-full border border-[#2563EB] bg-[#EFF4FF] px-4 py-2 font-mono text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  ⬇ Download SKILL.md
                </button>
                <button
                  type="button"
                  onClick={() => triggerTextDownload(`${manifest.slug}-POWER.md`, kiroPowerMd)}
                  data-testid="download-power-md-btn"
                  className="min-h-[40px] rounded-full border border-[#CBD5E1] bg-white px-4 py-2 font-mono text-xs font-semibold text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  ⬇ Download Kiro POWER.md
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs text-[#0B1221]">
                  <span className="font-bold">SKILL.md Preview</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(skillMd, "skill")}
                    className="min-h-[28px] rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-0.5 text-[11px] font-semibold text-[#0B1221] hover:bg-[#EEF2F6] cursor-pointer"
                  >
                    {copiedKey === "skill" ? "✔ Copied" : "Copy SKILL.md"}
                  </button>
                </div>
                <pre className="hub-code-surface rounded-2xl border border-white/10 p-3.5 font-mono text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {skillMd}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs text-[#0B1221]">
                  <span className="font-bold">Kiro POWER.md Preview</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(kiroPowerMd, "power")}
                    className="min-h-[28px] rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-0.5 text-[11px] font-semibold text-[#0B1221] hover:bg-[#EEF2F6] cursor-pointer"
                  >
                    {copiedKey === "power" ? "✔ Copied" : "Copy POWER.md"}
                  </button>
                </div>
                <pre className="hub-code-surface rounded-2xl border border-white/10 p-3.5 font-mono text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {kiroPowerMd}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "ZIP" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E8EDF5] bg-[#F8FAFC] p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#0B1221]">
                  {manifest.mode === "standalone"
                    ? "Download Clean Standalone Source + GenUI Bridge (.ZIP)"
                    : "Download Standalone Next.js 15 Project (base-nextjs-shell + Template .ZIP)"}
                </h3>
                <p className="text-xs text-[#5B6B82] leading-relaxed">
                  {manifest.mode === "standalone"
                    ? "Packages the clean standalone source tree (node_modules, .next, .git, and .env excluded) alongside genui/catalog.ts, SKILL.md, POWER.md, and ASSET_MANIFEST.md."
                    : "Merges GenUI Studio's base-nextjs-shell (Next.js 15 App Router, Tailwind v4, TypeScript) with this template's components, catalog.ts, scoped theme.css, SKILL.md, POWER.md, and ASSET_MANIFEST.md."}
                </p>
                <div
                  data-testid="export-wireframe-status"
                  data-includes-wireframe={wireframeExport ? "true" : "false"}
                  className={`rounded-xl border px-3 py-2 font-mono text-[11px] leading-relaxed ${
                    wireframeExport
                      ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                      : "border-[#E2E8F0] bg-white text-[#5B6B82]"
                  }`}
                >
                  {wireframeExport ? (
                    <>
                      Includes your compiled wireframe: root{" "}
                      <code>{wireframeExport.spec.root}</code>, {wireframeElementCount}{" "}
                      elements →{" "}
                      <code>
                        {manifest.mode === "standalone"
                          ? "genui/wireframe.spec.json"
                          : "src/template/wireframe.spec.json"}
                      </code>
                      , <code>.kiro/specs/{manifest.slug}/design.md</code>,{" "}
                      <code>wireframe/{manifest.slug}.excalidraw.json</code>
                      {manifest.mode === "standalone"
                        ? "."
                        : ". app/page.tsx renders the wireframe."}
                    </>
                  ) : (
                    <>
                      No wireframe compiled in this session. The .zip renders the
                      template&apos;s default page. Open Wireframe Architect to export
                      your own layout.
                    </>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={handleDownloadZip}
                  data-testid="download-nextjs-zip-btn"
                  className="min-h-[42px] w-full rounded-full bg-[#0B1324] py-2.5 font-mono text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  {isGeneratingZip
                    ? "Building Standalone Next.js .ZIP..."
                    : `⬇ Download ${zipFilename}`}
                </button>
                {zipStatus && (
                  <p className="text-xs font-mono font-semibold text-[#047857] text-center">
                    {zipStatus}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "SHADCN" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono text-xs text-[#0B1221]">
                <span className="font-bold">
                  Shadcn Registry Item JSON (registry:block)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(shadcnPreviewJson, "shadcn")}
                  className="min-h-[28px] rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#0B1221] hover:bg-[#EEF2F6] cursor-pointer"
                >
                  {copiedKey === "shadcn" ? "✔ Copied JSON" : "Copy JSON"}
                </button>
              </div>
              <pre className="hub-code-surface rounded-2xl border border-white/10 p-3.5 font-mono text-[11px] max-h-64 overflow-y-auto">
                {shadcnPreviewJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
