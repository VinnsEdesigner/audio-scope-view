function getEnvironment(key: string, fallback: string): string {
  if (globalThis.window !== undefined) {
    const environment = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
    return environment[key] ?? fallback;
  }
  return process.env[key] ?? fallback;
}

export const APP_VERSION = "v0.1.1-beta";

export const APP_NAME = "Audio Scope View";

/**
 * Per-device anonymous identity.
 *
 * This is NOT user-facing authentication — there is no signup/login UI. Each
 * browser generates a stable random id once and persists it in localStorage so
 * that all data (sessions, recordings, preferences) created from that device is
 * scoped to it and never returned to a different device. The id is sent on every
 * request via the `X-Device-Id` header and is treated by the server as the data
 * scoping key. The real, user-facing auth lives in the parent platform that will
 * embed this scope system as a feature.
 */
const DEVICE_ID_STORAGE_KEY = "asv:device-id";
const DEVICE_ID_HEADER = "X-Device-Id";

function generateDeviceId(): string {
  // Prefer the platform crypto UUID; fall back to a Math.random id for older runtimes.
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredDeviceId(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(DEVICE_ID_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeDeviceId(id: string): void {
  try {
    globalThis.localStorage?.setItem(DEVICE_ID_STORAGE_KEY, id);
  } catch {
    /* localStorage unavailable (SSR / privacy mode) — id stays in-memory only */
  }
}

let cachedDeviceId: string | undefined;

/**
 * Returns the stable device id for this browser, creating and persisting it on
 * first use. Safe to call during SSR (returns undefined when `window`/localStorage
 * are not available).
 */
export function getDeviceId(): string | undefined {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  if (globalThis.window === undefined) {
    return undefined;
  }

  const stored = readStoredDeviceId();
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const id = generateDeviceId();
  storeDeviceId(id);
  cachedDeviceId = id;
  return id;
}

/** HTTP header name used to transmit the device identity to the server. */
export const DEVICE_ID_HEADER_NAME = DEVICE_ID_HEADER;

export interface ClientConfig {
  graphqlEndpoint: string;

  websocketEndpoint: string;

  bootstrapKey: string;

  clientUrl: string;
}

const DEFAULT_CONFIG: ClientConfig = {
  // Relative paths so the browser connects to whatever host served the page
  // (the static-server / reverse proxy forwards these to the Rust backend).
  // Absolute URLs like ws://localhost:8080 break in Docker and remote deploys
  // because the browser's localhost is not the server.
  graphqlEndpoint: "/graphql",
  websocketEndpoint: "/ws",
  bootstrapKey: "",
  clientUrl: "http://localhost:3000",
};

const ENV_MAPPINGS: Record<keyof ClientConfig, string> = {
  graphqlEndpoint: "VITE_GRAPHQL_ENDPOINT",
  websocketEndpoint: "VITE_WEBSOCKET_ENDPOINT",
  bootstrapKey: "VITE_BOOTSTRAP_KEY",
  clientUrl: "VITE_CLIENT_URL",
};

function loadConfig(): ClientConfig {
  const config: ClientConfig = { ...DEFAULT_CONFIG };

  for (const [key, environmentVariable] of Object.entries(ENV_MAPPINGS)) {
    const value = getEnvironment(environmentVariable, DEFAULT_CONFIG[key as keyof ClientConfig]);
    if (value) {
      (config as unknown as Record<string, string>)[key] = value;
    }
  }

  return config;
}

export const config = loadConfig();

export function getConfig<K extends keyof ClientConfig>(key: K): ClientConfig[K] {
  return config[key];
}

const environment = (
  import.meta as unknown as { env: Record<string, boolean | string | undefined> }
).env;

export const isProduction = environment.PROD === true;

export const isDevelopment = environment.DEV === true;
