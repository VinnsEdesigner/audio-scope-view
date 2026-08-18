// apollo-client.ts — Apollo client configured for React Native (the mobile
// analog of api-client/src/audioScopeView/graphql/client.ts, which is
// browser-bound: window.location, import.meta.env, browser WebSocketLink).
//
// Queries/mutations use an HttpLink against config.graphqlEndpoint; GraphQL
// subscriptions use a WebSocketLink against config.graphqlSubscriptionEndpoint.
// RN ships a global fetch + global WebSocket, so no polyfills are required.
// The per-device X-Device-Id + Authorization Bearer headers are attached on
// every HTTP request and in the WS connectionParams (browsers can't set WS
// handshake headers; RN's WebSocket also can't, so the device id is appended
// as a query param like the web client does).
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
  split,
  type NormalizedCacheObject,
} from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { config } from "./api-config";
import { ensureDeviceId, getDeviceId, DEVICE_ID_HEADER_NAME } from "./device-id";

let client: ApolloClient<NormalizedCacheObject> | undefined;

function createHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.bootstrapKey) {
    headers.Authorization = `Bearer ${config.bootstrapKey}`;
  }
  const deviceId = getDeviceId();
  if (deviceId) {
    headers[DEVICE_ID_HEADER_NAME] = deviceId;
  }
  return headers;
}

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext({ headers: createHeaders() });
  return forward(operation);
});

const errorLink = new ApolloLink((operation, forward) => {
  return forward(operation).map((response) => {
    if (response.errors && response.errors.length > 0) {
      response.errors = response.errors.map((err) => ({
        ...err,
        message: sanitizeErrorMessage(err.message || "Unknown GraphQL error"),
      }));
    }
    return response;
  });
});

export function sanitizeErrorMessage(message: string): string {
  const urlStripped = message
    .replace(/https?:\/\/[^\s'"]+/gi, "")
    .replace(/wss?:\/\/[^\s'"]+/gi, "");
  const collapsed = urlStripped.replace(/\s+/g, " ").trim();
  if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(collapsed)) {
    return "Network error: unable to reach the server. Check your connection and try again.";
  }
  return collapsed || message;
}

const httpLink = new HttpLink({
  uri: config.graphqlEndpoint,
  // RN provides fetch globally; @apollo/client's HttpLink uses it.
});

function appendDeviceIdQuery(endpoint: string, deviceId: string | undefined): string {
  if (!deviceId) return endpoint;
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}${DEVICE_ID_HEADER_NAME}=${encodeURIComponent(deviceId)}`;
}

function buildWebSocketLink(): ApolloLink | undefined {
  const endpoint = config.graphqlSubscriptionEndpoint;
  const deviceId = getDeviceId();
  const wsUri = appendDeviceIdQuery(endpoint, deviceId);

  return new WebSocketLink({
    uri: wsUri,
    options: {
      reconnect: true,
      connectionParams: () => {
        const params: Record<string, string> = {};
        if (config.bootstrapKey) {
          params.Authorization = `Bearer ${config.bootstrapKey}`;
        }
        if (deviceId) {
          params[DEVICE_ID_HEADER_NAME] = deviceId;
        }
        return params;
      },
    },
  });
}

/**
 * Build the Apollo client. MUST be called once after ensureDeviceId() has
 * resolved (so the device id is cached before the WS link's connectionParams
 * first read it). The _layout provider calls this and wraps the app.
 */
export function buildApolloClient(): ApolloClient<NormalizedCacheObject> {
  const wsLink = buildWebSocketLink();

  const splitLink = wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === "OperationDefinition" && definition.operation === "subscription"
          );
        },
        wsLink,
        ApolloLink.from([errorLink, httpLink]),
      )
    : ApolloLink.from([errorLink, httpLink]);

  client = new ApolloClient({
    link: ApolloLink.from([authLink, splitLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            scopes: { merge(_existing, incoming) { return incoming; } },
            waveforms: { merge(_existing, incoming) { return incoming; } },
          },
        },
        RecordingOutput: {
          keyFields: ["id"],
          fields: {
            samples: { merge: true },
            waveformOverview: { merge: true },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-first" },
      query: { fetchPolicy: "cache-first" },
    },
  });
  return client;
}

export function getApolloClient(): ApolloClient<NormalizedCacheObject> {
  if (!client) {
    throw new Error("Apollo client not built — call buildApolloClient() at app boot.");
  }
  return client;
}

export { ensureDeviceId };
