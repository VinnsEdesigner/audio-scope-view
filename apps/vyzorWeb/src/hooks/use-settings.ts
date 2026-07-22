import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import { GET_SETTINGS } from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import { UPDATE_SETTINGS } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { Settings, UpdateSettingsInput } from "@audio-scope-view/api-client/domain/settings";
export function useSettings(scopeId: string | undefined) {
  return useQuery<Settings | undefined>({
    queryKey: ["settings", scopeId],
    queryFn: async () => {
      if (!scopeId) return;
      const result = await graphqlClient.query({
        query: GET_SETTINGS,
        variables: { scopeId },
        fetchPolicy: "cache-first",
      });
      return result.data.settings;
    },
    enabled: Boolean(scopeId),
    staleTime: Infinity,
  });
}
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scopeId, ...input }: UpdateSettingsInput & { scopeId: string }) => {
      const result = await graphqlClient.mutate({
        mutation: UPDATE_SETTINGS,
        variables: { scopeId, ...input },
      });
      return result.data.updateSettings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings", settings.scopeId], settings);
    },
  });
}
