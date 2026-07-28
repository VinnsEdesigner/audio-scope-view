import { gql } from "@apollo/client";

export const RECORDING_FIELDS = gql`
  fragment RecordingFields on RecordingOutput {
    id
    scope_id
    scope_name
    name
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
    scope_id
    scope_name
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
    $scopeId: String
    $limit: Int
    $offset: Int
    $pinnedOnly: Boolean
  ) {
    recordings(
      timeRange: $timeRange
      scopeId: $scopeId
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

export const GET_RECORDING = gql`
  ${RECORDING_FIELDS}
  query GetRecording($id: String!) {
    recording(id: $id) {
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

export const SCOPE_WITH_STATUS_FIELDS = gql`
  fragment ScopeWithStatusFields on ScopeWithStatusOutput {
    id
    name
    description
    status
    sample_rate
    buffer_size
    created_at
    updated_at
    last_activity_at
    recording_count
  }
`;

export const GET_SCOPES_WITH_STATUS = gql`
  ${SCOPE_WITH_STATUS_FIELDS}
  query GetScopesWithStatus($limit: Int, $offset: Int) {
    scopesWithStatus(limit: $limit, offset: $offset) {
      scopes {
        ...ScopeWithStatusFields
      }
      total
      hasMore
    }
  }
`;

export const GET_ACTIVE_SCOPES_WITH_STATUS = gql`
  ${SCOPE_WITH_STATUS_FIELDS}
  query GetActiveScopesWithStatus {
    activeScopesWithStatus {
      ...ScopeWithStatusFields
    }
  }
`;

export const GET_SCOPE_STATUS_COUNTS = gql`
  query GetScopeStatusCounts {
    scopeStatusCounts {
      live_count
      paused_count
      offline_count
      total
    }
  }
`;
