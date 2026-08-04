import { gql } from "@apollo/client";

export const CREATE_WAVEFORM = gql`
  mutation CreateWaveform($input: CreateWaveformInput!) {
    create_waveform(input: $input) {
      id
      sessionId
      sampleCount
      timestamp
      durationMs
      peakAmplitude
      rmsAmplitude
    }
  }
`;

export const DELETE_WAVEFORMS = gql`
  mutation DeleteWaveforms($sessionId: String!) {
    delete_waveforms(sessionId: $sessionId)
  }
`;
