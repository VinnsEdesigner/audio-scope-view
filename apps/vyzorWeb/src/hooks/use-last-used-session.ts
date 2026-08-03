import { useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_SESSIONS,
  GET_ACTIVE_SESSIONS,
  GET_USER_PREFERENCES,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import { SET_LAST_USED_SESSION } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { Session } from "@audio-scope-view/api-client/domain";

export function useLastUsedSession() {
  const {
    data: prefsData,
    loading: isLoadingPrefs,
    refetch: refetchPrefs,
  } = useQuery<{
    userPreferences: {
      id: string;
      lastUsedSessionId: string | null;
      autoSelectLastSession: boolean;
    };
  }>(GET_USER_PREFERENCES, {
    fetchPolicy: "cache-and-network",
  });

  const lastUsedSessionId = prefsData?.userPreferences?.lastUsedSessionId ?? undefined;
  const autoSelectLastSession = prefsData?.userPreferences?.autoSelectLastSession ?? true;

  const [setLastUsedSessionMutation, { loading: isSettingLastUsed }] =
    useMutation(SET_LAST_USED_SESSION);

  const {
    data: lastUsedSessionData,
    loading: isLoadingLastUsed,
    refetch: refetchSessions,
  } = useQuery(GET_SESSIONS, {
    variables: { limit: 100, offset: 0 },
    skip: !lastUsedSessionId,
    fetchPolicy: "cache-and-network",
  });

  const lastUsedSession =
    lastUsedSessionId && lastUsedSessionData?.sessions
      ? (lastUsedSessionData.sessions.find((s: Session) => s.id === lastUsedSessionId) ?? undefined)
      : undefined;

  const { data: activeSessionsData, loading: isLoadingActive } = useQuery(GET_ACTIVE_SESSIONS, {
    fetchPolicy: "cache-and-network",
  });

  const activeSessions = activeSessionsData?.activeSessions ?? [];

  const markSessionAsUsed = useCallback(
    async (sessionId: string) => {
      await setLastUsedSessionMutation({
        variables: { sessionId },
      });
      refetchPrefs();
    },
    [setLastUsedSessionMutation, refetchPrefs],
  );

  const clearLastUsedSession = useCallback(async () => {
    await setLastUsedSessionMutation({
      variables: { sessionId: "" },
    });
    refetchPrefs();
  }, [setLastUsedSessionMutation, refetchPrefs]);

  return {
    lastUsedSessionId,
    lastUsedSession,
    activeSessions,

    shouldAutoSelect: autoSelectLastSession && !!lastUsedSessionId,
    hasLastUsedSession: !!lastUsedSessionId,

    isLoadingPrefs,
    isLoadingLastUsed,
    isLoadingActive,
    isSettingLastUsed,

    markSessionAsUsed,
    clearLastUsedSession,
    refetchSessions,
  };
}

export function useInitialSession() {
  const { lastUsedSession, shouldAutoSelect, isLoadingPrefs, lastUsedSessionId } =
    useLastUsedSession();

  const initialSession = shouldAutoSelect && lastUsedSession ? lastUsedSession : undefined;

  return {
    initialSession,
    initialSessionId: shouldAutoSelect && lastUsedSession ? lastUsedSessionId : undefined,
    shouldShowSelectionDialog: !shouldAutoSelect || !lastUsedSession,
    isLoading: isLoadingPrefs,
  };
}
