import { gql } from "@apollo/client";

export const WAVEFORM_FIELDS = gql`
  fragment WaveformFields on WaveformOutput {
    id
    sessionId
    samples
    sampleCount
    timestamp
    durationMs
    peakAmplitude
    rmsAmplitude
  }
`;

export const WAVEFORM_SUMMARY_FIELDS = gql`
  fragment WaveformSummaryFields on WaveformSummary {
    id
    sessionId
    sampleCount
    timestamp
    durationMs
    peakAmplitude
    rmsAmplitude
  }
`;

export const GET_WAVEFORM = gql`
  ${WAVEFORM_FIELDS}
  query GetWaveform($id: String!) {
    waveform(id: $id) {
      ...WaveformFields
    }
  }
`;

export const GET_WAVEFORMS = gql`
  ${WAVEFORM_FIELDS}
  query GetWaveforms($sessionId: String!, $limit: Int, $offset: Int, $includeSamples: Boolean) {
    waveforms(
      sessionId: $sessionId
      limit: $limit
      offset: $offset
      includeSamples: $includeSamples
    ) {
      ...WaveformFields
    }
  }
`;

export const GET_RECENT_WAVEFORMS = gql`
  ${WAVEFORM_SUMMARY_FIELDS}
  query GetRecentWaveforms($sessionId: String!, $limit: Int) {
    recentWaveforms(sessionId: $sessionId, limit: $limit) {
      ...WaveformSummaryFields
    }
  }
`;

export const GET_WAVEFORM_COUNT = gql`
  query GetWaveformCount($sessionId: String!) {
    waveformCount(sessionId: $sessionId)
  }
`;

export const GET_WAVEFORM_STATISTICS = gql`
  query GetWaveformStatistics($sessionId: String!) {
    waveformStatistics(sessionId: $sessionId) {
      totalCount
      totalSamples
      averagePeak
      averageRms
    }
  }
`;
