/// <reference types="vite/client" />

import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const httpLink = new HttpLink({
  uri:
    globalThis.window === undefined
      ? (process.env.VITE_GRAPHQL_ENDPOINT ?? "/graphql")
      : (import.meta.env.VITE_GRAPHQL_ENDPOINT ?? "/graphql"),
});

export const graphqlClient = new ApolloClient({
  link: httpLink,
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
