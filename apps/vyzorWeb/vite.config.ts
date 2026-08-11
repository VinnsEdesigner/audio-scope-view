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
      {
        name: "log-graphql",
        configureServer(server) {
          server.middlewares.use("/graphql", async (req, res, next) => {
            if (req.method === "POST") {
              let body = "";
              for await (const chunk of req) body += chunk;
              const opName = (body.match(/"operationName":"([^"]+)"/) || [])[1] || "?";
              const devId = req.headers["x-device-id"];
              const auth = req.headers["authorization"];
              console.log(`\n[GRAPHQL] op=${opName} device=${devId || "<none>"} auth=${auth ? auth.slice(0, 20) + "..." : "<none>"}`);
              const proxyReq = await import("http").then((http) => {
                return new Promise<void>((resolve) => {
                  const upstream = http.request(
                    { hostname: "127.0.0.1", port: 8090, path: "/graphql", method: "POST", headers: { ...req.headers, host: "127.0.0.1:8090" } },
                    (upRes) => {
                      let respBody = "";
                      upRes.on("data", (c) => (respBody += c));
                      upRes.on("end", () => {
                        const hasErr = respBody.includes('"errors"');
                        console.log(`[GRAPHQL] op=${opName} status=${upRes.statusCode} ${hasErr ? "ERRORS:" + respBody.slice(0, 300) : "ok"}`);
                        res.writeHead(upRes.statusCode, upRes.headers);
                        res.end(respBody);
                        resolve();
                      });
                    },
                  );
                  upstream.on("error", (e) => { console.log("[GRAPHQL] upstream err", e); res.writeHead(502); res.end(); resolve(); });
                  upstream.end(body);
                });
              });
              return;
            }
            next();
          });
        },
      },
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
      include: ["tamagui", "@tamagui/core", "@audio-scope-view/tamagui", "@audio-scope-view/dsp-wasm"],
    },

    // The WASM DSP artifact (packages/dsp-wasm/dist/audioscope.wasm) must be
    // served as a fetchable asset in dev and emitted as a build asset.
    assetsInclude: ["**/*.wasm"],

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

    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: [".prod-runtime.all-hands.dev"],
      proxy: {
        "/graphql": {
          target: "http://127.0.0.1:8090",
          changeOrigin: true,
        },
        "/ws": {
          target: "ws://127.0.0.1:8090",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
