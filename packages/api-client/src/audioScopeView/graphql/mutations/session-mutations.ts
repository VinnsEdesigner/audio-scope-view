import { gql } from "@apollo/client";
import { SESSION_FIELDS } from "../queries/session-queries";

export const START_SESSION = gql`
  ${SESSION_FIELDS}
  mutation StartSession {
    createSession {
      ...SessionFields
    }
  }
`;

export const END_SESSION = gql`
  mutation EndSession($id: String!) {
    endSession(id: $id) {
      ...SessionFields
    }
  }
`;

export const SESSION_HEARTBEAT = gql`
  mutation SessionHeartbeat($id: String!) {
    sessionHeartbeat(id: $id) {
      ...SessionFields
    }
  }
`;

export const DELETE_SESSION = gql`
  mutation DeleteSession($id: String!) {
    deleteSession(id: $id)
  }
`;

export const CAPTURE_WAVEFORM = gql`
  mutation CaptureWaveform($sessionId: String!, $settings: CaptureSettingsInput) {
    capture(sessionId: $sessionId, settings: $settings) {
      id
      sessionId
      samples
      sampleCount
      timestamp
      durationMs
      peakAmplitude
      rmsAmplitude
    }
  }
`;
