import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawExportDocument } from "../lib/spec-to-excalidraw.js";

export interface ExcalidrawSourceViewProps {
  readonly scene: ExcalidrawExportDocument;
}

/** Read-only Excalidraw view of the one-way spec-to-excalidraw export. Lazy-loaded. */
export const ExcalidrawSourceView: React.FC<ExcalidrawSourceViewProps> = ({ scene }) => (
  <div data-testid="excalidraw-source-canvas" className="h-[560px] overflow-hidden rounded-xl border border-[#E4E4E7]">
    <Excalidraw
      initialData={{
        elements: scene.elements as never,
        appState: { ...scene.appState, viewModeEnabled: true },
        scrollToContent: true,
      }}
      viewModeEnabled
      zenModeEnabled
      theme="dark"
    />
  </div>
);
