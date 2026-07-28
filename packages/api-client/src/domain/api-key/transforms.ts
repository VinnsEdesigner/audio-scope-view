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

export function transformApiKey(server: ApiKeyInfoServer): ApiKey {
  return {
    id: server.id,
    name: server.name,
    createdAt: Number.parseInt(server.created_at, 10),
    expiresAt: server.expires_at ? Number.parseInt(server.expires_at, 10) : undefined,
    lastUsedAt: server.last_used_at ? Number.parseInt(server.last_used_at, 10) : undefined,
    rateLimitPerMinute: server.rate_limit_per_minute,
    isValid: server.is_valid,
  };
}

export function transformCreatedApiKey(server: ApiKeyCreatedServer): CreatedApiKey {
  return {
    id: server.id,
    key: server.key,
    name: server.name,
  };
}

export function transformApiKeyVerifyResult(server: ApiKeyVerifyResultServer): ApiKeyVerifyResult {
  return {
    valid: server.valid,
    keyId: server.key_id ?? undefined,
    name: server.name ?? undefined,
    rateLimitPerMinute: server.rate_limit_per_minute ?? undefined,
    expiresAt: server.expires_at ? Number.parseInt(server.expires_at, 10) : undefined,
  };
}

export function transformCreateApiKeyInput(input: CreateApiKeyInput): Record<string, unknown> {
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

export function transformUpdateApiKeyInput(input: UpdateApiKeyInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (input.name !== undefined) result.name = input.name;
  if (input.rateLimitPerMinute !== undefined)
    result.rate_limit_per_minute = input.rateLimitPerMinute;
  if (input.expiresInHours !== undefined) result.expires_in_hours = input.expiresInHours;

  return result;
}

export function timestampToDate(timestamp: number | null): Date | undefined {
  if (timestamp === null) return undefined;
  return new Date(timestamp * 1000);
}

export function dateToTimestamp(date: Date | null): number | undefined {
  if (date === null) return undefined;
  return Math.floor(date.getTime() / 1000);
}
