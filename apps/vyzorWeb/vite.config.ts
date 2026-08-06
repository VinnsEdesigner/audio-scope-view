import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig(({ command, mode }) => {
  const isSsrBuild = command === "build" && mode === "ssr";

  return {
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths({
        root: ".",
      }),
    ],

    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
    },

    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        "@/lib/utilities": resolve(__dirname, "./src/lib/utils"),
        "@audio-scope-view/ui": resolve(__dirname, "../../packages/ui"),
        "@audio-scope-view/ui-radix": resolve(__dirname, "../../packages/ui-radix/src"),
        "@audio-scope-view/tamagui": resolve(__dirname, "../../packages/tamagui/src"),
        "@audio-scope-view/api-client": resolve(__dirname, "../../packages/api-client/src"),
        "@audio-scope-view/tailwind": resolve(__dirname, "../../packages/tailwind/src"),
        "tamagui": resolve(__dirname, "./node_modules/tamagui"),
      },
    },

    optimizeDeps: {
      include: ["tamagui", "@tamagui/core", "@audio-scope-view/tamagui"],
    },

    build: isSsrBuild
      ? {
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
          outDir: "dist/client",
          rollupOptions: {
            input: {
              main: resolve(__dirname, "index.html"),
            },
            output: {
              inlineDynamicImports: true, // Bundle everything to avoid circular dependency issues
            },
          },
          chunkSizeWarningLimit: 1500,
        },

    ssr: {
      noExternal: [
        "@audio-scope-view/ui",
        "@audio-scope-view/tamagui",
        "@audio-scope-view/api-client",
      ],
    },

    appType: "spa",
    base: "./",
  };
});
