

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
