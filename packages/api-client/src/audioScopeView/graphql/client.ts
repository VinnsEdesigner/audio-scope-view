import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from "@apollo/client";
import { config } from "../../config";

function createHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.bootstrapKey) {
    headers["Authorization"] = `Bearer ${config.bootstrapKey}`;
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
        // Use 'id' as the cache key
        keyFields: ["id"],
        // Don't normalize large arrays - store them as-is
        // This prevents Apollo from breaking large arrays (10MB+) into individual cache entries
        fields: {
          samples: {
            merge: true, // Replace existing samples when new data comes in
          },
          waveformOverview: {
            merge: true,
          },
        },
      },
    },
  }),
  // Don't store large responses in memory cache
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
