/**
 * Points Excalidraw at the fonts this app serves itself (`/excalidraw-assets/fonts/...`,
 * provided by the Vite plugin in vite.config.ts) instead of its default esm.sh CDN.
 * Imported first in main.tsx so it is set before any Excalidraw code loads.
 */
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

if (typeof window !== "undefined") {
  window.EXCALIDRAW_ASSET_PATH = `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/excalidraw-assets/`;
}

export {};
