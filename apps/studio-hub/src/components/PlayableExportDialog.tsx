import React, { useEffect, useId, useRef, useState } from "react";
import { Bot, Download, Package, X } from "lucide-react";
import {
  buildSkillPack,
  generateTemplateZip,
  zipSkillPackFiles,
} from "@genui-studio/templates";
import { playableCatalog } from "../playable/catalog.js";
import { downloadBytes } from "../lib/download.js";
import { PLAYABLE_FUZZ_SETTINGS, type PlayableBlueprint } from "../lib/playable-starter.js";
import { createPlayableTemplateEntry } from "../lib/playable-template.js";

export interface PlayableExportDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly blueprint: PlayableBlueprint;
  readonly excalidrawJson: string;
}

type ExportMode = "skill-pack" | "nextjs";

interface ExportStatus {
  readonly mode: ExportMode;
  readonly ok: boolean;
  readonly text: string;
}

/**
 * Export the playable blueprint as
 * Mode A: Universal Agent Skill & Contract Pack, or
 * Mode B: a runnable Next.js 15 starter that runs the same rules.
 */
export const PlayableExportDialog: React.FC<PlayableExportDialogProps> = ({
  isOpen,
  onClose,
  blueprint,
  excalidrawJson,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState<ExportMode | null>(null);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const slug = blueprint.brief.slug;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!isOpen && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [isOpen]);

  const skillPackInput = () => ({
    brief: blueprint.brief,
    spec: blueprint.spec,
    rules: blueprint.rules,
    catalog: playableCatalog,
    initialScene: blueprint.initialScene,
    excalidrawJson,
    fuzz: PLAYABLE_FUZZ_SETTINGS,
  });

  const run = async (mode: ExportMode) => {
    setBusy(mode);
    setStatus(null);
    // Let the busy state paint before the synchronous fuzz run.
    await Promise.resolve();
    try {
      const pack = buildSkillPack(skillPackInput());
      if (mode === "skill-pack") {
        const bytes = await zipSkillPackFiles(pack.files);
        const filename = `${slug}-skill-pack.zip`;
        downloadBytes(filename, bytes, "application/zip");
        const outcomes = pack.verifiedTraces.map((t) => t.outcome).join(", ") || "none";
        setStatus({
          mode,
          ok: true,
          text: `Exported ${filename} (${(bytes.byteLength / 1024).toFixed(1)} KB, ${Object.keys(pack.files).length} files). Verified outcomes baked into the contract: ${outcomes}.`,
        });
      } else {
        const bytes = await generateTemplateZip(createPlayableTemplateEntry(blueprint), {
          projectName: `${slug}-starter`,
          wireframe: {
            spec: blueprint.spec,
            designMd: pack.files[`.kiro/specs/${slug}/design.md`] ?? `# ${blueprint.brief.title}\n`,
            excalidrawJson,
            rules: blueprint.rules,
            initialScene: blueprint.initialScene,
          },
        });
        const filename = `${slug}-nextjs.zip`;
        downloadBytes(filename, bytes, "application/zip");
        setStatus({
          mode,
          ok: true,
          text: `Exported ${filename} (${(bytes.byteLength / 1024).toFixed(1)} KB). Run pnpm install && pnpm dev.`,
        });
      }
    } catch (err) {
      setStatus({ mode, ok: false, text: `Export failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    dialogRef.current?.close?.();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      data-testid="playable-export-dialog"
      className="studio-dialog fixed inset-0 m-auto h-fit max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white p-0 text-[#09090B] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#E4E4E7] bg-[#FAFAFA] px-5 py-4">
        <div>
          <h2 id={titleId} className="m-0 text-base font-semibold tracking-tight">
            Export · {blueprint.brief.title}
          </h2>
          <p className="m-0 mt-0.5 text-xs text-[#52525B]">
            {blueprint.rules.length} rules · {Object.keys(blueprint.spec.elements).length} elements · catalog{" "}
            <code>{playableCatalog.metadata.catalogHash.slice(0, 12)}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          data-testid="close-playable-export-btn"
          className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-xs font-medium text-[#52525B] hover:text-[#09090B]"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <section className="flex flex-col justify-between gap-3 rounded-xl border border-[#E4E4E7] p-4">
          <div className="space-y-1.5">
            <p className="m-0 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-semibold text-[#2563EB]">
              <Bot aria-hidden="true" className="h-3.5 w-3.5" /> Mode A
            </p>
            <h3 className="m-0 text-sm font-semibold">Universal Agent Skill &amp; Contract Pack</h3>
            <p className="m-0 text-xs leading-relaxed text-[#52525B]">
              SKILL.md, AGENTS.md, .kiro/specs, a Cursor rule and <code>contracts/</code>: the behavioral spec, a reference
              driver that passes, and a production driver stub that fails until your IDE agent wires it to the real app.
              Fuzzed traces are baked into <code>invariants.pbt.test.ts</code>.
            </p>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("skill-pack")}
            data-testid="export-skill-pack-btn"
            className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#09090B] font-mono text-xs font-medium text-white hover:enabled:bg-[#18181B] disabled:opacity-50"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            {busy === "skill-pack" ? "Fuzzing and packing…" : `Download ${slug}-skill-pack.zip`}
          </button>
        </section>

        <section className="flex flex-col justify-between gap-3 rounded-xl border border-[#E4E4E7] p-4">
          <div className="space-y-1.5">
            <p className="m-0 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-semibold text-[#047857]">
              <Package aria-hidden="true" className="h-3.5 w-3.5" /> Mode B
            </p>
            <h3 className="m-0 text-sm font-semibold">Runnable Next.js 15 Starter</h3>
            <p className="m-0 text-xs leading-relaxed text-[#52525B]">
              App Router project with the catalog and components used here, <code>wireframe.spec.json</code> with its rules,
              and a home page that runs them through <code>createInteractionRuleEngine</code> inside{" "}
              <code>SafeGenUIRenderer</code>.
            </p>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("nextjs")}
            data-testid="export-nextjs-starter-btn"
            className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#09090B] bg-white font-mono text-xs font-medium text-[#09090B] hover:enabled:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            {busy === "nextjs" ? "Building…" : `Download ${slug}-nextjs.zip`}
          </button>
        </section>

        {status ? (
          <p
            role="status"
            data-testid="playable-export-status"
            data-export-mode={status.mode}
            data-ok={status.ok ? "true" : "false"}
            className={`m-0 rounded-lg px-3 py-2 font-mono text-[0.6875rem] sm:col-span-2 ${
              status.ok ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FEF2F2] text-[#B91C1C]"
            }`}
          >
            {status.text}
          </p>
        ) : null}
      </div>
    </dialog>
  );
};
