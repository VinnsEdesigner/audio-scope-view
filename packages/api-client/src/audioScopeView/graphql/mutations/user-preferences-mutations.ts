import { gql } from "@apollo/client";

export const SET_LAST_USED_SESSION = gql`
  mutation SetLastUsedSession($sessionId: String!) {
    setLastUsedSession(sessionId: $sessionId) {
      id
      lastUsedSessionId
      autoSelectLastSession
    }
  }
`;

export const SET_AUTO_SELECT_LAST_SESSION = gql`
  mutation SetAutoSelectLastSession($autoSelect: Boolean!) {
    setAutoSelectLastSession(autoSelect: $autoSelect) {
      id
      lastUsedSessionId
      autoSelectLastSession
    }
  }
`;

export const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences($lastUsedSessionId: String, $autoSelectLastSession: Boolean) {
    updateUserPreferences(
      lastUsedSessionId: $lastUsedSessionId
      autoSelectLastSession: $autoSelectLastSession
    ) {
      id
      lastUsedSessionId
      autoSelectLastSession
    }
  }
`;
