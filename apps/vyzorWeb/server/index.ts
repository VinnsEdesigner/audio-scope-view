import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Read the index.html template
function getTemplate() {
  return fs.readFileSync(join(rootDir, "index.html"), "utf-8");
}

// Inject SSR-rendered content into the template
function injectHtml(template: string, appHtml: string) {
  // Replace the root div content with SSR content
  return template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
}

// Inject hydration script
function injectScripts(template: string, scripts: string[]) {
  const scriptTags = scripts.map((src) => `<script type="module" src="${src}"></script>`).join("\n");
  return template.replace("</body>", `${scriptTags}\n</body>`);
}

// Determine if request should be SSR or SPA
function shouldSSR(url: string): boolean {
  const ssrPaths = ["/", "/scope", "/settings", "/api-keys"];
  const spaOnlyPaths = ["/assets", "/_app", "/favicon.ico", "/robots.txt", "/sitemap.xml"];

  // Check if it's a static asset
  for (const path of spaOnlyPaths) {
    if (url.startsWith(path)) return false;
  }

  // Check if it's a known SSR path
  for (const path of ssrPaths) {
    if (url === path || url.startsWith(path + "/")) return true;
  }

  // Default to SPA for unknown routes
  return false;
}

async function createServer() {
  const { createServer: createViteServer } = await import("vite");

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  const server = http.createServer((req, res) => {
    const url = req.url || "/";

    vite.middlewares(req, res, async () => {
      try {
        const template = getTemplate();

        // Determine if we should SSR this request
        if (shouldSSR(url)) {
          // SSR Mode
          const { render } = await vite.ssrLoadModule(join(rootDir, "src/entry-server.tsx"));
          const { html, status } = await render({ url, mode: "string" });

          const finalHtml = injectHtml(template, html);

          res.statusCode = status;
          res.setHeader("Content-Type", "text/html");
          res.setHeader("X-SSR-Mode", "true");
          res.end(finalHtml);
        } else {
          // SPA Mode - let Vite handle static assets
          let served = false;

          // Try to serve static files from dist
          const distPath = join(rootDir, "dist");
          if (fs.existsSync(distPath)) {
            const staticPath = join(distPath, url);
            if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
              const content = fs.readFileSync(staticPath);
              const ext = url.split(".").pop() || "";
              const contentTypes: Record<string, string> = {
                js: "application/javascript",
                css: "text/css",
                html: "text/html",
                json: "application/json",
                png: "image/png",
                jpg: "image/jpeg",
                svg: "image/svg+xml",
                ico: "image/x-icon",
              };
              res.setHeader("Content-Type", contentTypes[ext] || "text/plain");
              res.setHeader("X-SSR-Mode", "false");
              res.end(content);
              served = true;
            }
          }

          if (!served) {
            // Fallback to index.html for SPA routing
            const indexPath = join(rootDir, "dist", "index.html");
            if (fs.existsSync(indexPath)) {
              const content = fs.readFileSync(indexPath, "utf-8");
              res.statusCode = 200;
              res.setHeader("Content-Type", "text/html");
              res.setHeader("X-SSR-Mode", "false");
              res.end(content);
            } else {
              res.statusCode = 404;
              res.end("Not found");
            }
          }
        }
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        console.error("Server error:", e);
        res.statusCode = 500;
        res.end(e instanceof Error ? e.message : "Unknown error");
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`   SSR Mode: http://localhost:${PORT}/ (or any app route)`);
    console.log(`   SPA Mode: http://localhost:${PORT}/scope/any-id`);
  });
}

createServer();
