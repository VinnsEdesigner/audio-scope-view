/**
 * Transform functions for API Keys
 * Converts between server (snake_case) and domain (camelCase) formats
 * Server returns timestamps as seconds since epoch (from Instant::elapsed().as_secs())
 */

import type {
  ApiKey,
  ApiKeyInfoServer,
  ApiKeyCreatedServer,
  CreatedApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
  ApiKeyVerifyResult,
  ApiKeyVerifyResultServer,
} from "./types";

/**
 * Transform server API key info to domain format
 */
export function transformApiKey(server: ApiKeyInfoServer): ApiKey {
  return {
    id: server.id,
    name: server.name,
    createdAt: parseInt(server.created_at, 10),
    expiresAt: server.expires_at ? parseInt(server.expires_at, 10) : null,
    lastUsedAt: server.last_used_at ? parseInt(server.last_used_at, 10) : null,
    rateLimitPerMinute: server.rate_limit_per_minute,
    isValid: server.is_valid,
  };
}

/**
 * Transform server created API key to domain format (includes full key)
 */
export function transformCreatedApiKey(server: ApiKeyCreatedServer): CreatedApiKey {
  return {
    id: server.id,
    key: server.key,
    name: server.name,
  };
}

/**
 * Transform server verify result to domain format
 */
export function transformApiKeyVerifyResult(server: ApiKeyVerifyResultServer): ApiKeyVerifyResult {
  return {
    valid: server.valid,
    keyId: server.key_id,
    name: server.name,
    rateLimitPerMinute: server.rate_limit_per_minute,
    expiresAt: server.expires_at ? parseInt(server.expires_at, 10) : null,
  };
}

/**
 * Transform domain CreateApiKeyInput to server GraphQL input format
 */
export function transformCreateApiKeyInput(
  input: CreateApiKeyInput,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: input.name,
  };
  
  if (input.expiresInHours !== undefined) {
    result.expires_in_hours = input.expiresInHours;
  }
  
  if (input.rateLimitPerMinute !== undefined) {
    result.rate_limit_per_minute = input.rateLimitPerMinute;
  }

  return result;
}

/**
 * Transform domain UpdateApiKeyInput to server GraphQL input format
 */
export function transformUpdateApiKeyInput(
  input: UpdateApiKeyInput,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (input.name !== undefined) result.name = input.name;
  if (input.rateLimitPerMinute !== undefined) result.rate_limit_per_minute = input.rateLimitPerMinute;
  if (input.expiresInHours !== undefined) result.expires_in_hours = input.expiresInHours;

  return result;
}

/**
 * Convert Unix timestamp to Date
 */
export function timestampToDate(timestamp: number | null): Date | null {
  if (timestamp === null) return null;
  return new Date(timestamp * 1000); // Convert seconds to milliseconds
}

/**
 * Convert Date to Unix timestamp
 */
export function dateToTimestamp(date: Date | null): number | null {
  if (date === null) return null;
  return Math.floor(date.getTime() / 1000); // Convert milliseconds to seconds
}
