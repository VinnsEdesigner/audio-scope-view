import { gql } from "@apollo/client";

export const SETTINGS_FIELDS = gql`
  fragment SettingsFields on SettingsOutput {
    id
    session_id
    time_scale
    voltage_scale
    time_offset
    voltage_offset
    trigger_level
    trigger_mode
    trigger_edge
    show_grid
    show_measurements
    grid_divisions_x
    grid_divisions_y
    input_device
    input_channels
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
