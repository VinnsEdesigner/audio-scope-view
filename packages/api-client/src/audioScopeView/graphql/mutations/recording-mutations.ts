/**
 * DRAFT: Recording GraphQL Mutations
 */

import { gql } from "@apollo/client";
import { RECORDING_FIELDS, RECORDING_SUMMARY_FIELDS } from "../queries/recording-queries";

// ============================================
// RECORDING MUTATIONS
// ============================================

/**
 * Rename a recording
 */
export const RENAME_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation RenameRecording($id: String!, $name: String!) {
    renameRecording(id: $id, name: $name) {
      ...RecordingFields
    }
  }
`;

/**
 * Pin or unpin a recording
 */
export const PIN_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation PinRecording($id: String!, $isPinned: Boolean!) {
    pinRecording(id: $id, isPinned: $isPinned) {
      ...RecordingFields
    }
  }
`;

/**
 * Delete a recording
 */
export const DELETE_RECORDING = gql`
  mutation DeleteRecording($id: String!) {
    deleteRecording(id: $id)
  }
`;

/**
 * Create a new recording (start capture)
 */
export const START_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation StartRecording($scopeId: String!, $name: String) {
    startRecording(scopeId: $scopeId, name: $name) {
      ...RecordingFields
    }
  }
`;

/**
 * Stop an active recording
 */
export const STOP_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation StopRecording($id: String!) {
    stopRecording(id: $id) {
      ...RecordingFields
    }
  }
`;

/**
 * Pause an active recording
 */
export const PAUSE_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation PauseRecording($id: String!) {
    pauseRecording(id: $id) {
      ...RecordingFields
    }
  }
`;

/**
 * Resume a paused recording
 */
export const RESUME_RECORDING = gql`
  ${RECORDING_FIELDS}
  mutation ResumeRecording($id: String!) {
    resumeRecording(id: $id) {
      ...RecordingFields
    }
  }
`;

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Delete multiple recordings
 */
export const DELETE_RECORDINGS = gql`
  mutation DeleteRecordings($ids: [String!]!) {
    deleteRecordings(ids: $ids)
  }
`;

/**
 * Pin or unpin multiple recordings
 */
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
