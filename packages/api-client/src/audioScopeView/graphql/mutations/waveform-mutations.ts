import { gql } from "@apollo/client";

export const CREATE_WAVEFORM = gql`
  mutation CreateWaveform($input: CreateWaveformInput!) {
    createWaveform(input: $input) {
      id
      scope_id
      sample_count
      timestamp
      duration_ms
      peak_amplitude
      rms_amplitude
    }
  }
`;

export const DELETE_WAVEFORMS = gql`
  mutation DeleteWaveforms($scopeId: String!) {
    deleteWaveforms(scopeId: $scopeId)
  }
`;
