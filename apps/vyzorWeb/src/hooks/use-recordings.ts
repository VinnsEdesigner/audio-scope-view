import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import {
  GET_RECORDINGS,
  GET_RECORDINGS_BY_ID,
  GET_RECORDING_STATS,
  GET_RECENT_RECORDINGS,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries/recording-queries";
import {
  RENAME_RECORDING,
  PIN_RECORDING,
  DELETE_RECORDING,
  PIN_RECORDINGS,
  DELETE_RECORDINGS,
  START_RECORDING,
  STOP_RECORDING,
  PAUSE_RECORDING,
  RESUME_RECORDING,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations/recording-mutations";
import {
  transformRecording,
  transformRecordingSummary,
  transformRecordingListResult,
  transformRecordingStats,
} from "@audio-scope-view/api-client/domain/recording/transforms";
import type {
  Recording,
  RecordingSummary,
  RecordingListResult,
  RecordingStats,
  RecordingSummaryServer,
  TimeRange,
} from "@audio-scope-view/api-client/domain/recording";

export interface UseRecordingsOptions {
  timeRange?: TimeRange;
  sessionId?: string;
  limit?: number;
  offset?: number;
  pinnedOnly?: boolean;
}

export function useRecordings(options: UseRecordingsOptions = {}) {
  const {
    timeRange = "last_24_hours",
    sessionId,
    limit = 20,
    offset = 0,
    pinnedOnly = false,
  } = options;

  return useQuery<RecordingListResult>({
    queryKey: ["recordings", { timeRange, sessionId, limit, offset, pinnedOnly }],
    queryFn: async () => {
      // Map frontend timeRange to backend filter format
      const timeRangeFilter =
        timeRange === "last_hour"
          ? "today"
          : timeRange === "last_24_hours"
            ? "today"
            : timeRange === "last_7_days"
              ? "last_week"
              : timeRange === "last_30_days"
                ? "last_month"
                : undefined;

      // Build filter - undefined fields will be stripped by GraphQL
      const filter = {
        time_range: timeRangeFilter,
        session_id: sessionId,
        is_pinned: pinnedOnly ? true : undefined,
      };

      const result = await graphqlClient.query({
        query: GET_RECORDINGS,
        variables: {
          filter,
          limit,
          offset,
        },
        fetchPolicy: "cache-first",
      });
      return transformRecordingListResult(result.data.recordings);
    },
    staleTime: 30 * 1000,
  });
}

export function useRecentRecordings(limit = 5) {
  return useQuery<RecordingSummary[]>({
    queryKey: ["recordings", "recent", limit],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_RECENT_RECORDINGS,
        variables: { limit },
        fetchPolicy: "cache-first",
      });
      if (!result.data?.recentRecordings) {
        return [];
      }
      return result.data.recentRecordings.map((rec: RecordingSummaryServer) =>
        transformRecordingSummary(rec),
      );
    },
    staleTime: 30 * 1000,
  });
}

export function useRecordingStats(timeRange?: TimeRange) {
  return useQuery<RecordingStats>({
    queryKey: ["recordingStats", timeRange],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_RECORDING_STATS,
        variables: { timeRange },
        fetchPolicy: "cache-first",
      });
      return transformRecordingStats(result.data.recordingStats);
    },
    staleTime: 30 * 1000,
  });
}

export function useRecording(recordingId: string | undefined) {
  return useQuery({
    queryKey: ["recordings", recordingId],
    queryFn: async (): Promise<Recording> => {
      const result = await graphqlClient.query({
        query: GET_RECORDINGS_BY_ID,
        variables: { id: recordingId },
        fetchPolicy: "cache-first",
      });
      return transformRecording(result.data.recordings);
    },
    enabled: !!recordingId,
    staleTime: 30 * 1000,
  });
}

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

export function usePinRecordings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, isPinned }: { ids: string[]; isPinned: boolean }) => {
      const result = await graphqlClient.mutate({
        mutation: PIN_RECORDINGS,
        variables: { ids, pinned: isPinned },
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

export function useStartRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, name }: { sessionId: string; name?: string }) => {
      const result = await graphqlClient.mutate({
        mutation: START_RECORDING,
        variables: { sessionId, name },
      });
      return result.data.startRecording;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordingStats"] });
    },
  });
}

export function useStopRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await graphqlClient.mutate({
        mutation: STOP_RECORDING,
        variables: { id },
      });
      return result.data.stopRecording;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordingStats"] });
    },
  });
}

export function usePauseRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await graphqlClient.mutate({
        mutation: PAUSE_RECORDING,
        variables: { id },
      });
      return result.data.pauseRecording;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}

export function useResumeRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await graphqlClient.mutate({
        mutation: RESUME_RECORDING,
        variables: { id },
      });
      return result.data.resumeRecording;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}
