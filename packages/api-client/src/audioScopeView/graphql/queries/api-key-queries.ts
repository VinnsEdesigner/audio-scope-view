import { gql } from "@apollo/client";

/**
 * Fragment for API key info fields returned by the server
 * Server returns: id, name, created_at, expires_at, last_used_at, rate_limit_per_minute, is_valid
 */
export const API_KEY_INFO_FIELDS = gql`
  fragment ApiKeyInfoFields on ApiKeyInfo {
    id
    name
    createdAt: created_at
    expiresAt: expires_at
    lastUsedAt: last_used_at
    rateLimitPerMinute: rate_limit_per_minute
    isValid: is_valid
  }
`;

/**
 * Fragment for API key creation result (includes the actual key, only shown once!)
 */
export const API_KEY_CREATED_FIELDS = gql`
  fragment ApiKeyCreatedFields on ApiKeyCreated {
    id
    key
    name
  }
`;

/**
 * Fragment for API key verification result
 */
export const API_KEY_VERIFY_RESULT_FIELDS = gql`
  fragment ApiKeyVerifyResultFields on ApiKeyVerifyResult {
    valid
    keyId: key_id
    name
    rateLimitPerMinute: rate_limit_per_minute
    expiresAt: expires_at
  }
`;

/**
 * Query: List all API keys
 */
export const GET_API_KEYS = gql`
  ${API_KEY_INFO_FIELDS}
  query GetApiKeys {
    apiKeys {
      ...ApiKeyInfoFields
    }
  }
`;

/**
 * Query: Get a specific API key by ID
 */
export const GET_API_KEY = gql`
  ${API_KEY_INFO_FIELDS}
  query GetApiKey($id: String!) {
    apiKey(id: $id) {
      ...ApiKeyInfoFields
    }
  }
`;

/**
 * Query: Verify an API key (does NOT mark as used)
 */
export const VERIFY_API_KEY = gql`
  ${API_KEY_VERIFY_RESULT_FIELDS}
  query VerifyApiKey($key: String!) {
    verifyApiKey(key: $key) {
      ...ApiKeyVerifyResultFields
    }
  }
`;
