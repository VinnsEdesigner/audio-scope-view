import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

export default defineConfig(({ command, mode }) => {
  const isSsrBuild = command === "build" && mode === "ssr";

  return {
    plugins: [
      react(),
      tsconfigPaths({
        root: ".",
      }),
    ],

    // Tamagui reads process.env.* at runtime; provide safe browser defaults.
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
      "process.env.TAMAGUI_TARGET": JSON.stringify("web"),
      "process.env": "{}",
    },

    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        "@audio-scope-view/ui": resolve(__dirname, "../../packages/ui"),
        "@audio-scope-view/tamagui": resolve(__dirname, "../../packages/tamagui/src"),
        "@audio-scope-view/api-client": resolve(__dirname, "../../packages/api-client/src"),
      },
    },

    build: isSsrBuild
      ? {
          // SSR build - outputs server bundle
          lib: {
            entry: resolve(__dirname, "src/entry-server.tsx"),
            formats: ["es"],
            fileName: () => "server.js",
          },
          rollupOptions: {
            external: [
              "react",
              "react-dom",
              "react-dom/server",
              "react-dom/client",
              "react-router-dom",
              "react-router-dom/server",
              "@tanstack/react-query",
              "node:http",
              "node:path",
              "node:fs",
              "node:url",
            ],
            output: {
              inlineDynamicImports: false,
            },
          },
          ssr: true,
          outDir: "dist/server",
        }
      : {
          // Client/SPA build
          outDir: "dist/client",
          rollupOptions: {
            input: {
              main: resolve(__dirname, "index.html"),
            },
          },
          chunkSizeWarningLimit: 800,
        },

    // SSR settings
    ssr: {
      noExternal: [
        "@audio-scope-view/ui",
        "@audio-scope-view/tamagui",
        "@audio-scope-view/api-client",
      ],
    },

    // SPA fallback
    appType: "spa",
    base: "./",
  };
});

