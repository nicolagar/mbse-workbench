import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("/node_modules/d3-") >= 0 || id.indexOf("/node_modules/victory-vendor/") >= 0) return "chart-math";
          if (id.indexOf("recharts") >= 0) return "charts";
          if (id.indexOf("jspdf") >= 0) return "pdf-export";
          if (id.indexOf("write-excel-file") >= 0) return "xlsx-export";
          if (id.indexOf("elkjs") >= 0) return "graph-layout";
          if (id.indexOf("@xyflow") >= 0) return "model-graph";
          if (
            id.indexOf("/node_modules/react/") >= 0
            || id.indexOf("/node_modules/react-dom/") >= 0
            || id.indexOf("/node_modules/scheduler/") >= 0
          ) return "react-core";
          if (id.indexOf("/node_modules/lucide-react/") >= 0) return "icons";
          if (id.indexOf("/node_modules/zustand/") >= 0) return "state";
          if (id.indexOf("/node_modules/") >= 0) return "vendor";
          return undefined;
        }
      }
    }
  }
});
