/**
 * Unified Build Script
 * 
 * Builds the application with configurable modes via environment variables.
 * 
 * Environment Variables (from .env or shell):
 *   NODE_ENV          - development | production (default: production)
 *   BUILD_MODE        - spa | ssr | all (default: ssr)
 *   BUILD_API_CLIENT  - true to also build api-client package (default: false)
 *   SKIP_CLIENT       - true to skip client build (default: false)
 *   SKIP_SSR          - true to skip SSR build (default: false)
 *   CLEAN             - true to clean dist before building (default: true in CI)
 *   SSR_OUTDIR        - Override SSR output directory
 *   CLIENT_OUTDIR     - Override client output directory
 * 
 * Usage:
 *   npm run build                    # SSR production build
 *   BUILD_MODE=spa npm run build     # SPA only production build
 *   BUILD_MODE=all npm run build     # Both SPA and SSR
 *   BUILD_API_CLIENT=true npm run build  # Also build api-client
 *   NODE_ENV=development BUILD_MODE=ssr npm run build
 * 
 * The script reads from .env file in the app directory.
 */

import { cp, mkdir, rm, readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { existsSync } from "fs";

// Load .env file
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const workspaceRoot = join(rootDir, "..", "..");

// Load environment from .env file
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: join(rootDir, ".env") });
} catch {
  // dotenv not available, rely on shell environment
}

// Configuration
const config = {
  nodeEnv: process.env.NODE_ENV || "production",
  buildMode: process.env.BUILD_MODE || "ssr",
  buildApiClient: process.env.BUILD_API_CLIENT === "true",
  skipClient: process.env.SKIP_CLIENT === "true",
  skipSSR: process.env.SKIP_SSR === "true",
  clean: process.env.CLEAN !== "false" || process.env.CI === "true",
  ssrOutDir: process.env.SSR_OUTDIR || join(rootDir, "dist/server"),
  clientOutDir: process.env.CLIENT_OUTDIR || join(rootDir, "dist/client"),
  apiClientOutDir: join(workspaceRoot, "packages", "api-client", "dist"),
};

