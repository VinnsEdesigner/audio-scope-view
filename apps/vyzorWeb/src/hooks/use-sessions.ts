import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import {
  GET_SESSIONS,
  GET_SESSIONS_BY_ID,
  GET_ACTIVE_SESSIONS,
  GET_SESSION_COUNT,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import {
  START_SESSION,
  END_SESSION,
  DELETE_SESSION,
  CAPTURE_WAVEFORM,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { Session, CaptureSettingsInput } from "@audio-scope-view/api-client/domain/session";

export interface UseSessionsOptions {
  limit?: number;
  offset?: number;
}

export function useSessions(options: UseSessionsOptions = {}) {
  const { limit = 50, offset = 0 } = options;
  return useQuery<Session[]>({
    queryKey: ["sessions", { limit, offset }],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SESSIONS,
        variables: { limit, offset },
        fetchPolicy: "cache-first",
      });
      return result.data.sessions;
    },
    staleTime: 60 * 1000,
  });
}

export function useActiveSessions() {
  return useQuery<Session[]>({
    queryKey: ["sessions", "active"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_ACTIVE_SESSIONS,
        fetchPolicy: "cache-first",
      });
      return result.data.activeSessions;
    },
    staleTime: 30 * 1000,
  });
}

export function useSessionCount() {
  return useQuery<number>({
    queryKey: ["sessions", "count"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SESSION_COUNT,
        fetchPolicy: "cache-first",
      });
      return result.data.sessionCount;
    },
    staleTime: 60 * 1000,
  });
}

export function useSessionDetail(id: string | undefined) {
  return useQuery<Session | undefined>({
    queryKey: ["sessions", id],
    queryFn: async () => {
      if (!id) return;
      const result = await graphqlClient.query({
        query: GET_SESSIONS_BY_ID,
        variables: { id },
        fetchPolicy: "cache-first",
      });
      return result.data.sessions?.[0];
    },
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await graphqlClient.mutate({
        mutation: START_SESSION,
      });
      return result.data.startSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await graphqlClient.mutate({
        mutation: END_SESSION,
        variables: { id },
      });
      return result.data.endSession;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(["session", session.id], session);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await graphqlClient.mutate({
        mutation: DELETE_SESSION,
        variables: { id },
      });
      return id;
    },
    onSuccess: (id) => {
      queryClient.removeQueries({ queryKey: ["session", id] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useCaptureWaveform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      settings,
    }: {
      sessionId: string;
      settings?: CaptureSettingsInput;
    }) => {
      const result = await graphqlClient.mutate({
        mutation: CAPTURE_WAVEFORM,
        variables: { sessionId, settings },
      });
      return result.data.capture;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(["session", session.id], session);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
