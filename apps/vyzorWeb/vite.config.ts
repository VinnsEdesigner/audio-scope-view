import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": "/src",
      "@/ui": resolve(__dirname, "../../packages/ui/src"),
      "@/tamagui": resolve(__dirname, "../../packages/tamagui/src"),
    },
  },
});
