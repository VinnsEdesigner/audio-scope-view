import { gql } from "@apollo/client";

export const USER_PREFERENCES_FIELDS = gql`
  fragment UserPreferencesFields on UserPreferencesOutput {
    id
    lastUsedSessionId
    autoSelectLastSession
    autoCloseTimeoutSecs
  }
`;

export const GET_USER_PREFERENCES = gql`
  ${USER_PREFERENCES_FIELDS}
  query GetUserPreferences {
    userPreferences {
      ...UserPreferencesFields
    }
  }
`;

export const GET_LAST_USED_SESSION = gql`
  query GetLastUsedSession {
    lastUsedSession
  }
`;
