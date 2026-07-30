import { gql } from "@apollo/client";

export const SETTINGS_FIELDS = gql`
  fragment SettingsFields on SettingsOutput {
    id
    sessionId
    timeScale
    voltageScale
    timeOffset
    voltageOffset
    triggerLevel
    triggerMode
    triggerEdge
    showGrid
    showMeasurements
    gridDivisionsX
    gridDivisionsY
    inputDevice
    inputChannels
  }
`;

export const GET_SETTINGS = gql`
  ${SETTINGS_FIELDS}
  query GetSettings($sessionId: String!) {
    settings(sessionId: $sessionId) {
      ...SettingsFields
    }
  }
`;
