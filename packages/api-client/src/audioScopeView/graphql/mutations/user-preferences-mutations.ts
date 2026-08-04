import { gql } from "@apollo/client";

export const SET_LAST_USED_SESSION = gql`
  mutation SetLastUsedSession($sessionId: String!) {
    setLastUsedSession(sessionId: $sessionId) {
      id
      lastUsedSessionId
      autoSelectLastSession
      autoCloseTimeoutSecs
    }
  }
`;

export const SET_AUTO_SELECT_LAST_SESSION = gql`
  mutation SetAutoSelectLastSession($autoSelect: Boolean!) {
    setAutoSelectLastSession(autoSelect: $autoSelect) {
      id
      lastUsedSessionId
      autoSelectLastSession
      autoCloseTimeoutSecs
    }
  }
`;

export const SET_AUTO_CLOSE_TIMEOUT = gql`
  mutation SetAutoCloseTimeout($timeoutSecs: Int) {
    setAutoCloseTimeout(timeoutSecs: $timeoutSecs) {
      id
      lastUsedSessionId
      autoSelectLastSession
      autoCloseTimeoutSecs
    }
  }
`;

export const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences(
    $lastUsedSessionId: String
    $autoSelectLastSession: Boolean
    $autoCloseTimeoutSecs: Int
  ) {
    updateUserPreferences(
      lastUsedSessionId: $lastUsedSessionId
      autoSelectLastSession: $autoSelectLastSession
      autoCloseTimeoutSecs: $autoCloseTimeoutSecs
    ) {
      id
      lastUsedSessionId
      autoSelectLastSession
      autoCloseTimeoutSecs
    }
  }
`;
