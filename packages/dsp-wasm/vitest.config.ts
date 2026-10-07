import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run in Node so the WASM module's ENVIRONMENT=node fallback applies.
    environment: "node",
    include: ["test/**/*.test.ts"],
    // The generated audioscope.js is an ES module; allow importing it.
    server: { deps: { inline: [/audioscope/] } },
    testTimeout: 30000,
  },
});
