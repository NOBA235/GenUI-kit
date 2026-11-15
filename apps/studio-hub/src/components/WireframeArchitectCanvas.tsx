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

export interface WireframeArchitectCanvasProps {
  readonly slug: string;
  readonly templateTitle: string;
  readonly catalog: VerifiedCatalog<any, any>;
  readonly baseSpec: Spec | null;
  readonly colorScheme?: "dark" | "light";
  readonly onCompiledSpec: (result: ExcalidrawCompileResult) => void;
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
    () => specToInitialExcalidrawElements(baseSpec, catalog),
    [baseSpec, catalog],
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
    onCompiledSpec(compiled);

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
      onCompiledSpec(result);
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
      className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl overflow-hidden min-h-[640px]"
    >
      {/* Top Action Toolbar following modern-web-guidance role="toolbar" pattern */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-mono text-xs font-semibold text-slate-100">
            Wireframe Architect · Zero-LLM Spatial Compiler
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
            {latestResult.compiledNodeCount} blocks ·{" "}
            {latestResult.stateBindings.length} state arrows
          </span>
        </div>

        <div
          role="toolbar"
          aria-label="Wireframe Architect actions"
          className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]"
        >
          <div role="group" aria-label="Canvas controls" className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSyncFromLiveSpec}
              data-testid="wireframe-sync-spec-btn"
              className="min-h-[28px] min-w-[28px] rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-400 transition cursor-pointer"
            >
              ↺ Sync from Spec
            </button>
            <button
              type="button"
              onClick={handleClearCanvas}
              data-testid="wireframe-clear-btn"
              className="min-h-[28px] min-w-[28px] rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-300 hover:border-rose-400/60 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-cyan-400 transition cursor-pointer"
            >
              Clear
            </button>
          </div>

          <span
            role="separator"
            aria-orientation="vertical"
            className="mx-1 h-4 w-px border-l border-slate-700"
          />

          <div role="group" aria-label="Kiro spec export" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleCopyKiroDesignMd()}
              data-testid="wireframe-copy-design-btn"
              className="min-h-[28px] min-w-[28px] rounded border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-200 hover:bg-emerald-500/25 focus-visible:outline-2 focus-visible:outline-cyan-400 transition cursor-pointer"
            >
              Copy design.md Mermaid
            </button>
            <button
              type="button"
              onClick={handleDownloadExcalidrawJson}
              data-testid="wireframe-download-json-btn"
              className="min-h-[28px] min-w-[28px] rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-200 hover:border-cyan-400/60 focus-visible:outline-2 focus-visible:outline-cyan-400 transition cursor-pointer"
            >
              .excalidraw.json
            </button>
            <button
              type="button"
              aria-pressed={showMermaidInspector}
              onClick={() => setShowMermaidInspector((v) => !v)}
              data-testid="wireframe-toggle-mermaid-btn"
              className={`min-h-[28px] min-w-[28px] rounded border px-2.5 py-1 focus-visible:outline-2 focus-visible:outline-cyan-400 transition cursor-pointer ${
                showMermaidInspector
                  ? "border-purple-400/60 bg-purple-500/20 text-purple-200"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Mermaid Graph
            </button>
          </div>
        </div>
      </div>

      {/* Quick Catalog Block Palette (mirrors preloaded Excalidraw Library items) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="text-slate-400">Catalog Shapes:</span>
          {libraryBundle.componentSummaries.map((comp) => (
            <button
              key={comp.name}
              type="button"
              onClick={() => handleInsertCatalogBlock(comp.name)}
              title={comp.description}
              data-testid={`wireframe-insert-${comp.name}`}
              className="min-h-[24px] rounded border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/20 focus-visible:outline-2 focus-visible:outline-cyan-400 transition cursor-pointer"
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
          className="min-h-[1rem] font-mono text-[11px] text-emerald-300"
        >
          {statusMessage}
        </p>
      </div>

      {showMermaidInspector && (
        <div
          data-testid="wireframe-mermaid-drawer"
          className="border-b border-slate-800 bg-slate-900/70 p-3 font-mono text-xs text-slate-200"
        >
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Generated `.kiro/specs/{slug}/design.md` Mermaid Architecture Graph</span>
            <span>Sorted top-to-bottom / left-to-right by (y, x)</span>
          </div>
          <pre className="max-h-44 overflow-auto rounded border border-slate-800 bg-slate-950 p-2.5 text-[11px] text-cyan-200">
            <code>{latestResult.mermaidDiagram}</code>
          </pre>
        </div>
      )}

      {/* Lazy-isolated Excalidraw Canvas */}
      <div className="relative flex-1 min-h-[540px] w-full">
        <Excalidraw
          theme={colorScheme}
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
              viewBackgroundColor: colorScheme === "light" ? "#f8fafc" : "#0b1120",
              gridSize: 20,
              currentItemStrokeColor: "#38bdf8",
              currentItemBackgroundColor: "#0f172a",
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
    </section>
  );
};
