import { gql } from "@apollo/client";

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

export const API_KEY_CREATED_FIELDS = gql`
  fragment ApiKeyCreatedFields on ApiKeyCreated {
    id
    key
    name
  }
`;

export const API_KEY_VERIFY_RESULT_FIELDS = gql`
  fragment ApiKeyVerifyResultFields on ApiKeyVerifyResult {
    valid
    keyId: key_id
    name
    rateLimitPerMinute: rate_limit_per_minute
    expiresAt: expires_at
  }
`;

export const GET_API_KEYS = gql`
  ${API_KEY_INFO_FIELDS}
  query GetApiKeys {
    apiKeys {
      ...ApiKeyInfoFields
    }
  }
`;

export const GET_API_KEY = gql`
  ${API_KEY_INFO_FIELDS}
  query GetApiKey($id: String!) {
    apiKey(id: $id) {
      ...ApiKeyInfoFields
    }
  }
`;

export const VERIFY_API_KEY = gql`
  ${API_KEY_VERIFY_RESULT_FIELDS}
  query VerifyApiKey($key: String!) {
    verifyApiKey(key: $key) {
      ...ApiKeyVerifyResultFields
    }
  }
`;
