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

export const CREATE_NAMED_SESSION = gql`
  ${SESSION_FIELDS}
  mutation CreateNamedSession($input: CreateSessionInput!) {
    createNamedSession(input: $input) {
      ...SessionFields
    }
  }
`;

export const GET_OR_CREATE_SESSION = gql`
  ${SESSION_FIELDS}
  mutation GetOrCreateSession {
    getOrCreateSession {
      ...SessionFields
    }
  }
`;

export const END_SESSION = gql`
  ${SESSION_FIELDS}
  mutation EndSession($id: String!) {
    endSession(id: $id) {
      ...SessionFields
    }
  }
`;

export const SESSION_HEARTBEAT = gql`
  mutation SessionHeartbeat($id: String!) {
    sessionHeartbeat(id: $id)
  }
`;

export const DELETE_SESSION = gql`
  mutation DeleteSession($id: String!) {
    deleteSession(id: $id)
  }
`;

export const UPDATE_SESSION = gql`
  ${SESSION_FIELDS}
  mutation UpdateSession($id: String!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      ...SessionFields
    }
  }
`;

export const OPEN_OSCILLOSCOPE = gql`
  mutation OpenOscilloscope($sessionId: String!) {
    openOscilloscope(sessionId: $sessionId) {
      id
      isOscilloscopeOpen
      oscilloscopeDurationMs
    }
  }
`;

export const CLOSE_OSCILLOSCOPE = gql`
  mutation CloseOscilloscope($sessionId: String!) {
    closeOscilloscope(sessionId: $sessionId) {
      id
      isOscilloscopeOpen
      oscilloscopeDurationMs
    }
  }
`;

export const CREATE_SUB_SESSION = gql`
  ${SESSION_FIELDS}
  mutation CreateSubSession($parentId: String!) {
    createSubSession(parentId: $parentId) {
      ...SessionFields
    }
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

export const UPDATE_SESSION_DSP = gql`
  mutation UpdateSessionDsp($id: String!, $input: UpdateSessionDspInput!) {
    updateSessionDsp(id: $id, input: $input) {
      id
      peakAmplitude
      rmsAmplitude
      dcOffset
      dominantFrequency
      frequencyHigh
      frequencyLow
    }
  }
`;
