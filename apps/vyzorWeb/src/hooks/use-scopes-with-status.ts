import { useQuery } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import {
  GET_SCOPES_WITH_STATUS,
  GET_ACTIVE_SCOPES_WITH_STATUS,
  GET_SCOPE_STATUS_COUNTS,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries/recording-queries";
import {
  transformScopeWithStatus,
  transformScopeListResult,
} from "@audio-scope-view/api-client/domain/recording/transforms";
import type {
  ScopeWithStatus,
  ScopeListResult,
  ScopeWithStatusServer,
} from "@audio-scope-view/api-client/domain/recording";

export interface UseScopesWithStatusOptions {
  limit?: number;
  offset?: number;
}

export function useScopesWithStatus(options: UseScopesWithStatusOptions = {}) {
  const { limit = 50, offset = 0 } = options;

  return useQuery<ScopeListResult>({
    queryKey: ["scopesWithStatus", { limit, offset }],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SCOPES_WITH_STATUS,
        variables: { limit, offset },
        fetchPolicy: "cache-first",
      });
      return transformScopeListResult(result.data.scopesWithStatus);
    },
    staleTime: 30 * 1000,
  });
}

export function useActiveScopesWithStatus() {
  return useQuery<ScopeWithStatus[]>({
    queryKey: ["scopesWithStatus", "active"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_ACTIVE_SCOPES_WITH_STATUS,
        fetchPolicy: "cache-first",
      });
      return result.data.activeScopesWithStatus.map((scope: ScopeWithStatusServer) =>
        transformScopeWithStatus(scope),
      );
    },
    staleTime: 15 * 1000,
  });
}

export interface ScopeStatusCounts {
  liveCount: number;
  pausedCount: number;
  offlineCount: number;
  total: number;
}

export function useScopeStatusCounts() {
  return useQuery<ScopeStatusCounts>({
    queryKey: ["scopeStatusCounts"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SCOPE_STATUS_COUNTS,
        fetchPolicy: "cache-first",
      });
      return {
        liveCount: result.data.scopeStatusCounts.live_count,
        pausedCount: result.data.scopeStatusCounts.paused_count,
        offlineCount: result.data.scopeStatusCounts.offline_count,
        total: result.data.scopeStatusCounts.total,
      };
    },
    staleTime: 30 * 1000,
  });
}

export function useHomePageScopes() {
  const { data: activeScopes, ...rest } = useActiveScopesWithStatus();
  const { data: counts } = useScopeStatusCounts();

  return {
    ...rest,
    scopes: activeScopes ?? [],
    counts: counts ?? { liveCount: 0, pausedCount: 0, offlineCount: 0, total: 0 },
    totalWithStatus: activeScopes?.length ?? 0,
  };
}
