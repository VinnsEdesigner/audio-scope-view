import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import {
  GET_SCOPES,
  GET_SCOPE,
  GET_ACTIVE_SCOPES,
  GET_SCOPE_COUNT,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import {
  CREATE_SCOPE,
  UPDATE_SCOPE,
  DELETE_SCOPE,
  CAPTURE_WAVEFORM,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type {
  Scope,
  CreateScopeInput,
  UpdateScopeInput,
  CaptureSettingsInput,
} from "@audio-scope-view/api-client/domain/scope";
export interface UseScopesOptions {
  limit?: number;
  offset?: number;
}
export function useScopes(options: UseScopesOptions = {}) {
  const { limit = 50, offset = 0 } = options;
  return useQuery<Scope[]>({
    queryKey: ["scopes", { limit, offset }],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SCOPES,
        variables: { limit, offset },
        fetchPolicy: "cache-first",
      });
      return result.data.scopes;
    },
    staleTime: 60 * 1000,
  });
}
export function useActiveScopes() {
  return useQuery<Scope[]>({
    queryKey: ["scopes", "active"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_ACTIVE_SCOPES,
        fetchPolicy: "cache-first",
      });
      return result.data.activeScopes;
    },
    staleTime: 30 * 1000,
  });
}
export function useScopeCount() {
  return useQuery<number>({
    queryKey: ["scopes", "count"],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: GET_SCOPE_COUNT,
        fetchPolicy: "cache-first",
      });
      return result.data.scopeCount;
    },
    staleTime: 60 * 1000,
  });
}
export function useScopeDetail(id: string | undefined) {
  return useQuery<Scope | undefined>({
    queryKey: ["scope", id],
    queryFn: async () => {
      if (!id) return;
      const result = await graphqlClient.query({
        query: GET_SCOPE,
        variables: { id },
        fetchPolicy: "cache-first",
      });
      return result.data.scope;
    },
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}
export function useCreateScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScopeInput) => {
      const result = await graphqlClient.mutate({
        mutation: CREATE_SCOPE,
        variables: { name: input.name },
      });
      return result.data.createScope;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scopes"] });
    },
  });
}
export function useUpdateScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateScopeInput & { id: string }) => {
      const result = await graphqlClient.mutate({
        mutation: UPDATE_SCOPE,
        variables: { id, ...input },
      });
      return result.data.updateScope;
    },
    onSuccess: (scope) => {
      queryClient.setQueryData(["scope", scope.id], scope);
      queryClient.invalidateQueries({ queryKey: ["scopes"] });
    },
  });
}
export function useDeleteScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await graphqlClient.mutate({
        mutation: DELETE_SCOPE,
        variables: { id },
      });
      return id;
    },
    onSuccess: (id) => {
      queryClient.removeQueries({ queryKey: ["scope", id] });
      queryClient.invalidateQueries({ queryKey: ["scopes"] });
    },
  });
}
export function useCaptureWaveform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scopeId,
      settings,
    }: {
      scopeId: string;
      settings?: CaptureSettingsInput;
    }) => {
      const result = await graphqlClient.mutate({
        mutation: CAPTURE_WAVEFORM,
        variables: { scopeId, settings },
      });
      return result.data.capture;
    },
    onSuccess: (scope) => {
      queryClient.setQueryData(["scope", scope.id], scope);
      queryClient.invalidateQueries({ queryKey: ["scopes"] });
    },
  });
}
