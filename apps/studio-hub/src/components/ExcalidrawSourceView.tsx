import React, { useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawExportDocument } from "../lib/spec-to-excalidraw.js";

export interface ExcalidrawSourceViewProps {
  readonly scene: ExcalidrawExportDocument;
  /** False while the tab is hidden; the canvas stays mounted and refreshes when shown. */
  readonly visible: boolean;
}

/**
 * Read-only Excalidraw view of the one-way spec-to-excalidraw export. Lazy-loaded once and
 * kept mounted: later spec changes go through `updateScene` instead of a remount.
 */
export const ExcalidrawSourceView: React.FC<ExcalidrawSourceViewProps> = ({ scene, visible }) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const shownSceneRef = useRef(scene);

  // Push spec changes into the existing canvas.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || shownSceneRef.current === scene) return;
    shownSceneRef.current = scene;
    api.updateScene({ elements: scene.elements as never });
    if (visible) api.scrollToContent(undefined, { fitToContent: true });
  }, [scene, visible]);

  // A canvas measured while hidden has a zero-size viewport; re-measure when shown.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !visible) return;
    api.refresh();
    api.scrollToContent(undefined, { fitToContent: true });
  }, [visible]);

  return (
    <div data-testid="excalidraw-source-canvas" className="h-[560px] overflow-hidden rounded-xl border border-[#E4E4E7]">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
        }}
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
};
