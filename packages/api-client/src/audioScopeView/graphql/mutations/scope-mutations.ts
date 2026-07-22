import { gql } from "@apollo/client";
import { SCOPE_FIELDS } from "../queries/scope-queries";

export const CREATE_SCOPE = gql`
  ${SCOPE_FIELDS}
  mutation CreateScope($name: String!) {
    createScope(name: $name) {
      ...ScopeFields
    }
  }
`;

export const UPDATE_SCOPE = gql`
  ${SCOPE_FIELDS}
  mutation UpdateScope(
    $id: String!
    $name: String
    $description: String
    $sampleRate: Int
    $bufferSize: Int
    $isActive: Boolean
  ) {
    updateScope(
      id: $id
      name: $name
      description: $description
      sampleRate: $sampleRate
      bufferSize: $bufferSize
      isActive: $isActive
    ) {
      ...ScopeFields
    }
  }
`;

export const DELETE_SCOPE = gql`
  mutation DeleteScope($id: String!) {
    deleteScope(id: $id)
  }
`;

export const CAPTURE_WAVEFORM = gql`
  mutation CaptureWaveform($scopeId: String!, $settings: CaptureSettingsInput) {
    capture(scopeId: $scopeId, settings: $settings) {
      id
      scope_id
      samples
      sample_count
      timestamp
      duration_ms
      peak_amplitude
      rms_amplitude
    }
  }
`;
