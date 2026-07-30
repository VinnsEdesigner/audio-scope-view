import { gql } from "@apollo/client";

export const SESSION_FIELDS = gql`
  fragment SessionFields on SessionOutput {
    id
    startedAt
    endedAt
    durationSeconds
    recordingCount
  }
`;

export const GET_SESSIONS = gql`
  ${SESSION_FIELDS}
  query GetSessions($limit: Int, $offset: Int) {
    sessions(limit: $limit, offset: $offset) {
      ...SessionFields
    }
  }
`;

export const GET_SESSIONS_BY_ID = gql`
  ${SESSION_FIELDS}
  query GetSessionsById($id: String!) {
    session(id: $id) {
      ...SessionFields
    }
  }
`;

export const GET_ACTIVE_SESSIONS = gql`
  ${SESSION_FIELDS}
  query GetActiveSessions {
    activeSessions {
      ...SessionFields
    }
  }
`;

export const GET_SESSION_COUNT = gql`
  query GetSessionCount {
    sessionCount
  }
`;
