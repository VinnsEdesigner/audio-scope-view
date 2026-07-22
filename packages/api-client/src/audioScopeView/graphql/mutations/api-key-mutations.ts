import { gql } from "@apollo/client";

/**
 * Mutation: Create a new API key
 * The key is only returned once at creation time - after that it cannot be retrieved
 * 
 * Input: name (required), expires_in_hours (optional), rate_limit_per_minute (optional)
 * Returns: id, key (the actual key - only shown once!), name
 */
export const CREATE_API_KEY = gql`
  mutation CreateApiKey($input: CreateApiKeyInput!) {
    createApiKey(input: $input) {
      id
      key
      name
    }
  }
`;

/**
 * Mutation: Update an API key (name, rate limit, expiry)
 * 
 * Input: name (optional), rate_limit_per_minute (optional), expires_in_hours (optional)
 * Returns: Boolean (success)
 */
export const UPDATE_API_KEY = gql`
  mutation UpdateApiKey($id: String!, $input: UpdateApiKeyInput!) {
    updateApiKey(id: $id, input: $input)
  }
`;

/**
 * Mutation: Delete/Revoke an API key
 * 
 * Returns: Boolean (success)
 */
export const DELETE_API_KEY = gql`
  mutation DeleteApiKey($id: String!) {
    deleteApiKey(id: $id)
  }
`;
