import React, { useState } from "react";
import type { ArtifactPath } from "../lib/cmos/compiler.js";
import { setCmosUi, useCmosUi, useCompilation } from "./cmos-store.js";

export interface IaCPanelProps {
  readonly projectName?: string;
  readonly heading?: string;
}

const TABS: readonly ArtifactPath[] = ["docker-compose.yml", "vercel.json", "main.tf"];

/** Live tabs for the three compiled artifacts, recompiled on every register change. */
export const IaCPanel: React.FC<IaCPanelProps> = ({ projectName, heading = "IaC COMPILER OUTPUT" }) => {
  const compilation = useCompilation(projectName);
  const tab = useCmosUi((s) => s.compilerTab);
  const [copied, setCopied] = useState<ArtifactPath | null>(null);
  const artifact = compilation.artifacts.find((a) => a.path === tab) ?? compilation.artifacts[0]!;

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(artifact.content);
      setCopied(artifact.path);
    } catch {
      setCopied(null);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([artifact.content], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = artifact.path;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-2" aria-label={heading} data-testid="cmos-iac-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 cmos-small">
        <span className="cmos-value">{heading}</span>
        <span className="cmos-help">CMOS CHECKSUM {compilation.checksum}</span>
      </div>
      <div role="tablist" aria-label="Compiled artifacts" className="flex flex-wrap gap-1">
        {TABS.map((path) => (
          <button
            key={path}
            type="button"
            role="tab"
            aria-selected={tab === path}
            className="cmos-tab cmos-small"
            data-testid={`cmos-iac-tab-${path}`}
            onClick={() => setCmosUi({ compilerTab: path })}
          >
            {path}
          </button>
        ))}
      </div>
      <pre className="cmos-code cmos-scroll" role="tabpanel" aria-label={artifact.path} data-testid="cmos-iac-code">
        {artifact.content}
      </pre>
      <div className="flex flex-wrap items-center gap-2 cmos-small">
        <button type="button" className="cmos-button" onClick={copy}>
          {copied === artifact.path ? "COPIED" : "COPY"}
        </button>
        <button type="button" className="cmos-button" onClick={download}>
          DOWNLOAD {artifact.path}
        </button>
        <span className="cmos-help">{artifact.bytes.toLocaleString("en-US")} BYTES</span>
      </div>
      {compilation.notes.length > 0 && (
        <ul className="cmos-small cmos-help space-y-0.5" aria-label="Deployment notes">
          {compilation.notes.map((note) => (
            <li key={note}>* {note}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

export interface IaCCodeCompilerOutputProps {
  readonly heading: string;
  readonly projectName: string;
}

/** Catalog wrapper: a landing-page section. In CMOS SETUP mode the panel lives inside BIOS menu 6. */
export const IaCCodeCompilerOutput: React.FC<IaCCodeCompilerOutputProps> = ({ heading, projectName }) => {
  const mode = useCmosUi((s) => s.mode);
  if (mode !== "landing") return null;
  return (
    <div data-cmos-area="iac" className="cmos-frame p-4 pt-5 min-w-0">
      <span className="cmos-frame-title cmos-text">{heading}</span>
      <IaCPanel projectName={projectName} heading={heading} />
    </div>
  );
};