// Color codes for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(level: string, message: string, color: keyof typeof colors = "reset") {
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors[color]}${level}:${colors.reset} ${message}`);
}

function info(message: string) { log("INFO", message, "blue"); }
function success(message: string) { log("OK", message, "green"); }
function warn(message: string) { log("WARN", message, "yellow"); }
function error(message: string) { log("ERROR", message, "magenta"); }

function banner(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);
}

function exec(command: string, options: { cwd?: string; env?: Record<string, string> } = {}): string {
  info(`Executing: ${command}`);
  try {
    const result = execSync(command, {
      cwd: options.cwd || rootDir,
      env: { ...process.env, ...options.env },
      stdio: "pipe",
      encoding: "utf-8",
    });
    return result;
  } catch (e: any) {
    error(`Command failed: ${command}`);
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.error(e.stderr);
    throw e;
  }
}

async function cleanDist() {
  const distDir = join(rootDir, "dist");
  if (existsSync(distDir)) {
    info(`Cleaning ${distDir}`);
    await rm(distDir, { recursive: true, force: true });
  }
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function copyPublicFiles() {
  const publicSrc = join(rootDir, "public");
  const publicDest = join(config.clientOutDir);

  if (!existsSync(publicSrc)) {
    warn(`Public directory not found: ${publicSrc}`);
    return;
  }

  info(`Copying public files to ${publicDest}`);
  
  const files = ["robots.txt", "sitemap.xml", "favicon.ico"];
  for (const file of files) {
    const src = join(publicSrc, file);
    if (existsSync(src)) {
      await cp(src, join(publicDest, file), { force: true });
      success(`Copied ${file}`);
    }
  }
}

async function buildApiClient(): Promise<boolean> {
  if (!config.buildApiClient) {
    return false;
  }

  info(`Building api-client package`);
  
  try {
    const apiClientDir = join(workspaceRoot, "packages", "api-client");
    exec("pnpm run build", { cwd: apiClientDir });
    success("API Client build complete");
    return true;
  } catch (e) {
    error("API Client build failed");
    throw e;
  }
}

async function buildClient(): Promise<boolean> {
  if (config.skipClient) {
    warn("Skipping client build (SKIP_CLIENT=true)");
    return false;
  }

  info(`Building client (output: ${config.clientOutDir})`);
  
  try {
    await ensureDir(config.clientOutDir);
    exec("vite build", { cwd: rootDir, env: { ...process.env, OUTPUT_DIR: config.clientOutDir } });
    
    await copyPublicFiles();
    success("Client build complete");
    return true;
  } catch (e) {
    error("Client build failed");
    throw e;
  }
}

async function buildSSR(): Promise<boolean> {
  if (config.skipSSR) {
    warn("Skipping SSR build (SKIP_SSR=true)");
    return false;
  }

  info(`Building SSR bundle (output: ${config.ssrOutDir})`);
  
  try {
    await ensureDir(config.ssrOutDir);
    
    exec("vite build --mode ssr", { cwd: rootDir });
    
    const prodSrc = join(rootDir, "server", "prod.ts");
    
    exec(`tsc "${prodSrc}" --outDir "${config.ssrOutDir}" --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports`, {
      cwd: rootDir
    });
    
    success("SSR build complete");
    return true;
  } catch (e) {
    error("SSR build failed");
    throw e;
  }
}

async function linkAssets() {
  const manifest = {
    buildTime: new Date().toISOString(),
    nodeEnv: config.nodeEnv,
    buildMode: config.buildMode,
    clientOutDir: config.clientOutDir,
    ssrOutDir: config.ssrOutDir,
    assets: {
      client: [] as string[],
      server: [] as string[],
    },
  };

  const clientAssetsDir = join(config.clientOutDir, "assets");
  if (existsSync(clientAssetsDir)) {
    const { readdir } = await import("fs/promises");
    const files = await readdir(clientAssetsDir);
    manifest.assets.client = files.filter(f => f.endsWith(".js") || f.endsWith(".css"));
  }

  if (existsSync(config.ssrOutDir)) {
    const { readdir } = await import("fs/promises");
    const files = await readdir(config.ssrOutDir);
    manifest.assets.server = files.filter(f => f.endsWith(".js"));
  }

  const manifestPath = join(rootDir, "dist", "manifest.json");
  await ensureDir(join(rootDir, "dist"));
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  success("Build manifest written");
}

async function printSummary() {
  console.log(`\n${colors.bright}Build Summary:${colors.reset}`);
  console.log(`  ${colors.green}Node Env:${colors.reset}       ${config.nodeEnv}`);
  console.log(`  ${colors.green}Build Mode:${colors.reset}    ${config.buildMode}`);
  console.log(`  ${colors.green}API Client:${colors.reset}   ${config.buildApiClient ? "included" : "not built"}`);
  console.log(`  ${colors.green}Client:${colors.reset}       ${config.clientOutDir}`);
  console.log(`  ${colors.green}SSR:${colors.reset}         ${config.ssrOutDir}`);
  console.log(`  ${colors.green}Manifest:${colors.reset}     dist/manifest.json`);
  
  console.log(`\n${colors.bright}To start the server:${colors.reset}`);
  console.log(`  ${colors.cyan}cd apps/vyzorWeb && node dist/server/prod.js${colors.reset}`);
  console.log(`  ${colors.cyan}PORT=3000 HOST=0.0.0.0 node dist/server/prod.js${colors.reset}\n`);
}

async function main() {
  banner("Audio Scope View - Unified Build");
  
  console.log(`${colors.bright}Configuration:${colors.reset}`);
  console.log(`  NODE_ENV:        ${config.nodeEnv}`);
  console.log(`  BUILD_MODE:      ${config.buildMode}`);
  console.log(`  BUILD_API_CLIENT:${config.buildApiClient}`);
  console.log(`  SKIP_CLIENT:     ${config.skipClient}`);
  console.log(`  SKIP_SSR:        ${config.skipSSR}`);
  console.log(`  CLEAN:           ${config.clean}`);
  console.log("");

  try {
    if (config.clean) {
      await cleanDist();
    }

    await ensureDir(config.clientOutDir);
    await ensureDir(config.ssrOutDir);

    const built: string[] = [];

    // Always build api-client first if requested
    if (config.buildApiClient) {
      await buildApiClient();
      built.push("API-Client");
    }

    if (config.buildMode === "spa") {
      await buildClient();
      built.push("SPA");
    } else if (config.buildMode === "ssr") {
      await buildClient();
      await buildSSR();
      built.push("SPA", "SSR");
    } else if (config.buildMode === "all") {
      await buildClient();
      await buildSSR();
      built.push("SPA", "SSR");
    }

    await linkAssets();

    console.log(`\n${colors.green}${colors.bright}✓ Build successful!${colors.reset}`);
    console.log(`  Built: ${built.join(", ")}`);
    
    await printSummary();
    
    process.exit(0);
  } catch (e) {
    error("Build failed");
    console.error(e);
    process.exit(1);
  }
}

main();
