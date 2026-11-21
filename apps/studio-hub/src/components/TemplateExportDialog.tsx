import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import {
  buildSkillPack,
  buildTemplateCliCommand,
  createStarterBrief,
  exportTemplateToShadcnRegistry,
  generateTemplateZip,
  skillPackInputFromTemplate,
  zipSkillPackFiles,
  type DualModeTemplateEntry,
  type SkillPackInput,
  type TemplateWireframeExport,
} from "@genui-studio/templates";
import { downloadBytes } from "../lib/download.js";

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

function isPointerOutsideDialog(
  e: React.PointerEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement,
): boolean {
  const r = dialog.getBoundingClientRect();
  return (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  );
}

export const TemplateExportDialog: React.FC<TemplateExportDialogProps> = ({
  isOpen,
  onClose,
  template,
  wireframeExport = null,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<"CLI" | "SKILLS" | "ZIP" | "SHADCN" | "SKILLPACK">("CLI");
  const [isBuildingSkillPack, setIsBuildingSkillPack] = useState(false);
  const [skillPackStatus, setSkillPackStatus] = useState<string | null>(null);
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

  // Fallback for browsers without <dialog closedby="any"> (Safari):
  // require both pointerdown and pointerup outside the dialog box so text-selection drags don't dismiss.
  const handlePointerDown = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;
    pressedOutsideRef.current = isPointerOutsideDialog(e, dialog);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;
    if (pressedOutsideRef.current && isPointerOutsideDialog(e, dialog)) {
      dialog.close();
      onClose();
    }
    pressedOutsideRef.current = false;
  };

  const handleCopy = (text: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
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

  const handleDownloadSkillPack = async () => {
    try {
      setIsBuildingSkillPack(true);
      setSkillPackStatus(null);
      const input: SkillPackInput = wireframeExport
        ? {
            brief: createStarterBrief({
              slug: manifest.slug,
              title: manifest.title,
              description: manifest.description,
            }),
            spec: wireframeExport.spec,
            rules: wireframeExport.rules ?? [],
            catalog: template.catalog,
            ...(wireframeExport.initialScene ? { initialScene: wireframeExport.initialScene } : {}),
            ...(wireframeExport.excalidrawJson !== undefined
              ? { excalidrawJson: wireframeExport.excalidrawJson }
              : {}),
          }
        : skillPackInputFromTemplate(template);
      const pack = buildSkillPack(input);
      const bytes = await zipSkillPackFiles(pack.files);
      const filename = `${pack.slug}-skill-pack.zip`;
      downloadBytes(filename, bytes, "application/zip");
      setSkillPackStatus(
        `Exported ${filename} (${(bytes.byteLength / 1024).toFixed(1)} KB, ${Object.keys(pack.files).length} files, ${pack.document.rules.length} rules).`,
      );
    } catch (err) {
      setSkillPackStatus(
        `Failed to build the Skill Pack: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsBuildingSkillPack(false);
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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-labelledby={titleId}
      data-testid="hub-export-dialog"
      className="studio-dialog fixed inset-0 m-auto h-fit max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl rounded-2xl border border-[#E4E4E7] bg-white p-0 text-[#09090B] shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E4E4E7] bg-[#FAFAFA] px-4 py-4 sm:gap-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-base font-semibold tracking-tight text-[#09090B]">
                Export · {manifest.title}
              </h2>
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-[0.625rem] font-medium ${
                  manifest.mode === "standalone"
                    ? "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
                    : "border-[#E4E4E7] bg-white text-[#52525B]"
                }`}
              >
                {manifest.mode === "standalone" ? "Mode B · Standalone" : "Mode A · Native"}
              </span>
            </div>
            <p className="text-xs text-[#52525B] mt-0.5">
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
            className="inline-flex shrink-0 min-h-[32px] items-center gap-1 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Export Format Switcher */}
        <div
          role="group"
          aria-label="Export format"
          className="hub-scroll-row gap-1.5 border-b border-[#E4E4E7] bg-white px-4 py-2.5 font-mono text-xs sm:flex-wrap sm:px-6"
        >
          {(
            [
              ["CLI", "1. npx CLI"],
              ["SKILLS", "2. SKILL.md & POWER.md"],
              ["ZIP", "3. Standalone Next.js .ZIP"],
              ["SHADCN", "4. Shadcn Registry JSON"],
              ["SKILLPACK", "5. Agent Skill & Contract Pack"],
            ] as const
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              aria-pressed={activeTab === tabId}
              onClick={() => setActiveTab(tabId)}
              className={`min-h-[30px] rounded-md border px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                activeTab === tabId
                  ? "border-[#09090B] bg-[#09090B] text-white"
                  : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
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
                <span className="block font-mono text-xs font-medium text-[#09090B]">
                  Install via CLI
                </span>
                <div className="hub-code-surface flex items-center gap-2 rounded-xl border border-white/10 p-3 font-mono text-xs">
                  <code className="text-[#93C5FD] flex-1 overflow-x-auto select-all">
                    {npxCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(npxCommand, "cli")}
                    data-testid="copy-npx-cli-btn"
                    className="inline-flex shrink-0 min-h-[30px] items-center gap-1.5 rounded-md bg-[#2563EB] px-3 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition cursor-pointer"
                  >
                    {copiedKey === "cli" ? (
                      <>
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {manifest.tier === "pro" && (
                <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <label htmlFor="export-license-token" className="font-semibold text-[#09090B]">
                      Bearer License Token
                    </label>
                    <span className="text-[0.6875rem] font-medium text-[#52525B]">
                      PRO · ${manifest.priceUsd}
                    </span>
                  </div>
                  <input
                    id="export-license-token"
                    type="text"
                    value={licenseToken}
                    onChange={(e) => setLicenseToken(e.target.value)}
                    className="min-h-[36px] w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 font-mono text-xs text-[#09090B] focus:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "SKILLS" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => triggerTextDownload(`${manifest.slug}-SKILL.md`, skillMd)}
                  data-testid="download-skill-md-btn"
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[#2563EB] bg-[#EFF6FF] px-4 py-2 font-mono text-xs font-medium text-[#1D4ED8] hover:bg-[#DBEAFE] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Download SKILL.md</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerTextDownload(`${manifest.slug}-POWER.md`, kiroPowerMd)}
                  data-testid="download-power-md-btn"
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-4 py-2 font-mono text-xs font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Download Kiro POWER.md</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs text-[#09090B]">
                  <span className="font-semibold">SKILL.md Preview</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(skillMd, "skill")}
                    className="inline-flex min-h-[26px] items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-0.5 text-[0.6875rem] font-medium text-[#09090B] hover:bg-[#F4F4F5] cursor-pointer"
                  >
                    {copiedKey === "skill" ? (
                      <>
                        <Check aria-hidden="true" className="h-3 w-3 text-[#047857]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" className="h-3 w-3" />
                        <span>Copy SKILL.md</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="hub-code-surface rounded-xl border border-white/10 p-3.5 font-mono text-[0.6875rem] max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {skillMd}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs text-[#09090B]">
                  <span className="font-semibold">Kiro POWER.md Preview</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(kiroPowerMd, "power")}
                    className="inline-flex min-h-[26px] items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-0.5 text-[0.6875rem] font-medium text-[#09090B] hover:bg-[#F4F4F5] cursor-pointer"
                  >
                    {copiedKey === "power" ? (
                      <>
                        <Check aria-hidden="true" className="h-3 w-3 text-[#047857]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" className="h-3 w-3" />
                        <span>Copy POWER.md</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="hub-code-surface rounded-xl border border-white/10 p-3.5 font-mono text-[0.6875rem] max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {kiroPowerMd}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "ZIP" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#09090B]">
                  {manifest.mode === "standalone"
                    ? "Download Clean Standalone Source + GenUI Bridge (.ZIP)"
                    : "Download Standalone Next.js 15 Project (base-nextjs-shell + Template .ZIP)"}
                </h3>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  {manifest.mode === "standalone"
                    ? "Packages the clean standalone source tree (node_modules, .next, .git, and .env excluded) alongside genui/catalog.ts, SKILL.md, POWER.md, and ASSET_MANIFEST.md."
                    : "Merges WizFrame's base-nextjs-shell (Next.js 15 App Router, Tailwind v4, TypeScript) with this template's components, catalog.ts, scoped theme.css, SKILL.md, POWER.md, and ASSET_MANIFEST.md."}
                </p>
                <div
                  data-testid="export-wireframe-status"
                  data-includes-wireframe={wireframeExport ? "true" : "false"}
                  className={`rounded-lg border px-3 py-2 font-mono text-[0.6875rem] leading-relaxed ${
                    wireframeExport
                      ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                      : "border-[#E4E4E7] bg-white text-[#52525B]"
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
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#09090B] py-2 font-mono text-xs font-medium text-white hover:enabled:bg-[#18181B] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
                >
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>
                    {isGeneratingZip
                      ? "Building Standalone Next.js .ZIP..."
                      : `Download ${zipFilename}`}
                  </span>
                </button>
                {zipStatus && (
                  <p className="text-xs font-mono font-medium text-[#047857] text-center">
                    {zipStatus}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "SKILLPACK" && (
            <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#09090B]">
                Universal Agent Skill &amp; Contract Pack (.ZIP)
              </h3>
              <p className="text-xs text-[#52525B] leading-relaxed">
                SKILL.md, AGENTS.md, <code>.kiro/specs/{manifest.slug}/</code>, a Cursor rule and{" "}
                <code>contracts/</code> with the behavioral spec, a reference driver that passes and a production
                driver stub that fails until your IDE agent wires it to the app it builds.{" "}
                {wireframeExport
                  ? "Uses your compiled wireframe."
                  : "Uses the template's home page; it has no interaction rules, so the contract checks the initial state."}
              </p>
              <button
                type="button"
                disabled={isBuildingSkillPack}
                onClick={handleDownloadSkillPack}
                data-testid="download-skill-pack-btn"
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#09090B] py-2 font-mono text-xs font-medium text-white hover:enabled:bg-[#18181B] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
              >
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{isBuildingSkillPack ? "Fuzzing and packing…" : `Download ${manifest.slug}-skill-pack.zip`}</span>
              </button>
              {skillPackStatus && (
                <p className="text-xs font-mono font-medium text-[#047857] text-center">{skillPackStatus}</p>
              )}
            </div>
          )}

          {activeTab === "SHADCN" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono text-xs text-[#09090B]">
                <span className="font-semibold">
                  Shadcn Registry Item JSON (registry:block)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(shadcnPreviewJson, "shadcn")}
                  className="inline-flex min-h-[26px] items-center gap-1 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-[0.6875rem] font-medium text-[#09090B] hover:bg-[#F4F4F5] cursor-pointer"
                >
                  {copiedKey === "shadcn" ? (
                    <>
                      <Check aria-hidden="true" className="h-3 w-3 text-[#047857]" />
                      <span>Copied JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="h-3 w-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="hub-code-surface rounded-xl border border-white/10 p-3.5 font-mono text-[0.6875rem] max-h-64 overflow-y-auto">
                {shadcnPreviewJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
