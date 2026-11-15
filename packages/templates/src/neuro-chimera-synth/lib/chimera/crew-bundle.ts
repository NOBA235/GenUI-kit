/**
 * Kiro Crew app bundle helpers (`lib/chimera/crew-bundle.ts`).
 *
 * Collects the `kiro-crew-app/` files from the template source bundle (plus the embedded
 * Python hooks, which the shared bundler skips), validates them with the App Kit rules, and
 * packs them into a zip that `kirocrew app install` can use after extraction.
 */

import JSZip from "jszip";
import { CREW_PYTHON_FILES, type CrewTextFile } from "./crew-python-files.js";
import { validateCrewBundle, type CrewAgent, type CrewManifest, type CrewValidation } from "./crew-manifest.js";

export const CREW_APP_PREFIX = "kiro-crew-app/";
export const CREW_APP_FOLDER = "chimera-lab";

export interface SourceFileLike {
  readonly path: string;
  readonly content: string;
  readonly encoding?: "utf8" | "base64";
}

/** App-relative files (`app.json`, `agents/…`), sorted, with the embedded Python files merged in. */
export function collectCrewAppFiles(sourceFiles: readonly SourceFileLike[]): CrewTextFile[] {
  const byPath = new Map<string, string>();
  for (const file of [...sourceFiles, ...CREW_PYTHON_FILES]) {
    if (!file.path.startsWith(CREW_APP_PREFIX)) continue;
    if ("encoding" in file && file.encoding === "base64") continue;
    byPath.set(file.path.slice(CREW_APP_PREFIX.length), file.content);
  }
  return [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({ path, content }));
}

export function validateCrewAppFiles(files: readonly CrewTextFile[]): CrewValidation<{ manifest: CrewManifest; agents: CrewAgent[] }> {
  const encoder = new TextEncoder();
  return validateCrewBundle(Object.fromEntries(files.map((f) => [f.path, encoder.encode(f.content)])));
}

/** Zip the app under `chimera-lab/` so it extracts to an installable folder. */
export async function buildCrewAppZip(files: readonly CrewTextFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const folder = zip.folder(CREW_APP_FOLDER)!;
  for (const file of files) folder.file(file.path, file.content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
