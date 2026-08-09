import { useQuery, useMutation } from "@apollo/client";
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import {
  GET_RECORDINGS,
  GET_RECORDINGS_BY_ID,
  GET_RECORDING_PREVIEW,
  GET_RECORDING_STATS,
  GET_RECENT_RECORDINGS,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries/recording-queries";
import {
  RENAME_RECORDING,
  PIN_RECORDING,
  DELETE_RECORDING,
  PIN_RECORDINGS,
  DELETE_RECORDINGS,
  CREATE_RECORDING,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations/recording-mutations";
import type { TimeRange, RecordingPreview } from "@audio-scope-view/api-client/domain/recording";
import { transformRecordingPreview } from "@audio-scope-view/api-client/domain/recording";

export type { RecordingSummary } from "@audio-scope-view/api-client/domain/recording";

export interface UseRecordingResult {
  data: RecordingPreview | undefined;
  recordingPreview: RecordingPreview | undefined;
  loading: boolean;
  error?: Error;
  called: boolean;
  client: ApolloClient<NormalizedCacheObject>;

  refetch: <T = RecordingPreview>(
    variables?: Record<string, unknown>,
  ) => Promise<{ data: T | undefined }>;
  fetchMore: (variables?: Record<string, unknown>) => Promise<unknown>;
}

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

  const filter = {
    timeRange: sessionId ? undefined : timeRangeFilter,
    sessionId: sessionId,
    isPinned: pinnedOnly ? true : undefined,
  };

  return useQuery(GET_RECORDINGS, {
    variables: {
      filter,
      limit,
      offset,
    },
    fetchPolicy: "network-only",
  });
}

export function useRecentRecordings(limit = 5) {
  return useQuery(GET_RECENT_RECORDINGS, {
    variables: { limit },
    fetchPolicy: "cache-and-network",
  });
}

export function useRecordingStats(timeRange?: TimeRange) {
  return useQuery(GET_RECORDING_STATS, {
    variables: { timeRange },
    fetchPolicy: "cache-and-network",
  });
}

export function useRecording(recordingId: string | undefined): UseRecordingResult {
  const queryResult = useQuery(GET_RECORDING_PREVIEW, {
    variables: { id: recordingId },
    skip: !recordingId,
    fetchPolicy: "cache-and-network",
  });

  const recording: RecordingPreview | undefined = queryResult.data?.recordingPreview
    ? transformRecordingPreview(queryResult.data.recordingPreview)
    : undefined;

  return {
    data: recording ?? undefined,
    recordingPreview: recording,
    loading: queryResult.loading,
    error: queryResult.error,
    called: queryResult.called,
    client: queryResult.client,
    refetch: queryResult.refetch,
    fetchMore: async (variables?: Record<string, unknown>) => {
      return queryResult.fetchMore({ variables }) as Promise<unknown>;
    },
  };
}

export function useFullRecording(recordingId: string | undefined) {
  return useQuery(GET_RECORDINGS_BY_ID, {
    variables: { id: recordingId },
    skip: !recordingId,
    fetchPolicy: "network-only",
  });
}

// The home recordings list is fed by GET_RECENT_RECORDINGS (via useRecentRecordings),
// so mutations that change recordings must refetch it too — otherwise the list shows
// stale pin/rename/delete state even though the backend already updated.
const RECENT_RECORDINGS_REFETCH = { query: GET_RECENT_RECORDINGS, variables: { limit: 20 } };

export function useRenameRecording() {
  return useMutation(RENAME_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }, RECENT_RECORDINGS_REFETCH],
  });
}

export function usePinRecording() {
  return useMutation(PIN_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }, { query: GET_RECORDING_STATS }, RECENT_RECORDINGS_REFETCH],
  });
}

export function useDeleteRecording() {
  return useMutation(DELETE_RECORDING, {
    refetchQueries: [
      { query: GET_RECORDINGS },
      { query: GET_RECORDING_STATS },
      RECENT_RECORDINGS_REFETCH,
    ],
  });
}

export function usePinRecordings() {
  return useMutation(PIN_RECORDINGS, {
    refetchQueries: [{ query: GET_RECORDINGS }, { query: GET_RECORDING_STATS }, RECENT_RECORDINGS_REFETCH],
  });
}

export function useDeleteRecordings() {
  return useMutation(DELETE_RECORDINGS, {
    refetchQueries: [
      { query: GET_RECORDINGS },
      { query: GET_RECORDING_STATS },
      RECENT_RECORDINGS_REFETCH,
    ],
  });
}

export function useCreateRecording() {
  return useMutation(CREATE_RECORDING, {
    refetchQueries: [
      { query: GET_RECORDINGS },
      { query: GET_RECORDING_STATS },
      RECENT_RECORDINGS_REFETCH,
    ],
  });
}
