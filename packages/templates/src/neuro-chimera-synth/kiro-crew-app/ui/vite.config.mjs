import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the dashboard page to ../dist/index.mjs (app.json -> ui.entry).
// React and the Kiro Crew SDK come from the host import map, so they stay external.
export default defineConfig({
  plugins: [react({ jsxRuntime: "classic" })],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    lib: {
      entry: "src/App.tsx",
      formats: ["es"],
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external: ["react", "react-dom", "@kirocrew/app-sdk", "@kirocrew/app-sdk/ui", "lucide-react", "@tanstack/react-query"],
    },
  },
});
