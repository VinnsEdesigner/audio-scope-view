import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from "@apollo/client";
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

const httpLink = new HttpLink({
  uri: config.graphqlEndpoint,
});

export const graphqlClient = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
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
