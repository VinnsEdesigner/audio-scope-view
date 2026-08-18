// api-config.ts — RN transport config (the mobile analog of api-client's
// config.ts, which is browser-bound: import.meta.env + window.location).
//
// On RN there is no window.location and import.meta.env is not Vite's. Endpoints
// are resolved from env vars (set via the JS bundle / EAS Build env or
// app.json extra) with sensible dev defaults. The WebSocket endpoint is derived
// from the GraphQL endpoint (http→ws, https→wss) so a single base URL suffices.

export interface ClientConfig {
  graphqlEndpoint: string;
  websocketEndpoint: string;
  graphqlSubscriptionEndpoint: string;
  bootstrapKey: string;
  clientUrl: string;
}

// Dev defaults point at the local static server / Rust backend (see
// AGENTS/SETUP_GUIDE.md Step 5). Override at build time via env:
//   ASV_GRAPHQL_ENDPOINT, ASV_BOOTSTRAP_KEY, ASV_CLIENT_URL
const DEV_GRAPHQL = "http://127.0.0.1:3000/graphql";
const DEV_BOOTSTRAP_KEY = "dev-bootstrap-key-change-in-production";
const DEV_CLIENT_URL = "http://127.0.0.1:3000";

function env(key: string, fallback: string): string {
  // RN bundles process.env at build time (Metro replaces known keys). Unknown
  // keys are undefined → fall back. expo also surfaces Constants.expoConfig.env
  // but reading env here keeps the config package-agnostic.
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[key];
  return value && value.length > 0 ? value : fallback;
}

function loadConfig(): ClientConfig {
  const graphqlEndpoint = env("ASV_GRAPHQL_ENDPOINT", DEV_GRAPHQL);
  const bootstrapKey = env("ASV_BOOTSTRAP_KEY", DEV_BOOTSTRAP_KEY);
  const clientUrl = env("ASV_CLIENT_URL", DEV_CLIENT_URL);

  // Derive the WS endpoint from the GraphQL endpoint: http(s)://host/graphql → ws(s)://host/ws
  const wsBase = graphqlEndpoint
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
    .replace(/\/graphql$/, "");
  const websocketEndpoint = `${wsBase}/ws`;
  const graphqlSubscriptionEndpoint = `${wsBase}/graphql/ws`;

  return {
    graphqlEndpoint,
    websocketEndpoint,
    graphqlSubscriptionEndpoint,
    bootstrapKey,
    clientUrl,
  };
}

export const config = loadConfig();

export function getConfig<K extends keyof ClientConfig>(key: K): ClientConfig[K] {
  return config[key];
}

export const APP_VERSION = "v0.1.1-beta";
export const APP_NAME = "Audio Scope View";
export const isProduction = env("NODE_ENV", "development") === "production";
export const isDevelopment = !isProduction;
