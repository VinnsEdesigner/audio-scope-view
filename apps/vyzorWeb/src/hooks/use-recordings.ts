/**
 * DRAFT: Recording Hooks for Home Page
 *
 * These hooks cover all recording-related features on the Home page:
 * - Recording list with filters (time range, scope, pinned)
 * - Recording stats (counts, sizes)
 * - Recording mutations (rename, pin, delete)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import {
  GET_RECORDINGS,
  GET_RECORDING_STATS,
  GET_RECENT_RECORDINGS,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries/recording-queries";
import {
  RENAME_RECORDING,
  PIN_RECORDING,
  DELETE_RECORDING,
  PIN_RECORDINGS,
  DELETE_RECORDINGS,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations/recording-mutations";
import type {
  RecordingSummary,
  RecordingListResult,
  RecordingStats,
  TimeRange,
} from "@audio-scope-view/api-client/domain/recording";

// ============================================
// RECORDING LIST HOOKS
// ============================================

export interface UseRecordingsOptions {
  timeRange?: TimeRange;
  scopeId?: string;
  limit?: number;
  offset?: number;
  pinnedOnly?: boolean;
}

export function useRecordings(options: UseRecordingsOptions = {}) {
  const {
    timeRange = "last_24_hours",
    scopeId,
    limit = 20,
    offset = 0,
    pinnedOnly = false,
  } = options;

  return useQuery<RecordingListResult>({
    queryKey: ["recordings", { timeRange, scopeId, limit, offset, pinnedOnly }],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_RECORDINGS,
        variables: { timeRange, scopeId, limit, offset, pinnedOnly },
        fetchPolicy: "cache-first",
      });
      return result.data.recordings;
    },
    staleTime: 30 * 1000,
  });
}

export function useRecentRecordings(limit = 5) {
  return useQuery<{ recordings: RecordingSummary[] }>({
    queryKey: ["recordings", "recent", limit],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_RECENT_RECORDINGS,
        variables: { limit },
        fetchPolicy: "cache-first",
      });
      return result.data.recentRecordings;
    },
    staleTime: 30 * 1000,
  });
}

// ============================================
// RECORDING STATS HOOKS
// ============================================

export function useRecordingStats(timeRange?: TimeRange) {
  return useQuery<RecordingStats>({
    queryKey: ["recordingStats", timeRange],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_RECORDING_STATS,
        variables: { timeRange },
        fetchPolicy: "cache-first",
      });
      return result.data.recordingStats;
    },
    staleTime: 30 * 1000,
  });
}

// ============================================
// RECORDING MUTATION HOOKS
// ============================================

export function useRenameRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const result = await graphqlClient.mutate({
        mutation: RENAME_RECORDING,
        variables: { id, name },
      });
      return result.data.renameRecording;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}

export function usePinRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      const result = await graphqlClient.mutate({
        mutation: PIN_RECORDING,
        variables: { id, isPinned },
      });
      return result.data.pinRecording;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await graphqlClient.mutate({
        mutation: DELETE_RECORDING,
        variables: { id },
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordingStats"] });
    },
  });
}

// ============================================
// BULK MUTATION HOOKS
// ============================================

export function usePinRecordings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, isPinned }: { ids: string[]; isPinned: boolean }) => {
      const result = await graphqlClient.mutate({
        mutation: PIN_RECORDINGS,
        variables: { ids, isPinned },
      });
      return result.data.pinRecordings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}

export function useDeleteRecordings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await graphqlClient.mutate({
        mutation: DELETE_RECORDINGS,
        variables: { ids },
      });
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordingStats"] });
    },
  });
}
