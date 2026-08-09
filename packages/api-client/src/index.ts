export {
  config,
  getConfig,
  isProduction,
  isDevelopment,
  APP_VERSION,
  APP_NAME,
  getDeviceId,
  DEVICE_ID_HEADER_NAME,
} from "./config";
export type { ClientConfig } from "./config";

export { graphqlClient, HttpLink } from "./audioScopeView/graphql/client";
export * from "./audioScopeView/graphql";
export * from "./audioScopeView/websocket";

export * from "./domain";
