import { gql } from "@apollo/client";

export const SCOPE_FIELDS = gql`
  fragment ScopeFields on ScopeOutput {
    id
    name
    description
    is_active
    sample_rate
    buffer_size
    created_at
    updated_at
  }
`;

export const GET_SCOPES = gql`
  ${SCOPE_FIELDS}
  query GetScopes($limit: Int, $offset: Int) {
    scopes(limit: $limit, offset: $offset) {
      ...ScopeFields
    }
  }
`;

export const GET_SCOPE = gql`
  ${SCOPE_FIELDS}
  query GetScope($id: String!) {
    scope(id: $id) {
      ...ScopeFields
    }
  }
`;

export const GET_ACTIVE_SCOPES = gql`
  ${SCOPE_FIELDS}
  query GetActiveScopes {
    activeScopes {
      ...ScopeFields
    }
  }
`;

export const GET_SCOPE_COUNT = gql`
  query GetScopeCount {
    scopeCount
  }
`;
