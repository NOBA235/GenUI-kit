import type { TemplateWireframeExport } from "@genui-studio/templates";
import {
  exportExcalidrawToKiroArtifacts,
  type ExcalidrawCompileResult,
} from "./excalidraw-compiler.js";

/**
 * Packages a Wireframe Architect compile for `generateTemplateZip(entry, { wireframe })`:
 * the compiled Spec, a full `.kiro/specs/<slug>/design.md` (Mermaid graph + traceability
 * tables) and the source Excalidraw scene.
 */
export function buildWireframeExport(input: {
  readonly result: ExcalidrawCompileResult;
  readonly sceneElements: readonly unknown[];
  readonly slug: string;
  readonly title: string;
}): TemplateWireframeExport {
  const artifact = exportExcalidrawToKiroArtifacts({
    elements: input.sceneElements,
    compileResult: input.result,
    slug: input.slug,
    title: input.title,
  });
  return {
    spec: input.result.spec,
    designMd: `# Design — ${input.title}\n\n${artifact.designMdSection}`,
    excalidrawJson: artifact.excalidrawJson,
  };
}
