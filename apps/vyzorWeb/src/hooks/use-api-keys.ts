import { useQuery, useMutation } from "@apollo/client";
import {
  GET_API_KEYS,
  GET_API_KEY,
  VERIFY_API_KEY,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import {
  CREATE_API_KEY,
  UPDATE_API_KEY,
  DELETE_API_KEY,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { ApolloCache } from "@apollo/client/cache";

// Re-export types for use by components (keeps domain types in one place)
export type {
  ApiKey,
  CreatedApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from "@audio-scope-view/api-client/domain/api-key";

// Helper to get the apiKeys from cache
function getApiKeysFromCache(cache: ApolloCache<unknown>): ApiKey[] | undefined {
  try {
    const data = cache.readQuery<{ apiKeys: ApiKey[] }>({ query: GET_API_KEYS });
    return data?.apiKeys ?? undefined;
  } catch {
    return undefined;
  }
}

// Helper to write apiKeys to cache
function writeApiKeysToCache(cache: ApolloCache<unknown>, apiKeys: ApiKey[]): void {
  cache.writeQuery({
    query: GET_API_KEYS,
    data: { apiKeys },
  });
}

export function useApiKeys() {
  return useQuery(GET_API_KEYS, {
    fetchPolicy: "cache-and-network",
  });
}

export function useApiKey(id: string | undefined) {
  return useQuery(GET_API_KEY, {
    variables: { id },
    skip: !id,
    fetchPolicy: "cache-and-network",
  });
}

export function useVerifyApiKey() {
  return useMutation(VERIFY_API_KEY, {
    onCompleted: () => {
      // No cache update needed for verification
    },
  });
}

export function useCreateApiKey() {
  return useMutation(CREATE_API_KEY, {
    // Immediately update the cache with the new API key
    update: (cache, { data }) => {
      if (!data?.createApiKey) return;

      // Get existing keys from cache
      const existingKeys = getApiKeysFromCache(cache);

      // Create the new API key object from the mutation result
      const newApiKey: ApiKey = {
        id: data.createApiKey.id,
        name: data.createApiKey.name,
        createdAt: Math.floor(Date.now() / 1000), // Server would set this, but approximate for immediate display
        expiresAt: undefined,
        lastUsedAt: undefined,
        rateLimitPerMinute: 60, // Default rate limit
        isValid: true,
      };

      // Prepend the new key to the list
      const updatedKeys = existingKeys === undefined ? [newApiKey] : [newApiKey, ...existingKeys];
      writeApiKeysToCache(cache, updatedKeys);
    },
    // Fallback refetch if cache read fails
    refetchQueries: [{ query: GET_API_KEYS }],
  });
}

export function useUpdateApiKey() {
  return useMutation(UPDATE_API_KEY, {
    // Immediately update the cache with the modified API key
    update: (cache, { data, variables }) => {
      if (!data?.updateApiKey || !variables?.id) return;

      // Get existing keys from cache
      const existingKeys = getApiKeysFromCache(cache);
      if (!existingKeys) return;

      // Find and update the key
      const updatedKeys = existingKeys.map((key) =>
        key.id === variables.id
          ? {
              ...key,
              name: variables.input?.name ?? key.name,
              rateLimitPerMinute: variables.input?.rateLimitPerMinute ?? key.rateLimitPerMinute,
            }
          : key,
      );

      writeApiKeysToCache(cache, updatedKeys);
    },
    // Fallback refetch if cache read fails
    refetchQueries: [{ query: GET_API_KEYS }],
  });
}

export function useDeleteApiKey() {
  return useMutation(DELETE_API_KEY, {
    // Immediately remove the deleted API key from cache
    update: (cache, { data, variables }) => {
      if (!data?.deleteApiKey || !variables?.id) return;

      // Get existing keys from cache
      const existingKeys = getApiKeysFromCache(cache);
      if (!existingKeys) return;

      // Filter out the deleted key
      const updatedKeys = existingKeys.filter((key) => key.id !== variables.id);
      writeApiKeysToCache(cache, updatedKeys);
    },
    // Fallback refetch if cache read fails
    refetchQueries: [{ query: GET_API_KEYS }],
  });
}
