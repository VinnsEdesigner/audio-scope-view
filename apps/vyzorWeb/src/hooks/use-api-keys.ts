import { useQuery, useMutation } from "@apollo/client";
import type { ApolloCache } from "@apollo/client/cache";
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
import type { ApiKey } from "@audio-scope-view/api-client/domain/api-key";

export type {
  ApiKey,
  CreatedApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from "@audio-scope-view/api-client/domain/api-key";

function getApiKeysFromCache(cache: ApolloCache<unknown>): ApiKey[] | undefined {
  try {
    const data = cache.readQuery<{ apiKeys: ApiKey[] }>({ query: GET_API_KEYS });
    return data?.apiKeys ?? undefined;
  } catch {
    return undefined;
  }
}

function writeApiKeysToCache(cache: ApolloCache<unknown>, apiKeys: ApiKey[]): void {
  const apiKeysWithTypename = apiKeys.map((key) => ({
    __typename: "ApiKeyInfo",
    ...key,
  }));

  cache.writeQuery({
    query: GET_API_KEYS,
    data: { apiKeys: apiKeysWithTypename },
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
    onCompleted: () => {},
  });
}

export function useCreateApiKey() {
  return useMutation(CREATE_API_KEY, {
    update: (cache, { data }) => {
      if (!data?.createApiKey) return;

      const existingKeys = getApiKeysFromCache(cache);

      const newApiKey = {
        __typename: "ApiKeyInfo",
        id: data.createApiKey.id,
        name: data.createApiKey.name,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: undefined,
        lastUsedAt: undefined,
        rateLimitPerMinute: 60,
        isValid: true,
      };

      const updatedKeys = existingKeys === undefined ? [newApiKey] : [newApiKey, ...existingKeys];
      writeApiKeysToCache(cache, updatedKeys);
    },

    refetchQueries: [{ query: GET_API_KEYS }],
  });
}

export function useUpdateApiKey() {
  return useMutation(UPDATE_API_KEY, {
    update: (cache, { data }) => {
      if (!data?.updateApiKey) return;

      const existingKeys = getApiKeysFromCache(cache);
      if (!existingKeys) return;

      const updatedKeys = existingKeys.map((key) =>
        key.id === data.updateApiKey.id
          ? {
              ...key,
              name: data.updateApiKey.name ?? key.name,
              rateLimitPerMinute: data.updateApiKey.rateLimitPerMinute ?? key.rateLimitPerMinute,
            }
          : key,
      );

      writeApiKeysToCache(cache, updatedKeys);
    },

    refetchQueries: [{ query: GET_API_KEYS }],
  });
}

export function useDeleteApiKey() {
  return useMutation(DELETE_API_KEY, {
    update: (cache, { data }) => {
      if (!data?.deleteApiKey) return;

      const existingKeys = getApiKeysFromCache(cache);
      if (!existingKeys) return;

      const updatedKeys = existingKeys.filter((key) => key.id !== data.deleteApiKey.id);
      writeApiKeysToCache(cache, updatedKeys);
    },

    refetchQueries: [{ query: GET_API_KEYS }],
  });
}
