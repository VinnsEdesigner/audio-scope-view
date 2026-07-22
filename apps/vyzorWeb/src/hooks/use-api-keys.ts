import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
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
import {
  transformApiKey,
  transformCreatedApiKey,
  transformApiKeyVerifyResult,
  transformCreateApiKeyInput,
  transformUpdateApiKeyInput,
} from "@audio-scope-view/api-client/domain/api-key/transforms";
import type {
  ApiKey,
  CreatedApiKey,
  ApiKeyVerifyResult,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from "@audio-scope-view/api-client/domain/api-key";

/**
 * Fetch all API keys
 */
export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ["apiKeys"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_API_KEYS,
        fetchPolicy: "cache-first",
      });
      // Transform snake_case response to camelCase domain types
      return result.data.apiKeys.map(transformApiKey);
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch a single API key by ID
 */
export function useApiKey(id: string | undefined) {
  return useQuery<ApiKey | undefined>({
    queryKey: ["apiKey", id],
    queryFn: async () => {
      if (!id) return undefined;
      const result = await graphqlClient.query({
        query: GET_API_KEY,
        variables: { id },
        fetchPolicy: "cache-first",
      });
      if (!result.data.apiKey) return undefined;
      return transformApiKey(result.data.apiKey);
    },
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

/**
 * Verify an API key (does NOT mark as used)
 */
export function useVerifyApiKey() {
  return useMutation({
    mutationFn: async (key: string): Promise<ApiKeyVerifyResult> => {
      const result = await graphqlClient.query({
        query: VERIFY_API_KEY,
        variables: { key },
        fetchPolicy: "network-only",
      });
      return transformApiKeyVerifyResult(result.data.verifyApiKey);
    },
  });
}

/**
 * Create a new API key
 * Returns the full key only on creation - after that it's not available
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput): Promise<CreatedApiKey> => {
      const graphqlInput = transformCreateApiKeyInput(input);
      const result = await graphqlClient.mutate({
        mutation: CREATE_API_KEY,
        variables: { input: graphqlInput },
      });
      return transformCreatedApiKey(result.data.createApiKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });
}

/**
 * Update an existing API key (name, rate limit, expiry)
 */
export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateApiKeyInput & { id: string }): Promise<boolean> => {
      const graphqlInput = transformUpdateApiKeyInput(input);
      const result = await graphqlClient.mutate({
        mutation: UPDATE_API_KEY,
        variables: { id, input: graphqlInput },
      });
      return result.data.updateApiKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });
}

/**
 * Delete an API key permanently
 */
export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      const result = await graphqlClient.mutate({
        mutation: DELETE_API_KEY,
        variables: { id },
      });
      return result.data.deleteApiKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });
}
