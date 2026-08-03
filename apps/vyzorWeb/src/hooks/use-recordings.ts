import { useQuery, useMutation } from "@apollo/client";
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
  START_RECORDING,
  STOP_RECORDING,
  PAUSE_RECORDING,
  RESUME_RECORDING,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations/recording-mutations";
import type { TimeRange, RecordingPreview } from "@audio-scope-view/api-client/domain/recording";
import { transformRecordingPreview } from "@audio-scope-view/api-client/domain/recording";

/** Return type for useRecording hook */
export interface UseRecordingResult {
  data: RecordingPreview | undefined;
  recordingPreview: RecordingPreview | undefined;
  loading: boolean;
  error?: any;
  called: boolean;
  client: any;
  refetch: (variables?: any) => Promise<any>;
  fetchMore: (variables?: any) => Promise<any>;
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

  return useQuery(GET_RECORDINGS, {
    variables: {
      filter,
      limit,
      offset,
    },
    fetchPolicy: "cache-and-network",
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

  // Transform the response to RecordingPreview type
  const recording: RecordingPreview | undefined = queryResult.data?.recordingPreview 
    ? transformRecordingPreview(queryResult.data.recordingPreview)
    : undefined;

  // Return with full query result plus transformed data
  // This maintains backward compatibility
  return {
    ...queryResult,
    data: recording ?? undefined,
    recordingPreview: recording,
  };
}

// Hook for getting full recording with samples (use only when needed for playback)
// This loads all samples at once - use useChunkedPlayback for large recordings
export function useFullRecording(recordingId: string | undefined) {
  return useQuery(GET_RECORDINGS_BY_ID, {
    variables: { id: recordingId },
    skip: !recordingId,
    fetchPolicy: "network-only", // Always fetch from network, never from cache
  });
}

export function useRenameRecording() {
  return useMutation(RENAME_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }],
  });
}

export function usePinRecording() {
  return useMutation(PIN_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }],
  });
}

export function useDeleteRecording() {
  return useMutation(DELETE_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }, { query: GET_RECORDING_STATS }],
  });
}

export function usePinRecordings() {
  return useMutation(PIN_RECORDINGS, {
    refetchQueries: [{ query: GET_RECORDINGS }],
  });
}

export function useDeleteRecordings() {
  return useMutation(DELETE_RECORDINGS, {
    refetchQueries: [{ query: GET_RECORDINGS }, { query: GET_RECORDING_STATS }],
  });
}

export function useStartRecording() {
  return useMutation(START_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }, { query: GET_RECORDING_STATS }],
  });
}

export function useStopRecording() {
  return useMutation(STOP_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }, { query: GET_RECORDING_STATS }],
  });
}

export function usePauseRecording() {
  return useMutation(PAUSE_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }],
  });
}

export function useResumeRecording() {
  return useMutation(RESUME_RECORDING, {
    refetchQueries: [{ query: GET_RECORDINGS }],
  });
}
