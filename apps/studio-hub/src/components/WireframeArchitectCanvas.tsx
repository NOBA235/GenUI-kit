import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement, NonDeleted } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Spec } from "@json-render/core";
import type { VerifiedCatalog } from "@genui-studio/core";
import {
  catalogToExcalidrawLibrary,
  compileExcalidrawToGenUI,
  exportExcalidrawToKiroArtifacts,
  specToInitialExcalidrawElements,
  type ExcalidrawCompileResult,
} from "../lib/excalidraw-compiler.js";
import { buildSampleWireframeElements } from "../lib/sample-wireframe.js";
import { WireframeDiagnosticsStrip } from "./WireframeDiagnosticsStrip.js";

export type WireframeInitialScene = "template" | "sample";

export interface WireframeArchitectCanvasProps {
  readonly slug: string;
  readonly templateTitle: string;
  readonly catalog: VerifiedCatalog<any, any>;
  readonly baseSpec: Spec | null;
  readonly colorScheme?: "dark" | "light";
  /** `template` (default) seeds the canvas from `baseSpec`; `sample` loads the sample wireframe. */
  readonly initialScene?: WireframeInitialScene;
  /** Called after every compile with the result and the scene elements it was compiled from. */
  readonly onCompiledSpec: (
    result: ExcalidrawCompileResult,
    sceneElements: readonly ExcalidrawElement[],
  ) => void;
}

const DEBOUNCE_COMPILE_MS = 250;

function computeSceneSignature(elements: readonly ExcalidrawElement[]): string {
  let activeCount = 0;
  const parts: string[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i];
    if (!el || el.isDeleted) continue;
    activeCount += 1;
    parts.push(`${el.id}:${el.version}:${el.versionNonce}`);
  }
  return `${activeCount}|${parts.join(",")}`;
}

