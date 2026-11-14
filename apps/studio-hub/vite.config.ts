import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@genui-studio/templates": path.resolve(
        __dirname,
        "../../packages/templates/src/index.ts",
      ),
    },
  },
  build: {
    target: "esnext",
  },
});
