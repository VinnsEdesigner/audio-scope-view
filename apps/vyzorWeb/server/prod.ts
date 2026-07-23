/**
 * Production Node.js SSR Server
 * Serves the built application with SSR for initial page loads
 * and SPA fallback for client-side navigation
 */

import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "fs";
import fsPromises from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Dist directories - the structure is: dist/server and dist/client
const CLIENT_DIR = join(rootDir, "client");
const SERVER_DIR = join(rootDir, "server");

interface RenderResult {
  html: string;
  status: number;
}

/**
 * Load and execute the SSR render function
 */
async function getRenderFunction(): Promise<(url: string) => Promise<RenderResult>> {
  try {
    // Try to load the server bundle
    const serverPath = join(SERVER_DIR, "server.js");
    const serverModule = await import(serverPath);
    return serverModule.render;
  } catch {
    // Fallback: simple HTML shell for SPA-only mode
    return async () => ({
      html: "",
      status: 200,
    });
  }
}

/**
 * Check if a path is a static asset
 */
function isStaticAsset(url: string): boolean {
  const staticExtensions = [".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2"];
  const ext = url.split(".").pop()?.toLowerCase() || "";
  return staticExtensions.includes(`.${ext}`) || url.startsWith("/assets");
}

/**
 * Get MIME type for file
 */
function getContentType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    js: "application/javascript",
    mjs: "application/javascript",
    css: "text/css",
    html: "text/html",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    webp: "image/webp",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  return types[ext] || "text/plain";
}

/**
 * Read the index.html template
 */
async function getIndexTemplate(): Promise<string> {
  try {
    return await fsPromises.readFile(join(CLIENT_DIR, "index.html"), "utf-8");
  } catch {
    return await fsPromises.readFile(join(rootDir, "index.html"), "utf-8");
  }
}

/**
 * Serve static file
 */
async function serveStatic(url: string, res: http.ServerResponse): Promise<boolean> {
  // Remove query strings
  const cleanUrl = url.split("?")[0];
  
  // Try client dist first
  let filePath = join(CLIENT_DIR, cleanUrl);
  
  // If not found, try root
  if (!fs.existsSync(filePath)) {
    filePath = join(rootDir, cleanUrl);
  }

  // If still not found, return false
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  try {
    const content = await fsPromises.readFile(filePath);
    const contentType = getContentType(cleanUrl);

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle SSR request
 */
async function handleSSR(url: string, render: (url: string) => Promise<RenderResult>): Promise<{ html: string; status: number }> {
  try {
    return await render(url);
  } catch (error) {
    console.error("SSR Error:", error);
    return { html: "<h1>500 Internal Server Error</h1>", status: 500 };
  }
}

/**
 * Create and start the server
 */
async function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.HOST || "0.0.0.0";

  // Get the render function
  const render = await getRenderFunction();

  // Check if SSR is available and working properly
  let ssrAvailable = true;
  try {
    const result = await render("/");
    // If SSR returns empty HTML, fall back to SPA mode
    if (!result.html || result.html.trim().length === 0) {
      console.log("SSR returned empty HTML, falling back to SPA mode");
      ssrAvailable = false;
    }
  } catch {
    ssrAvailable = false;
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url || "/";

    // Skip non-GET requests
    if (req.method && req.method !== "GET" && req.method !== "OPTIONS") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, OPTIONS");
      res.end("Method Not Allowed");
      return;
    }

    // CORS headers for API
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      // Static assets - serve directly
      if (isStaticAsset(url)) {
        const served = await serveStatic(url, res);
        if (!served) {
          res.statusCode = 404;
          res.end("Not Found");
        }
        return;
      }

      // SSR or SPA
      if (ssrAvailable) {
        // Try SSR first
        const { html, status } = await handleSSR(url, render);
        const template = await getIndexTemplate();

        // Inject SSR HTML
        const finalHtml = template.replace("<!--app-html-->", html);

        res.statusCode = status;
        res.setHeader("Content-Type", "text/html");
        res.setHeader("X-SSR-Mode", "true");
        res.end(finalHtml);
      } else {
        // SPA fallback - serve index.html
        const template = await getIndexTemplate();

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.setHeader("X-SSR-Mode", "false");
        res.end(template);
      }
    } catch (error) {
      console.error("Request error:", error);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running at http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
    console.log(`   Mode: ${ssrAvailable ? "SSR + SPA" : "SPA only"}`);
    console.log(`   Static: ${CLIENT_DIR}`);
  });
}

startServer().catch(console.error);
