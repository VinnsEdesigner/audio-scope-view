// Mirrors apps/vyzorWeb/dist to a root-level dist/ so tooling that expects
// dist/index.html at the repo root can find the built app.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "apps/vyzorWeb/dist/client");
const target = path.join(root, "dist");

if (!fs.existsSync(source)) {
  console.error(`[sync-dist] missing build output: ${source}`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });

const serverSource = path.join(root, "apps/vyzorWeb/dist/server");
if (fs.existsSync(serverSource)) {
  fs.cpSync(serverSource, path.join(target, "server"), { recursive: true });
}

console.log(`[sync-dist] copied ${source} -> ${target}`);
