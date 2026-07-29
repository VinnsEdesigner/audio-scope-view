import { gql } from "@apollo/client";

export const RECORDING_FIELDS = gql`
  fragment RecordingFields on RecordingOutput {
    id
    session_id
    session_name
    name
    samples
    timestamp
    duration_ms
    sample_count
    size_bytes
    peak_amplitude
    rms_amplitude
    is_pinned
    is_recording
  }
`;

export const RECORDING_SUMMARY_FIELDS = gql`
  fragment RecordingSummaryFields on RecordingSummary {
    id
    session_id
    session_name
    name
    timestamp
    duration_ms
    size_bytes
    is_pinned
  }
`;

export const GET_RECORDINGS = gql`
  ${RECORDING_SUMMARY_FIELDS}
  query GetRecordings(
    $timeRange: String
    $sessionId: String
    $limit: Int
    $offset: Int
    $pinnedOnly: Boolean
  ) {
    recordings(
      timeRange: $timeRange
      sessionId: $sessionId
      limit: $limit
      offset: $offset
      pinnedOnly: $pinnedOnly
    ) {
      recordings {
        ...RecordingSummaryFields
      }
      total
      hasMore
    }
  }
`;

export const GET_RECORDINGS_BY_ID = gql`
  ${RECORDING_FIELDS}
  query GetRecordingsById($id: String!) {
    recordings(id: $id) {
      ...RecordingFields
    }
  }
`;

export const GET_RECORDING_STATS = gql`
  query GetRecordingStats($timeRange: String) {
    recordingStats(timeRange: $timeRange) {
      total_recordings
      total_size_bytes
      total_duration_ms
      pinned_count
    }
  }
`;

export const GET_RECENT_RECORDINGS = gql`
  ${RECORDING_SUMMARY_FIELDS}
  query GetRecentRecordings($limit: Int) {
    recentRecordings(limit: $limit) {
      recordings {
        ...RecordingSummaryFields
      }
    }
  }
`;

export const SESSION_WITH_STATUS_FIELDS = gql`
  fragment SessionWithStatusFields on SessionWithStatusOutput {
    id
    started_at
    ended_at
    status
    duration_seconds
    recording_count
  }
`;

export const GET_SESSIONS_WITH_STATUS = gql`
  ${SESSION_WITH_STATUS_FIELDS}
  query GetSessionsWithStatus($limit: Int, $offset: Int) {
    sessionsWithStatus(limit: $limit, offset: $offset) {
      sessions {
        ...SessionWithStatusFields
      }
      total
      hasMore
    }
  }
`;

export const GET_ACTIVE_SESSIONS_WITH_STATUS = gql`
  ${SESSION_WITH_STATUS_FIELDS}
  query GetActiveSessionsWithStatus {
    activeSessionsWithStatus {
      ...SessionWithStatusFields
    }
  }
`;

export const GET_SESSION_STATUS_COUNTS = gql`
  query GetSessionStatusCounts {
    sessionStatusCounts {
      live_count
      paused_count
      offline_count
      total
    }
  }
`;
