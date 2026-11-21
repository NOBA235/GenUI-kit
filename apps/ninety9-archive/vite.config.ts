import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/ninety9/",
  plugins: [react(), tailwindcss()],
  publicDir: path.resolve(__dirname, "../../public"),
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
