import { useQuery, useMutation } from "@apollo/client";
import { GET_SETTINGS } from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import { UPDATE_SETTINGS } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";

export type { Settings, UpdateSettingsInput } from "@audio-scope-view/api-client/domain/settings";

export function useSettings(sessionId: string | undefined) {
  return useQuery(GET_SETTINGS, {
    variables: { sessionId },
    skip: !sessionId,
    fetchPolicy: "cache-and-network",
  });
}

export function useUpdateSettings() {
  return useMutation(UPDATE_SETTINGS, {
    refetchQueries: [{ query: GET_SETTINGS }],
  });
}
