/// <reference types="vite/client" />

import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from "@apollo/client";
import { config } from "../../config";

/**
 * Create Authorization header with bootstrap key for authentication
 * The server verifies bootstrap key by hashing it with SHA256 and comparing to stored hash
 * Uses "Bearer <key>" scheme as expected by the server
 */
function createHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.bootstrapKey) {
    headers["Authorization"] = `Bearer ${config.bootstrapKey}`;
  }

  return headers;
}

/**
 * Custom link that adds Authorization header to all requests
 */
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
    },
  }),
});

export { HttpLink } from "@apollo/client";
