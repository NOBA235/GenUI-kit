import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const collectorTarget = process.env.SPATIAL_OPS_COLLECTOR_URL ?? "http://127.0.0.1:4318";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/v1": collectorTarget,
      "/api": collectorTarget,
      "/health": collectorTarget,
    },
  },
  build: {
    target: "esnext",
  },
});
