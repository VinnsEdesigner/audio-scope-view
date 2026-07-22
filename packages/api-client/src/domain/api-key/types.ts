/**
 * Domain types for API Keys
 * These types match the server's GraphQL schema
 * Server returns: ApiKeyInfo, ApiKeyCreated, ApiKeyVerifyResult
 */

/**
 * API Key info - represents a client's API key (without the actual key value)
 */
export interface ApiKey {
  id: string;
  name: string;
  createdAt: number; // Unix timestamp (seconds since epoch)
  expiresAt: number | null; // Unix timestamp or null if never expires
  lastUsedAt: number | null; // Unix timestamp or null if never used
  rateLimitPerMinute: number;
  isValid: boolean;
}

/**
 * API Key creation result - includes the actual key (only shown once!)
 */
export interface CreatedApiKey {
  id: string;
  key: string; // The complete API key - ONLY available at creation time!
  name: string;
}

/**
 * API Key verification result
 */
export interface ApiKeyVerifyResult {
  valid: boolean;
  keyId: string | null;
  name: string | null;
  rateLimitPerMinute: number | null;
  expiresAt: number | null;
}

/**
 * Input for creating a new API key
 * Matches server's CreateApiKeyInput
 */
export interface CreateApiKeyInput {
  name: string;
  expiresInHours?: number;
  rateLimitPerMinute?: number;
}

/**
 * Input for updating an existing API key
 * Matches server's UpdateApiKeyInput
 */
export interface UpdateApiKeyInput {
  name?: string;
  rateLimitPerMinute?: number;
  expiresInHours?: number;
}

/**
 * Server response types (snake_case from GraphQL)
 */
export interface ApiKeyInfoServer {
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  rate_limit_per_minute: number;
  is_valid: boolean;
}

export interface ApiKeyCreatedServer {
  id: string;
  key: string;
  name: string;
}

export interface ApiKeyVerifyResultServer {
  valid: boolean;
  key_id: string | null;
  name: string | null;
  rate_limit_per_minute: number | null;
  expires_at: string | null;
}
