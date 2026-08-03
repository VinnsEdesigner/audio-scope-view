import { gql } from "@apollo/client";
import { RECORDING_FIELDS } from "../queries/recording-queries";

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

export const CREATE_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation CreateRecording($input: CreateRecordingInput!) {
    createRecording(input: $input) {
      ...RecordingFields
    }
  }
`;

export interface CreateRecordingInput {
  sessionId: string;
  name: string;
  samples: number[];
  sampleRate: number;
}

export const DELETE_RECORDINGS = gql`
  mutation DeleteRecordings($ids: [String!]!) {
    deleteRecordings(ids: $ids)
  }
`;

export const PIN_RECORDINGS = gql`
  mutation PinRecordings($ids: [String!]!, $pinned: Boolean!) {
    pinRecordings(ids: $ids, pinned: $pinned)
  }
`;
