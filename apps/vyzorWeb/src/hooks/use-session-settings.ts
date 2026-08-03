import { useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_USER_PREFERENCES } from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import { SET_AUTO_SELECT_LAST_SESSION } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";

export interface UserPreferences {
  id: string;
  lastUsedSessionId: string | null;
  autoSelectLastSession: boolean;
}

export function useSessionSettings() {
  const { data, loading, error, refetch } = useQuery<{ userPreferences: UserPreferences }>(
    GET_USER_PREFERENCES,
    {
      fetchPolicy: "cache-and-network",
    },
  );

  const [setAutoSelectMutation, { loading: isUpdating }] = useMutation(
    SET_AUTO_SELECT_LAST_SESSION,
  );

  const userPreferences = data?.userPreferences;

  const setAutoSelectLastSession = useCallback(
    async (autoSelect: boolean) => {
      await setAutoSelectMutation({
        variables: { autoSelect },
      });
      refetch();
    },
    [setAutoSelectMutation, refetch],
  );

  const toggleAutoSelect = useCallback(async () => {
    if (userPreferences) {
      await setAutoSelectLastSession(!userPreferences.autoSelectLastSession);
    }
  }, [userPreferences, setAutoSelectLastSession]);

  return {
    autoSelectLastSession: userPreferences?.autoSelectLastSession ?? true,
    isLoading: loading,
    isUpdating,
    error,
    setAutoSelectLastSession,
    toggleAutoSelect,
  };
}
