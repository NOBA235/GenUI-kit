import React, { useEffect, useRef, useState } from "react";
import { ALL_TEMPLATE_PACKS } from "./pack-definitions.js";
import { generatePackZip } from "./zip-generator.js";
import type { AgentReadyPackManifest } from "./types.js";

export interface TemplateExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  packId: string;
}

export const TemplateExportModal: React.FC<TemplateExportModalProps> = ({
  isOpen,
  onClose,
  packId,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<"CLI" | "ZIP" | "MCP">("CLI");
  const [licenseToken, setLicenseToken] = useState("kiroween-2026-judge-pass");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [zipSuccessMsg, setZipSuccessMsg] = useState<string | null>(null);

  const pack: AgentReadyPackManifest =
    ALL_TEMPLATE_PACKS[packId] ?? ALL_TEMPLATE_PACKS["spatial-ops-3d-pro"]!;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleCopy = (text: string, key: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    }
  };

  const handleDownloadZip = async () => {
    try {
      setIsGeneratingZip(true);
      setZipSuccessMsg(null);
      const zipBytes = await generatePackZip(pack);
      const blob = new Blob([zipBytes as unknown as BlobPart], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pack.id}-template.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setZipSuccessMsg(`Downloaded ${pack.id}-template.zip (${(zipBytes.byteLength / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error("Failed to generate zip:", err);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const npxCommand =
    pack.tier === "pro"
      ? `npx genui-studio add ${pack.id} --license=${licenseToken}`
      : `npx genui-studio add ${pack.id}`;

  const kiroMcpSnippet = JSON.stringify(
    {
      mcpServers: {
        "genui-studio": {
          command: "node",
          args: ["./packages/genui-mcp/dist/cli.js"],
          env: { NODE_ENV: "production" },
          disabled: false,
          autoApprove: [
            "list_catalog_components",
            "validate_ui_spec",
            "fuzz_test_catalog",
          ],
        },
      },
    },
    null,
    2,
  );

  const claudeMcpSnippet = JSON.stringify(
    {
      mcpServers: {
        "genui-studio": {
          command: "node",
          args: ["./packages/genui-mcp/dist/cli.js"],
        },
      },
    },
    null,
    2,
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Export Template Pack"
      className="fixed inset-0 m-auto h-fit max-h-[90vh] w-[92vw] max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm z-50 overflow-hidden"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 font-mono text-base font-bold text-cyan-300 shadow-inner">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  {pack.title}
                </h2>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
                    pack.tier === "pro"
                      ? "border border-purple-500/40 bg-purple-500/15 text-purple-300"
                      : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {pack.tier === "pro" ? `PRO · $${pack.priceUsd}` : "FREE · MIT"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Agent-Ready Template Pack · Includes React Source, Zod Catalog & AI Skills
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            ✕ Close
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-6 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("CLI")}
            className={`border-b-2 px-4 py-3 font-semibold transition ${
              activeTab === "CLI"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            💻 Tab 1: CLI Install (npx)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ZIP")}
            className={`border-b-2 px-4 py-3 font-semibold transition ${
              activeTab === "ZIP"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📦 Tab 2: Download .ZIP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("MCP")}
            className={`border-b-2 px-4 py-3 font-semibold transition ${
              activeTab === "MCP"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🔌 Tab 3: MCP Connect
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {activeTab === "CLI" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block font-mono text-xs font-semibold text-slate-300">
                  Run directly in any project:
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs">
                  <span className="text-cyan-400 select-all flex-1 overflow-x-auto">
                    {npxCommand}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(npxCommand, "npx")}
                    className="shrink-0 rounded bg-cyan-500 px-3 py-1 font-semibold text-slate-950 hover:bg-cyan-400 transition"
                  >
                    {copiedKey === "npx" ? "✔ Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {pack.tier === "pro" && (
                <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-purple-300">
                      🔑 Bearer License Token:
                    </span>
                    <span className="text-[11px] text-purple-400">
                      (Pre-filled with Judge pass)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={licenseToken}
                    onChange={(e) => setLicenseToken(e.target.value)}
                    placeholder="GENUI_PRO_..."
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-100 focus:border-purple-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    Token is checked via Bearer Authorization in local format/demo mode by default (plug in a custom <code className="text-slate-300">LicenseVerifier</code> for production Stripe/Lemon Squeezy billing).
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                <span className="block font-mono text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  What gets installed:
                </span>
                <ul className="space-y-1.5 font-mono text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✔</span> Production React & Three.js source components
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✔</span> Strict @json-render Zod catalog schema (<code className="text-cyan-300">catalog/</code>)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✔</span> Claude Code & Cursor Skill (<code className="text-cyan-300">SKILL.md</code>)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✔</span> Kiro Power (<code className="text-cyan-300">.kiro/powers/{pack.id}/POWER.md</code>)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✔</span> fast-check PBT invariant test suite (<code className="text-cyan-300">__tests__/</code>)
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "ZIP" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-200">
                  Download Standalone Next.js 15 Project (.ZIP)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generates an in-memory, fully structured Next.js 15 + TypeScript project pre-configured with this template, including Tailwind CSS, Zod catalogs, and complete AI Agent Skills.
                </p>
                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={handleDownloadZip}
                  className="w-full rounded-lg border border-cyan-400/50 bg-cyan-500 py-2.5 font-mono text-xs font-bold text-slate-950 shadow-lg hover:bg-cyan-400 disabled:opacity-50 transition"
                >
                  {isGeneratingZip
                    ? "⏳ Building Project .ZIP In Memory..."
                    : `⬇ Download ${pack.id}-template.zip`}
                </button>
                {zipSuccessMsg && (
                  <p className="text-xs font-mono text-emerald-300 text-center">
                    ✔ {zipSuccessMsg}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <span className="font-mono text-xs text-slate-400 uppercase tracking-wider block">
                  Project Structure Inside .ZIP:
                </span>
                <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`${pack.name}-template/
├── package.json               # Configured Next.js 15 + GenUI dependencies
├── tsconfig.json              # Strict TypeScript compiler options
├── next.config.mjs            # Transpile packages configuration
├── app/
│   ├── layout.tsx             # Root layout with Tailwind CSS
│   ├── page.tsx               # Interactive template preview
│   └── globals.css            # Dark theme styles
├── catalog/                   # Strict @json-render Zod catalog
├── components/                # Production React / Three.js UI components
├── .claude/skills/            # AI Agent Skill (Claude Code / Cursor)
├── .kiro/powers/              # Kiro Power & Steering Rules
└── __tests__/                 # fast-check Property-Based Test suite`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "MCP" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Expose this template pack&apos;s catalog directly to your AI agent over Model Context Protocol (MCP) so it can inspect component schemas and validate UI trees without hallucinating.
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-300">
                    For Kiro IDE / CLI (<code className="text-cyan-300">.kiro/settings/mcp.json</code>):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(kiroMcpSnippet, "kiro-mcp")}
                    className="rounded bg-slate-800 px-2.5 py-0.5 font-mono text-xs text-slate-300 hover:bg-slate-700"
                  >
                    {copiedKey === "kiro-mcp" ? "✔ Copied" : "Copy JSON"}
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  {kiroMcpSnippet}
                </pre>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-300">
                    For Claude Desktop (<code className="text-cyan-300">claude_desktop_config.json</code>):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(claudeMcpSnippet, "claude-mcp")}
                    className="rounded bg-slate-800 px-2.5 py-0.5 font-mono text-xs text-slate-300 hover:bg-slate-700"
                  >
                    {copiedKey === "claude-mcp" ? "✔ Copied" : "Copy JSON"}
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  {claudeMcpSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
