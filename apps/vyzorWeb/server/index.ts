import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

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
        const { render } = await vite.ssrLoadModule(join(rootDir, "src/entry-server.tsx"));
        const html = await render(`http://localhost${url}`);

        const template = fs.readFileSync(join(rootDir, "index.html"), "utf-8");
        const finalHtml = template.replace("<!--app-html-->", html);

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.end(finalHtml);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        console.error(e);
        res.statusCode = 500;
        res.end(e instanceof Error ? e.message : "Unknown error");
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

createServer();
