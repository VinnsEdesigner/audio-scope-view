export interface ApiKey {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number | undefined;
  lastUsedAt: number | undefined;
  rateLimitPerMinute: number;
  isValid: boolean;
}

export interface CreatedApiKey {
  id: string;
  key: string;
  name: string;
}

export interface ApiKeyVerifyResult {
  valid: boolean;
  keyId: string | undefined;
  name: string | undefined;
  rateLimitPerMinute: number | undefined;
  expiresAt: number | undefined;
}

export interface CreateApiKeyInput {
  name: string;
  expiresInHours?: number;
  rateLimitPerMinute?: number;
}

export interface UpdateApiKeyInput {
  name?: string;
  rateLimitPerMinute?: number;
  expiresInHours?: number;
}

export interface ApiKeyInfoServer {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
  rateLimitPerMinute: number;
  isValid: boolean;
}

export interface ApiKeyCreatedServer {
  id: string;
  key: string;
  name: string;
}

export interface ApiKeyVerifyResultServer {
  valid: boolean;
  keyId: string | null;
  name: string | null;
  rateLimitPerMinute: number | null;
  expiresAt: number | null;
}
