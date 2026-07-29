import { gql } from "@apollo/client";
import { RECORDING_FIELDS, RECORDING_SUMMARY_FIELDS } from "../queries/recording-queries";

export const RENAME_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation RenameRecording($id: String!, $name: String!) {
    renameRecording(id: $id, name: $name) {
      ...RecordingFields
    }
  }
`;

export const PIN_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation PinRecording($id: String!, $isPinned: Boolean!) {
    pinRecording(id: $id, isPinned: $isPinned) {
      ...RecordingFields
    }
  }
`;

export const DELETE_RECORDING = gql`
  mutation DeleteRecording($id: String!) {
    deleteRecording(id: $id)
  }
`;

export const START_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation StartRecording($sessionId: String!, $name: String) {
    startRecording(sessionId: $sessionId, name: $name) {
      ...RecordingFields
    }
  }
`;

export const STOP_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation StopRecording($id: String!) {
    stopRecording(id: $id) {
      ...RecordingFields
    }
  }
`;

export const PAUSE_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation PauseRecording($id: String!) {
    pauseRecording(id: $id) {
      ...RecordingFields
    }
  }
`;

export const RESUME_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation ResumeRecording($id: String!) {
    resumeRecording(id: $id) {
      ...RecordingFields
    }
  }
`;

export const DELETE_RECORDINGS = gql`
  mutation DeleteRecordings($ids: [String!]!) {
    deleteRecordings(ids: $ids)
  }
`;

export const PIN_RECORDINGS = gql`
  ${RECORDING_SUMMARY_FIELDS}
  mutation PinRecordings($ids: [String!]!, $isPinned: Boolean!) {
    pinRecordings(ids: $ids, isPinned: $isPinned) {
      recordings {
        ...RecordingSummaryFields
      }
    }
  }
`;
