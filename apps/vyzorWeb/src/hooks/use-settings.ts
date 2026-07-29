import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import { GET_SETTINGS } from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import { UPDATE_SETTINGS } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { Settings, UpdateSettingsInput } from "@audio-scope-view/api-client/domain/settings";

// Re-export types for use by components
export type { Settings, UpdateSettingsInput } from "@audio-scope-view/api-client/domain/settings";
export function useSettings(sessionId: string | undefined) {
  return useQuery<Settings | undefined>({
    queryKey: ["settings", sessionId],
    queryFn: async () => {
      if (!sessionId) return;
      const result = await graphqlClient.query({
        query: GET_SETTINGS,
        variables: { sessionId },
        fetchPolicy: "cache-first",
      });
      return result.data.settings;
    },
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });
}
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, ...input }: UpdateSettingsInput & { sessionId: string }) => {
      const result = await graphqlClient.mutate({
        mutation: UPDATE_SETTINGS,
        variables: { sessionId, ...input },
      });
      return result.data.updateSettings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings", settings.sessionId], settings);
    },
  });
}
