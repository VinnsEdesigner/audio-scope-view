import { useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_USER_PREFERENCES } from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import {
  SET_AUTO_SELECT_LAST_SESSION,
  SET_AUTO_CLOSE_TIMEOUT,
  UPDATE_USER_PREFERENCES,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";

export interface UserPreferences {
  id: string;
  lastUsedSessionId: string | null;
  autoSelectLastSession: boolean;
  autoCloseTimeoutSecs: number | null;
}

// Default timeout in seconds (12 hours)
export const DEFAULT_AUTO_CLOSE_TIMEOUT_SECS = 43_200;

// Timeout options in seconds with their display labels
export const TIMEOUT_OPTIONS = [
  { value: undefined, label: "No timeout" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 43_200, label: "12 hours" },
  { value: 86_400, label: "24 hours" },
  { value: 259_200, label: "72 hours" },
  { value: 604_800, label: "1 week" },
] as const;

export function useSessionSettings() {
  const { data, loading, error, refetch } = useQuery<{ userPreferences: UserPreferences }>(
    GET_USER_PREFERENCES,
    {
      fetchPolicy: "cache-and-network",
    },
  );

  const [setAutoSelectMutation, { loading: isUpdatingAutoSelect }] = useMutation(
    SET_AUTO_SELECT_LAST_SESSION,
  );

  const [setAutoCloseTimeoutMutation, { loading: isUpdatingTimeout }] =
    useMutation(SET_AUTO_CLOSE_TIMEOUT);

  const [updatePreferencesMutation, { loading: isUpdatingAll }] =
    useMutation(UPDATE_USER_PREFERENCES);

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

  const setAutoCloseTimeout = useCallback(
    async (timeoutSecs: number | null) => {
      await setAutoCloseTimeoutMutation({
        variables: { timeoutSecs },
      });
      refetch();
    },
    [setAutoCloseTimeoutMutation, refetch],
  );

  const updateAllPreferences = useCallback(
    async (autoSelect: boolean, timeoutSecs: number | null) => {
      await updatePreferencesMutation({
        variables: {
          autoSelectLastSession: autoSelect,
          autoCloseTimeoutSecs: timeoutSecs,
        },
      });
      refetch();
    },
    [updatePreferencesMutation, refetch],
  );

  const toggleAutoSelect = useCallback(async () => {
    if (userPreferences) {
      await setAutoSelectLastSession(!userPreferences.autoSelectLastSession);
    }
  }, [userPreferences, setAutoSelectLastSession]);

  return {
    autoSelectLastSession: userPreferences?.autoSelectLastSession ?? true,
    autoCloseTimeoutSecs: userPreferences?.autoCloseTimeoutSecs ?? DEFAULT_AUTO_CLOSE_TIMEOUT_SECS,
    isLoading: loading,
    isUpdating: isUpdatingAutoSelect || isUpdatingTimeout || isUpdatingAll,
    error,
    setAutoSelectLastSession,
    setAutoCloseTimeout,
    updateAllPreferences,
    toggleAutoSelect,
  };
}
