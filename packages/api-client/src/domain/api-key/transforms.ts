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
    createdAt: server.createdAt,
    expiresAt: server.expiresAt ?? undefined,
    lastUsedAt: server.lastUsedAt ?? undefined,
    rateLimitPerMinute: server.rateLimitPerMinute,
    isValid: server.isValid,
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
    keyId: server.keyId ?? undefined,
    name: server.name ?? undefined,
    rateLimitPerMinute: server.rateLimitPerMinute ?? undefined,
    expiresAt: server.expiresAt ?? undefined,
  };
}

export function transformCreateApiKeyInput(input: CreateApiKeyInput): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: input.name,
  };

  if (input.expiresInHours !== undefined) {
    result.expiresInHours = input.expiresInHours;
  }

  if (input.rateLimitPerMinute !== undefined) {
    result.rateLimitPerMinute = input.rateLimitPerMinute;
  }

  return result;
}

export function transformUpdateApiKeyInput(input: UpdateApiKeyInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (input.name !== undefined) result.name = input.name;
  if (input.rateLimitPerMinute !== undefined) result.rateLimitPerMinute = input.rateLimitPerMinute;
  if (input.expiresInHours !== undefined) result.expiresInHours = input.expiresInHours;

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
