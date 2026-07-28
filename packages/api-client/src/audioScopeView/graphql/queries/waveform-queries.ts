import { gql } from "@apollo/client";

export const WAVEFORM_FIELDS = gql`
  fragment WaveformFields on WaveformOutput {
    id
    scope_id
    samples
    sample_count
    timestamp
    duration_ms
    peak_amplitude
    rms_amplitude
  }
`;

export const WAVEFORM_SUMMARY_FIELDS = gql`
  fragment WaveformSummaryFields on WaveformSummary {
    id
    scope_id
    sample_count
    timestamp
    duration_ms
    peak_amplitude
    rms_amplitude
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
  query GetWaveforms($scopeId: String!, $limit: Int, $offset: Int, $includeSamples: Boolean) {
    waveforms(scopeId: $scopeId, limit: $limit, offset: $offset, includeSamples: $includeSamples) {
      ...WaveformFields
    }
  }
`;

export const GET_RECENT_WAVEFORMS = gql`
  ${WAVEFORM_SUMMARY_FIELDS}
  query GetRecentWaveforms($scopeId: String!, $limit: Int) {
    recentWaveforms(scopeId: $scopeId, limit: $limit) {
      ...WaveformSummaryFields
    }
  }
`;

export const GET_WAVEFORM_COUNT = gql`
  query GetWaveformCount($scopeId: String!) {
    waveformCount(scopeId: $scopeId)
  }
`;

export const GET_WAVEFORM_STATISTICS = gql`
  query GetWaveformStatistics($scopeId: String!) {
    waveformStatistics(scopeId: $scopeId) {
      total_count
      total_samples
      average_peak
      average_rms
    }
  }
`;