function triggerJsonDownload(filename: string, content: string): void {
  const blob = new Blob([content], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export const WireframeArchitectCanvas: React.FC<WireframeArchitectCanvasProps> = ({
  slug,
  templateTitle,
  catalog,
  baseSpec,
  colorScheme = "dark",
  initialScene = "template",
  onCompiledSpec,
}) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSignatureRef = useRef<string>("");
  const lastStatusMessageRef = useRef<string>("");

  const libraryBundle = useMemo(
    () => catalogToExcalidrawLibrary(catalog, { baseSpec, slug }),
    [catalog, baseSpec, slug],
  );

  const initialElements = useMemo(
    () =>
      initialScene === "sample"
        ? buildSampleWireframeElements()
        : specToInitialExcalidrawElements(baseSpec, catalog),
    [initialScene, baseSpec, catalog],
  );

  const [latestResult, setLatestResult] = useState<ExcalidrawCompileResult>(() =>
    compileExcalidrawToGenUI(initialElements, { catalog, baseSpec, slug }),
  );
  const [showMermaidInspector, setShowMermaidInspector] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [insertCounter, setInsertCounter] = useState(0);

  const announceStatus = useCallback((rawMessage: string) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    const nextMsg =
      rawMessage === lastStatusMessageRef.current
        ? `${rawMessage}\u00A0`
        : rawMessage;
    lastStatusMessageRef.current = rawMessage;
    setStatusMessage(nextMsg);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage("");
    }, 2400);
  }, []);

  // Re-initialize library & starter scene when slug changes
  useEffect(() => {
    const initialSig = computeSceneSignature(initialElements);
    lastSignatureRef.current = initialSig;
    const compiled = compileExcalidrawToGenUI(initialElements, {
      catalog,
      baseSpec,
      slug,
    });
    setLatestResult(compiled);
    onCompiledSpec(compiled, initialElements);

    if (apiRef.current) {
      apiRef.current.updateScene({ elements: initialElements });
      void apiRef.current.updateLibrary({
        libraryItems: [...libraryBundle.libraryItems],
        merge: false,
      });
    }
  }, [slug, catalog, baseSpec, initialElements, libraryBundle.libraryItems, onCompiledSpec]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const compileAndEmitNow = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      const result = compileExcalidrawToGenUI(elements, {
        catalog,
        baseSpec,
        slug,
      });
      setLatestResult(result);
      onCompiledSpec(result, elements);
    },
    [catalog, baseSpec, slug, onCompiledSpec],
  );

  const handleSceneChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      const signature = computeSceneSignature(elements);
      if (signature === lastSignatureRef.current) {
        return;
      }
      lastSignatureRef.current = signature;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        const snapshot = apiRef.current?.getSceneElements() ?? elements;
        compileAndEmitNow(snapshot);
      }, DEBOUNCE_COMPILE_MS);
    },
    [compileAndEmitNow],
  );

  const handleSyncFromLiveSpec = useCallback(() => {
    const nextElements = specToInitialExcalidrawElements(baseSpec, catalog);
    lastSignatureRef.current = computeSceneSignature(nextElements);
    apiRef.current?.updateScene({ elements: nextElements });
    compileAndEmitNow(nextElements);
    announceStatus("Synced canvas from active template Spec");
  }, [baseSpec, catalog, compileAndEmitNow, announceStatus]);

  const handleLoadSample = useCallback(() => {
    const nextElements = buildSampleWireframeElements();
    lastSignatureRef.current = computeSceneSignature(nextElements);
    apiRef.current?.updateScene({ elements: [...nextElements] });
    compileAndEmitNow(nextElements);
    announceStatus("Loaded sample wireframe");
  }, [compileAndEmitNow, announceStatus]);

  const handleClearCanvas = useCallback(() => {
    lastSignatureRef.current = "0|";
    apiRef.current?.updateScene({ elements: [] });
    compileAndEmitNow([]);
    announceStatus("Cleared canvas");
  }, [compileAndEmitNow, announceStatus]);

  const handleInsertCatalogBlock = useCallback(
    (componentName: string) => {
      const libItem = libraryBundle.libraryItems.find(
        (item) => item.name === componentName,
      );
      if (!libItem || libItem.elements.length === 0) return;

      const existing = apiRef.current?.getSceneElements() ?? [];
      let maxBottomY = 80;
      for (const el of existing) {
        if (el.isDeleted) continue;
        const bottom = (el.y ?? 0) + Math.abs(el.height ?? 0);
        if (bottom > maxBottomY) maxBottomY = bottom;
      }

      const nextOffset = insertCounter + 1;
      setInsertCounter(nextOffset);
      const idSuffix = `ins-${Date.now().toString(36)}-${nextOffset}`;
      const baseOriginX = 120;
      const baseOriginY = existing.length === 0 ? 90 : maxBottomY + 28;
      const idMap = new Map<string, string>();
      for (const el of libItem.elements) {
        idMap.set(el.id, `${el.id}-${idSuffix}`);
      }

      const clonedElements = libItem.elements.map((el) => {
        const nextId = idMap.get(el.id) ?? `${el.id}-${idSuffix}`;
        const rec = el as unknown as Record<string, unknown>;
        const containerId =
          typeof rec.containerId === "string"
            ? (idMap.get(rec.containerId) ?? null)
            : undefined;
        const boundElements = Array.isArray(el.boundElements)
          ? el.boundElements.map((b) => ({
              ...b,
              id: idMap.get(b.id) ?? b.id,
            }))
          : null;

        return {
          ...el,
          id: nextId,
          x: el.x + baseOriginX,
          y: el.y + baseOriginY,
          version: el.version + 1,
          versionNonce: el.versionNonce + nextOffset,
          boundElements,
          ...(containerId !== undefined ? { containerId } : {}),
        } as NonDeleted<ExcalidrawElement>;
      });

      const updated = [...existing, ...clonedElements];
      lastSignatureRef.current = computeSceneSignature(updated);
      apiRef.current?.updateScene({ elements: updated });
      compileAndEmitNow(updated);
      announceStatus(`Added ${componentName} block`);
    },
    [libraryBundle.libraryItems, insertCounter, compileAndEmitNow, announceStatus],
  );

  const handleCopyKiroDesignMd = useCallback(async () => {
    const activeElements =
      apiRef.current?.getSceneElements() ?? initialElements;
    const artifact = exportExcalidrawToKiroArtifacts({
      elements: activeElements,
      compileResult: latestResult,
      slug,
      title: templateTitle,
    });
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(artifact.designMdSection);
      announceStatus(`Copied Kiro design.md (${artifact.filenameDesignMd})`);
    } catch {
      announceStatus("Copy failed — clipboard permission denied");
    }
  }, [initialElements, latestResult, slug, templateTitle, announceStatus]);

  const handleDownloadExcalidrawJson = useCallback(() => {
    const activeElements =
      apiRef.current?.getSceneElements() ?? initialElements;
    const artifact = exportExcalidrawToKiroArtifacts({
      elements: activeElements,
      compileResult: latestResult,
      slug,
      title: templateTitle,
    });
    triggerJsonDownload(artifact.filenameExcalidraw, artifact.excalidrawJson);
    announceStatus(`Downloaded ${artifact.filenameExcalidraw}`);
  }, [initialElements, latestResult, slug, templateTitle, announceStatus]);

  return (
    <section
      data-testid="wireframe-architect-panel"
      aria-label="Wireframe Architect spatial whiteboard"
      className="hub-bento-card flex flex-col text-[#0B1221] overflow-hidden min-h-[520px] sm:min-h-[640px]"
    >
      {/* Top Action Toolbar following modern-web-guidance role="toolbar" pattern */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E8EDF5] bg-white px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-2 w-2 rounded-full bg-[#2563EB]"
          />
          <span className="font-mono text-xs font-bold text-[#0B1221]">
            Wireframe Architect
            <span className="hidden sm:inline"> · Deterministic Spatial Compiler</span>
          </span>
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#5B6B82]">
            {latestResult.compiledNodeCount} blocks ·{" "}
            {latestResult.stateBindings.length} state arrows
          </span>
        </div>

        <div
          role="toolbar"
          aria-label="Wireframe Architect actions"
          className="hub-scroll-row w-full items-center gap-1.5 font-mono text-[11px] sm:w-auto sm:flex-wrap"
        >
          <div role="group" aria-label="Canvas controls" className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSyncFromLiveSpec}
              data-testid="wireframe-sync-spec-btn"
              className="min-h-[30px] min-w-[30px] rounded-full border border-[#CBD5E1] bg-white px-3 py-1 font-medium text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
            >
              ↺ Sync from Spec
            </button>
            <button
              type="button"
              onClick={handleLoadSample}
              data-testid="wireframe-load-sample-btn"
              className="min-h-[30px] min-w-[30px] rounded-full border border-[#2563EB] bg-white px-3 py-1 font-medium text-[#1D4ED8] hover:bg-[#EFF4FF] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
            >
              Load Sample
            </button>
            <button
              type="button"
              onClick={handleClearCanvas}
              data-testid="wireframe-clear-btn"
              className="min-h-[30px] min-w-[30px] rounded-full border border-[#CBD5E1] bg-white px-3 py-1 font-medium text-[#5B6B82] hover:border-[#B91C1C] hover:text-[#B91C1C] hover:bg-[#FEF2F2] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
            >
              Clear
            </button>
          </div>

          <span
            role="separator"
            aria-orientation="vertical"
            className="mx-1 h-4 w-px border-l border-[#E2E8F0]"
          />

          <div role="group" aria-label="Kiro spec export" className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopyKiroDesignMd()}
              data-testid="wireframe-copy-design-btn"
              className="min-h-[30px] min-w-[30px] rounded-full border border-[#2563EB] bg-[#EFF4FF] px-3 py-1 font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
            >
              Copy design.md Mermaid
            </button>
            <button
              type="button"
              onClick={handleDownloadExcalidrawJson}
              data-testid="wireframe-download-json-btn"
              className="min-h-[30px] min-w-[30px] rounded-full border border-[#CBD5E1] bg-white px-3 py-1 font-medium text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
            >
              .excalidraw.json
            </button>
            <button
              type="button"
              aria-pressed={showMermaidInspector}
              onClick={() => setShowMermaidInspector((v) => !v)}
              data-testid="wireframe-toggle-mermaid-btn"
              className={`min-h-[30px] min-w-[30px] rounded-full border px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                showMermaidInspector
                  ? "border-[#0B1324] bg-[#0B1324] text-white"
                  : "border-[#CBD5E1] bg-white text-[#0B1221] hover:bg-[#F8FAFC]"
              }`}
            >
              Mermaid Graph
            </button>
          </div>
        </div>
      </div>

      {/* Quick Catalog Block Palette (mirrors preloaded Excalidraw Library items) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8EDF5] bg-[#F8FAFC] px-3 py-2 sm:px-4">
        <div className="hub-scroll-row w-full items-center gap-1.5 font-mono text-[11px] sm:w-auto sm:flex-wrap">
          <span className="font-semibold text-[#5B6B82]">Catalog Shapes:</span>
          {libraryBundle.componentSummaries.map((comp) => (
            <button
              key={comp.name}
              type="button"
              onClick={() => handleInsertCatalogBlock(comp.name)}
              title={comp.description}
              data-testid={`wireframe-insert-${comp.name}`}
              className="min-h-[26px] rounded-full border border-[#2563EB]/35 bg-white px-2.5 py-0.5 font-medium text-[#1D4ED8] hover:border-[#2563EB] hover:bg-[#EFF4FF] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
            >
              + {comp.name}
            </button>
          ))}
        </div>

        {/* Dedicated live region outside buttons & toolbar */}
        <p
          role="status"
          aria-live="polite"
          data-testid="wireframe-status-live"
          className="min-h-[1rem] font-mono text-[11px] font-medium text-[#047857]"
        >
          {statusMessage}
        </p>
      </div>

      <WireframeDiagnosticsStrip result={latestResult} />

      {showMermaidInspector && (
        <div
          data-testid="wireframe-mermaid-drawer"
          className="border-b border-[#E8EDF5] bg-[#F8FAFC] p-3 font-mono text-xs text-[#0B1221]"
        >
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6B82]">
            <span>Generated `.kiro/specs/{slug}/design.md` Mermaid Architecture Graph</span>
            <span>Sorted top-to-bottom / left-to-right by (y, x)</span>
          </div>
          <pre className="hub-code-surface max-h-44 overflow-auto rounded-xl border border-white/10 p-3 text-[11px]">
            <code>{latestResult.mermaidDiagram}</code>
          </pre>
        </div>
      )}

      {/* White-Paper Excalidraw Canvas + Docked Right-Hand Wireframe Stencil Library */}
      <div className="flex flex-1 min-h-[420px] w-full bg-white sm:min-h-[560px]">
        <div className="relative flex-1 min-h-[420px] min-w-0 sm:min-h-[560px]">
          <Excalidraw
            theme="light"
            excalidrawAPI={(api) => {
              apiRef.current = api;
              void api.updateLibrary({
                libraryItems: [...libraryBundle.libraryItems],
                merge: false,
              });
            }}
            initialData={{
              elements: initialElements,
              libraryItems: [...libraryBundle.libraryItems],
              appState: {
                viewBackgroundColor: "#ffffff",
                gridSize: 20,
                currentItemStrokeColor: "#0b1221",
                currentItemBackgroundColor: "#ffffff",
              },
            }}
            onChange={(elements) => handleSceneChange(elements)}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: true,
                clearCanvas: true,
                export: false,
                loadScene: true,
                saveToActiveFile: false,
                toggleTheme: true,
                saveAsImage: true,
              },
            }}
          />
        </div>

        {/* Docked Right-Hand Wireframe Stencil Library (Inspired by WZ Wireframe Kit + Excalidraw Library UI) */}
        <aside
          aria-label="Wireframe Stencil Library"
          className="hidden md:flex w-56 shrink-0 flex-col justify-between border-l border-[#E8EDF5] bg-white p-3.5"
        >
          <div className="space-y-3 overflow-y-auto pr-0.5">
            <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-2">
              <span className="text-xs font-bold text-[#2563EB]">
                Library · Wireframe Kit
              </span>
              <span className="font-mono text-[10px] text-[#64748B]">
                {libraryBundle.componentSummaries.length} stencils
              </span>
            </div>

            {/* 3-Primitive Legend (Blocks · Links · Tags) */}
            <div className="rounded-xl border border-[#E8EDF5] bg-[#F8FAFC] p-2.5 font-mono text-[10px] space-y-1 text-[#5B6B82]">
              <div className="font-bold text-[#0B1221]">
                ① Blocks · ② Links · ③ Tags
              </div>
              <div>
                Click any stencil to drop a Zod-verified wireframe block onto
                the canvas.
              </div>
            </div>

            {/* Visual Wireframe Stencil Grid */}
            <div className="grid grid-cols-2 gap-2">
              {libraryBundle.componentSummaries.map((comp, idx) => (
                <button
                  key={`stencil-${comp.name}`}
                  type="button"
                  onClick={() => handleInsertCatalogBlock(comp.name)}
                  title={`Insert ${comp.name}: ${comp.description}`}
                  className="group flex flex-col items-center justify-between gap-1.5 rounded-xl border border-[#E2E8F0] bg-white p-2 text-left hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] transition cursor-pointer"
                >
                  {/* Crisp Black-on-White Miniature Wireframe Icon */}
                  <div
                    aria-hidden="true"
                    className="w-full h-11 rounded border-[1.5px] border-[#0B1221] bg-white p-1.5 flex flex-col justify-between shadow-[1.5px_1.5px_0px_#0B1221]"
                  >
                    {idx % 4 === 0 ? (
                      <>
                        <div className="flex items-center justify-between gap-1">
                          <span className="h-1.5 w-5 bg-[#0B1221]" />
                          <span className="h-2 w-6 rounded-2xs bg-[#0B1221]" />
                        </div>
                        <div className="h-3 w-full border border-[#0B1221] flex items-center justify-center">
                          <span className="h-1.5 w-1.5 rounded-full border border-[#0B1221]" />
                        </div>
                      </>
                    ) : idx % 4 === 1 ? (
                      <>
                        <div className="h-1.5 w-8 bg-[#0B1221]" />
                        <div className="grid grid-cols-3 gap-0.5">
                          <span className="h-3.5 border border-[#0B1221]" />
                          <span className="h-3.5 border border-[#0B1221]" />
                          <span className="h-3.5 border border-[#0B1221]" />
                        </div>
                      </>
                    ) : idx % 4 === 2 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-[#0B1221]" />
                          <span className="h-1.5 flex-1 border border-[#0B1221]" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="h-1.5 w-6 bg-[#0B1221]" />
                          <span className="text-[7px] font-mono font-bold text-[#0B1221]">
                            →
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="h-2 w-7 bg-[#0B1221] text-[6px] text-white leading-none px-0.5">
                            TAG
                          </span>
                          <span className="h-2 w-2 rounded-full border border-[#0B1221]" />
                        </div>
                        <div className="h-1.5 w-full bg-[#CBD5E1]" />
                      </>
                    )}
                  </div>
                  <span className="w-full truncate font-mono text-[9px] font-bold text-[#0B1221] text-center">
                    {comp.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncFromLiveSpec}
            className="mt-3 w-full min-h-[34px] rounded-xl bg-[#4F46E5] px-3 py-1.5 font-mono text-[11px] font-semibold text-white hover:bg-[#4338CA] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            ↺ Rebuild Wireframe Kit
          </button>
        </aside>
      </div>
    </section>
  );
};
