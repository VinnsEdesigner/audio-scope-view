/**
 * AudioScopeView Data Layer
 *
 * This module provides the data access layer for the AudioScopeView application.
 * It handles all API communication including GraphQL queries/mutations and
 * WebSocket subscriptions for real-time waveform streaming.
 *
 * @example
 * import { graphqlClient } from '@vyzoriX/api-client/audioScopeView';
 * import { GET_SCOPES } from '@vyzoriX/api-client/audioScopeView/graphql';
 */

export { graphqlClient, HttpLink } from "./graphql/client";
export * from "./graphql";
export * from "./websocket";
