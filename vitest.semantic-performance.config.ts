import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["verification/semanticPerformance.check.ts"], environment: "node", maxWorkers: 1, minWorkers: 1 } });
