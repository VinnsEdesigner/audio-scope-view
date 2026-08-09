import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, split } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { config, getDeviceId, DEVICE_ID_HEADER_NAME } from "../../config";

function createHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.bootstrapKey) {
    headers["Authorization"] = `Bearer ${config.bootstrapKey}`;
  }

  // Attach the per-device identity so the server can scope all data to this
  // device. Generated lazily on first use and persisted in localStorage.
  const deviceId = getDeviceId();
  if (deviceId) {
    headers[DEVICE_ID_HEADER_NAME] = deviceId;
  }

  return headers;
}

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext({
    headers: createHeaders(),
  });
  return forward(operation);
});

// Normalize errors so user-facing messages never leak internal transport
// details (request URLs, fetch stack traces). Network failures are reported as
// a stable "Network error" category; GraphQL errors surface their `message`.
// This addresses the toasts that previously dumped the raw endpoint URL.
const errorLink = new ApolloLink((operation, forward) => {
  return forward(operation).map((response) => {
    if (response.errors && response.errors.length > 0) {
      response.errors = response.errors.map((err) => {
        const message = err.message || "Unknown GraphQL error";
        // Drop any path/URL fragments that some server error extensions carry.
        return {
          ...err,
          message: sanitizeErrorMessage(message),
        };
      });
    }
    return response;
  });
});

/** Remove endpoint URLs and stack-trace noise from an error message. */
export function sanitizeErrorMessage(message: string): string {
  // Strip URLs (http/https/ws) and the common "Network error: Failed to fetch"
  // transport wrapping so the toast shows a stable, actionable string.
  const urlStripped = message.replace(/https?:\/\/[^\s'"]+/gi, "").replace(/wss?:\/\/[^\s'"]+/gi, "");
  const collapsed = urlStripped.replace(/\s+/g, " ").trim();
  if (/Failed to fetch|NetworkError|Load failed/i.test(collapsed)) {
    return "Network error: unable to reach the server. Check your connection and try again.";
  }
  return collapsed || message;
}

const httpLink = new HttpLink({
  uri: config.graphqlEndpoint,
});

// GraphQL subscriptions are routed over a WebSocket link (graphql-transport-ws
// / legacy graphql-ws); queries and mutations use the HTTP link. The static
// server / reverse proxy forwards `/graphql/ws` to the backend's subscription
// endpoint, attaching the same auth + device headers.
function buildWebSocketLink(): ApolloLink | undefined {
  if (typeof window === "undefined") {
    // No WebSocket transport during SSR.
    return undefined;
  }

  const endpoint = resolveSubscriptionEndpoint(config.graphqlSubscriptionEndpoint);
  const deviceId = getDeviceId();

  // Browsers cannot set custom headers on a WebSocket handshake, so the device
  // id is appended as the `X-Device-Id` query parameter (the same name the HTTP
  // handler reads from headers). The reverse proxy injects the Authorization
  // header; `connectionParams` are sent in the `connection_init` payload for
  // transports that read them there too.
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

/** Append the device id as the `X-Device-Id` query param if not already present. */
function appendDeviceIdQuery(endpoint: string, deviceId: string | undefined): string {
  if (!deviceId) {
    return endpoint;
  }
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}X-Device-Id=${encodeURIComponent(deviceId)}`;
}

/** Convert an http(s) relative endpoint to ws(s) for the browser. */
function resolveSubscriptionEndpoint(endpoint: string): string {
  if (typeof window === "undefined") {
    return endpoint;
  }
  if (endpoint.startsWith("ws://") || endpoint.startsWith("wss://")) {
    return endpoint;
  }
  const isSecure = window.location.protocol === "https:";
  const scheme = isSecure ? "wss" : "ws";
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${scheme}://${window.location.host}${path}`;
}

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

export const graphqlClient = new ApolloClient({
  link: ApolloLink.from([authLink, splitLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          scopes: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          waveforms: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
      RecordingOutput: {
        keyFields: ["id"],

        fields: {
          samples: {
            merge: true,
          },
          waveformOverview: {
            merge: true,
          },
        },
      },
    },
  }),

  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-first",
    },
    query: {
      fetchPolicy: "cache-first",
    },
  },
});

export { HttpLink } from "@apollo/client";
