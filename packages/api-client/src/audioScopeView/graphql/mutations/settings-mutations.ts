import { gql } from "@apollo/client";
import { SETTINGS_FIELDS } from "../queries/settings-queries";

export const CREATE_SETTINGS = gql`
  ${SETTINGS_FIELDS}
  mutation CreateSettings($sessionId: String!) {
    createSettings(sessionId: $sessionId) {
      ...SettingsFields
    }
  }
`;

export const UPDATE_SETTINGS = gql`
  ${SETTINGS_FIELDS}
  mutation UpdateSettings(
    $sessionId: String!
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
      sessionId: $sessionId
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
  mutation DeleteSettings($sessionId: String!) {
    deleteSettings(sessionId: $sessionId)
  }
`;
