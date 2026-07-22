import type { Scope, ScopeServer, CreateScopeInput, UpdateScopeInput } from "./types";

/**
 * Transform server response (snake_case) to domain type (camelCase)
 */
export function scopeFromRaw(serverScope: ScopeServer): Scope {
	return {
		id: serverScope.id,
		name: serverScope.name,
		description: serverScope.description,
		isActive: serverScope.is_active,
		sampleRate: serverScope.sample_rate,
		bufferSize: serverScope.buffer_size,
		createdAt: new Date(serverScope.created_at),
		updatedAt: new Date(serverScope.updated_at),
	};
}

/**
 * Transform array of server responses to domain types
 */
export function scopesFromRaw(serverScopes: ScopeServer[]): Scope[] {
	return serverScopes.map(scopeFromRaw);
}

/**
 * Transform UI input to server format (camelCase → snake_case)
 */
export function scopeToServerInput(input: CreateScopeInput | UpdateScopeInput): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	if (input.name !== undefined) result.name = input.name;
	if (input.description !== undefined) result.description = input.description;
	if ("sampleRate" in input && input.sampleRate !== undefined) result.sampleRate = input.sampleRate;
	if ("bufferSize" in input && input.bufferSize !== undefined) result.bufferSize = input.bufferSize;
	if ("isActive" in input && input.isActive !== undefined) result.isActive = input.isActive;

	return result;
}
