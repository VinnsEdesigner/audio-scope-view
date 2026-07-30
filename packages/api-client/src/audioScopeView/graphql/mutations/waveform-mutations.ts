import { gql } from "@apollo/client";

export const CREATE_WAVEFORM = gql`
  mutation CreateWaveform($input: CreateWaveformInput!) {
    createWaveform(input: $input) {
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
    deleteWaveforms(sessionId: $sessionId)
  }
`;
