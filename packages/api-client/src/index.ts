/**
 * @vyzoriX/api-client
 *
 * Audio Scope View API Client - A typed GraphQL client for the Audio Scope View application.
 *
 * @example
 * // Import from root for all exports
 * import { graphqlClient, domain } from '@vyzoriX/api-client';
 *
 * @example
 * // Import specific modules
 * import { graphqlClient } from '@vyzoriX/api-client/audioScopeView';
 * import { domain } from '@vyzoriX/api-client/domain';
 */

// Data Layer - GraphQL client, queries, mutations, WebSocket subscriptions
export { graphqlClient, HttpLink } from "./audioScopeView/graphql/client";
export * from "./audioScopeView/graphql";
export * from "./audioScopeView/websocket";

// Domain Layer - Types, transforms, validation
export * from "./domain";
