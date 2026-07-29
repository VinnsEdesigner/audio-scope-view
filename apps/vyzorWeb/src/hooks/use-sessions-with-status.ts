import { useQuery } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import {
  GET_SESSIONS_WITH_STATUS,
  GET_ACTIVE_SESSIONS_WITH_STATUS,
  GET_SESSION_STATUS_COUNTS,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries/recording-queries";
import {
  transformSessionWithStatus,
  transformSessionListResult,
} from "@audio-scope-view/api-client/domain/recording/transforms";
import type {
  SessionWithStatus,
  SessionListResult,
  SessionWithStatusServer,
} from "@audio-scope-view/api-client/domain/recording";

export interface UseSessionsWithStatusOptions {
  limit?: number;
  offset?: number;
}

export function useSessionsWithStatus(options: UseSessionsWithStatusOptions = {}) {
  const { limit = 50, offset = 0 } = options;

  return useQuery<SessionListResult>({
    queryKey: ["sessionsWithStatus", { limit, offset }],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SESSIONS_WITH_STATUS,
        variables: { limit, offset },
        fetchPolicy: "cache-first",
      });
      return transformSessionListResult(result.data.sessionsWithStatus);
    },
    staleTime: 30 * 1000,
  });
}

export function useActiveSessionsWithStatus() {
  return useQuery<SessionWithStatus[]>({
    queryKey: ["sessionsWithStatus", "active"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_ACTIVE_SESSIONS_WITH_STATUS,
        fetchPolicy: "cache-first",
      });
      return result.data.activeSessionsWithStatus.map((session: SessionWithStatusServer) =>
        transformSessionWithStatus(session),
      );
    },
    staleTime: 15 * 1000,
  });
}

export interface SessionStatusCounts {
  liveCount: number;
  pausedCount: number;
  offlineCount: number;
  total: number;
}

export function useSessionStatusCounts() {
  return useQuery<SessionStatusCounts>({
    queryKey: ["sessionStatusCounts"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SESSION_STATUS_COUNTS,
        fetchPolicy: "cache-first",
      });
      return {
        liveCount: result.data.sessionStatusCounts.live_count,
        pausedCount: result.data.sessionStatusCounts.paused_count,
        offlineCount: result.data.sessionStatusCounts.offline_count,
        total: result.data.sessionStatusCounts.total,
      };
    },
    staleTime: 30 * 1000,
  });
}

export function useHomePageSessions() {
  const { data: activeSessions, ...rest } = useActiveSessionsWithStatus();
  const { data: counts } = useSessionStatusCounts();

  return {
    ...rest,
    sessions: activeSessions ?? [],
    counts: counts ?? { liveCount: 0, pausedCount: 0, offlineCount: 0, total: 0 },
    totalWithStatus: activeSessions?.length ?? 0,
  };
}
