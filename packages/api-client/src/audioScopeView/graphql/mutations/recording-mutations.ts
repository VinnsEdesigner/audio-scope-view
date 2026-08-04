import { gql } from "@apollo/client";
import { RECORDING_FIELDS } from "../queries/recording-queries";

export const RENAME_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation RenameRecording($id: String!, $name: String!) {
    rename_recording(id: $id, name: $name) {
      ...RecordingFields
    }
  }
`;

export const PIN_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation PinRecording($id: String!, $isPinned: Boolean!) {
    pin_recording(id: $id, isPinned: $isPinned) {
      ...RecordingFields
    }
  }
`;

export const DELETE_RECORDING = gql`
  mutation DeleteRecording($id: String!) {
    delete_recording(id: $id)
  }
`;

export const START_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation StartRecording($sessionId: String!, $name: String) {
    start_recording(sessionId: $sessionId, name: $name) {
      ...RecordingFields
    }
  }
`;

export const STOP_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation StopRecording($id: String!) {
    stop_recording(id: $id) {
      ...RecordingFields
    }
  }
`;

export const PAUSE_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation PauseRecording($id: String!) {
    pause_recording(id: $id) {
      ...RecordingFields
    }
  }
`;

export const RESUME_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation ResumeRecording($id: String!) {
    resume_recording(id: $id) {
      ...RecordingFields
    }
  }
`;

export const DELETE_RECORDINGS = gql`
  mutation DeleteRecordings($ids: [String!]!) {
    delete_recordings(ids: $ids)
  }
`;

export const PIN_RECORDINGS = gql`
  mutation PinRecordings($ids: [String!]!, $pinned: Boolean!) {
    pin_recordings(ids: $ids, pinned: $pinned)
  }
`;
