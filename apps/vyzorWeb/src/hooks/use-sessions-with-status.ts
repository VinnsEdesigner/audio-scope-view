import { useQuery } from "@apollo/client";
import {
  GET_SESSIONS_WITH_STATUS,
  GET_ACTIVE_SESSIONS_WITH_STATUS,
  GET_SESSION_STATUS_COUNTS,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries/recording-queries";

export interface UseSessionsWithStatusOptions {
  limit?: number;
  offset?: number;
}

export function useSessionsWithStatus(options: UseSessionsWithStatusOptions = {}) {
  const { limit = 50, offset = 0 } = options;

  return useQuery(GET_SESSIONS_WITH_STATUS, {
    variables: { limit, offset },
    fetchPolicy: "cache-and-network",
  });
}

export function useActiveSessionsWithStatus() {
  return useQuery(GET_ACTIVE_SESSIONS_WITH_STATUS, {
    fetchPolicy: "cache-and-network",
  });
}

export interface SessionStatusCounts {
  liveCount: number;
  pausedCount: number;
  offlineCount: number;
  total: number;
}

export function useSessionStatusCounts() {
  return useQuery(GET_SESSION_STATUS_COUNTS, {
    fetchPolicy: "cache-and-network",
  });
}

export function useHomePageSessions() {
  const { data: activeSessions, ...rest } = useActiveSessionsWithStatus();
  const { data: countsData } = useSessionStatusCounts();

  const sessions = activeSessions?.activeSessionsWithStatus ?? [];
  const counts = countsData?.sessionStatusCounts ?? {
    liveCount: 0,
    pausedCount: 0,
    offlineCount: 0,
    total: 0,
  };

  return {
    ...rest,
    sessions,
    counts,
    totalWithStatus: sessions?.length ?? 0,
  };
}
