import { gql } from "@apollo/client";

export const RECORDING_FIELDS = gql`
  fragment RecordingFields on RecordingOutput {
    id
    sessionId
    sessionName
    name
    samples
    timestamp
    durationMs
    sampleCount
    sizeBytes
    peakAmplitude
    rmsAmplitude
    peakDb
    rmsDb
    dcOffset
    dominantFrequency
    frequencyHigh
    frequencyLow
    bitDepth
    isPinned
    isRecording
    waveformOverview
  }
`;

export const RECORDING_SUMMARY_FIELDS = gql`
  fragment RecordingSummaryFields on RecordingSummaryOutput {
    id
    sessionId
    sessionName
    name
    sampleRate
    timestamp
    durationMs
    sizeBytes
    peakAmplitude
    rmsAmplitude
    peakDb
    rmsDb
    peakNegativeDb
    dcOffset
    dominantFrequency
    frequencyHigh
    frequencyLow
    bitDepth
    isPinned
  }
`;

export const GET_RECORDINGS = gql`
  ${RECORDING_SUMMARY_FIELDS}
  query GetRecordings($filter: RecordingFilterInput, $limit: Int, $offset: Int) {
    recordings(filter: $filter, limit: $limit, offset: $offset) {
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
    recording(id: $id) {
      ...RecordingFields
    }
  }
`;

export const GET_RECORDING_PREVIEW = gql`
  fragment RecordingPreviewFields on RecordingPreviewOutput {
    id
    sessionId
    sessionName
    name
    timestamp
    durationMs
    sampleCount
    sizeBytes
    peakAmplitude
    rmsAmplitude
    peakDb
    rmsDb
    dcOffset
    dominantFrequency
    frequencyHigh
    frequencyLow
    bitDepth
    isPinned
    isRecording
    waveformOverview
  }
  query GetRecordingPreview($id: String!) {
    recording_preview(id: $id) {
      ...RecordingPreviewFields
    }
  }
`;

export const GET_RECORDING_STATS = gql`
  query GetRecordingStats($sessionId: String, $timeRange: String) {
    recording_stats(sessionId: $sessionId, timeRange: $timeRange) {
      totalRecordings
      totalSizeBytes
      totalDurationMs
      pinnedCount
    }
  }
`;

export const GET_RECENT_RECORDINGS = gql`
  ${RECORDING_SUMMARY_FIELDS}
  query GetRecentRecordings($limit: Int) {
    recent_recordings(limit: $limit) {
      ...RecordingSummaryFields
    }
  }
`;

export const SESSION_WITH_STATUS_FIELDS = gql`
  fragment SessionWithStatusFields on RecordingSessionWithStatusOutput {
    id
    name
    startedAt
    status
    recordingCount
  }
`;

export const GET_SESSIONS_WITH_STATUS = gql`
  ${SESSION_WITH_STATUS_FIELDS}
  query GetSessionsWithStatus($limit: Int, $offset: Int) {
    sessions_with_status(limit: $limit, offset: $offset) {
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
    active_sessions_with_status {
      ...SessionWithStatusFields
    }
  }
`;

export const GET_SESSION_STATUS_COUNTS = gql`
  query GetSessionStatusCounts {
    session_status_counts {
      liveCount
      pausedCount
      offlineCount
      total
    }
  }
`;
