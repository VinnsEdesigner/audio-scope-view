import { gql } from "@apollo/client";
import { SETTINGS_FIELDS } from "../queries/settings-queries";

export const CREATE_SETTINGS = gql`
  ${SETTINGS_FIELDS}
  mutation CreateSettings($scopeId: String!) {
    createSettings(scopeId: $scopeId) {
      ...SettingsFields
    }
  }
`;

export const UPDATE_SETTINGS = gql`
  ${SETTINGS_FIELDS}
  mutation UpdateSettings(
    $scopeId: String!
    $timeScale: Float
    $voltageScale: Float
    $triggerLevel: Float
    $triggerMode: String
    $triggerEdge: String
    $showGrid: Boolean
    $showMeasurements: Boolean
    $inputDevice: String
  ) {
    updateSettings(
      scopeId: $scopeId
      timeScale: $timeScale
      voltageScale: $voltageScale
      triggerLevel: $triggerLevel
      triggerMode: $triggerMode
      triggerEdge: $triggerEdge
      showGrid: $showGrid
      showMeasurements: $showMeasurements
      inputDevice: $inputDevice
    ) {
      ...SettingsFields
    }
  }
`;

export const DELETE_SETTINGS = gql`
  mutation DeleteSettings($scopeId: String!) {
    deleteSettings(scopeId: $scopeId)
  }
`;
