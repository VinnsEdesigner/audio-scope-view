import { useQuery } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import {
  GET_DASHBOARD_SUMMARY,
  GET_RECENT_SCOPES,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import type { DashboardSummary, RecentScope } from "@audio-scope-view/api-client/domain/dashboard";

export interface UseDashboardSummaryOptions {
  timeRange?: "last_hour" | "last_24_hours" | "last_7_days" | "last_30_days";
}

export function useDashboardSummary(options: UseDashboardSummaryOptions = {}) {
  const { timeRange = "last_24_hours" } = options;

  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary", timeRange],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_DASHBOARD_SUMMARY,
        variables: { timeRange },
        fetchPolicy: "cache-first",
      });
      return result.data.dashboardSummary;
    },
    staleTime: 30 * 1000,
  });
}

export function useRecentScopes(limit = 5) {
  return useQuery<RecentScope[]>({
    queryKey: ["dashboard", "recentScopes", limit],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_RECENT_SCOPES,
        variables: { limit },
        fetchPolicy: "cache-first",
      });
      return result.data.recentScopes;
    },
    staleTime: 30 * 1000,
  });
}
