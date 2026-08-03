function getEnvironment(key: string, fallback: string): string {
  if (globalThis.window !== undefined) {
    const environment = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
    return environment[key] ?? fallback;
  }
  return process.env[key] ?? fallback;
}

export const APP_VERSION = "v0.1.0-beta";

export const APP_NAME = "Audio Scope View";

export interface ClientConfig {
  graphqlEndpoint: string;

  websocketEndpoint: string;

  bootstrapKey: string;

  clientUrl: string;
}

const DEFAULT_CONFIG: ClientConfig = {
  graphqlEndpoint: "/graphql",
  websocketEndpoint: "ws://localhost:8080/graphql",
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
