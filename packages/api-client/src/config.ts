/**
 * Configuration module for API Client
 * Reads from environment variables at build/runtime
 */

/**
 * Get environment variable for browser or server context
 */
function getEnv(key: string, fallback: string): string {
  if (typeof window !== "undefined") {
    return (import.meta.env[key] as string | undefined) ?? fallback;
  }
  return process.env[key] ?? fallback;
}

/**
 * Application version
 */
export const APP_VERSION = "2.0.0";

/**
 * Application name
 */
export const APP_NAME = "Audio Scope View";

/**
 * Configuration interface for API Client
 */
export interface ClientConfig {
  /** GraphQL endpoint URL */
  graphqlEndpoint: string;
  /** WebSocket endpoint for subscriptions */
  websocketEndpoint: string;
  /** Bootstrap key for initial server authentication */
  bootstrapKey: string;
  /** Client application URL (used for CORS and callbacks) */
  clientUrl: string;
}

/**
 * Default configuration values
 * These should be overridden by environment variables in production
 */
const DEFAULT_CONFIG: ClientConfig = {
  graphqlEndpoint: "/graphql",
  websocketEndpoint: "ws://localhost:8080/graphql",
  bootstrapKey: "",
  clientUrl: "http://localhost:3000",
};

/**
 * Environment variable mappings
 * Maps our config keys to VITE_ prefixed env vars for Vite
 */
const ENV_MAPPINGS: Record<keyof ClientConfig, string> = {
  graphqlEndpoint: "VITE_GRAPHQL_ENDPOINT",
  websocketEndpoint: "VITE_WEBSOCKET_ENDPOINT",
  bootstrapKey: "VITE_BOOTSTRAP_KEY",
  clientUrl: "VITE_CLIENT_URL",
};

/**
 * Load configuration from environment variables
 * Called once at module initialization
 */
function loadConfig(): ClientConfig {
  const config: ClientConfig = { ...DEFAULT_CONFIG };

  for (const [key, envVar] of Object.entries(ENV_MAPPINGS)) {
    const value = getEnv(envVar, DEFAULT_CONFIG[key as keyof ClientConfig]);
    if (value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any)[key] = value;
    }
  }

  return config;
}

/**
 * Singleton config instance
 */
export const config = loadConfig();

/**
 * Get config value (for dynamic access)
 */
export function getConfig<K extends keyof ClientConfig>(key: K): ClientConfig[K] {
  return config[key];
}

/**
 * Check if running in production
 */
export const isProduction = import.meta.env.PROD;

/**
 * Check if running in development
 */
export const isDevelopment = import.meta.env.DEV;
