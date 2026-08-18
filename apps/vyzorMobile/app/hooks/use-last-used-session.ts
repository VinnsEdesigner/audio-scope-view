import { useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_SESSIONS,
  GET_USER_PREFERENCES,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import { GET_ACTIVE_SESSIONS_WITH_STATUS } from "@audio-scope-view/api-client/audioScopeView/graphql/queries/recording-queries";
import { SET_LAST_USED_SESSION } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { Session } from "@audio-scope-view/api-client/domain";
import { DEFAULT_AUTO_CLOSE_TIMEOUT_SECS } from "./use-session-settings";

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
      autoCloseTimeoutSecs: number | null;
    };
  }>(GET_USER_PREFERENCES, {
    fetchPolicy: "cache-and-network",
  });

  const lastUsedSessionId = prefsData?.userPreferences?.lastUsedSessionId ?? undefined;
  const autoSelectLastSession = prefsData?.userPreferences?.autoSelectLastSession ?? true;
  const autoCloseTimeoutSecs =
    prefsData?.userPreferences?.autoCloseTimeoutSecs ?? DEFAULT_AUTO_CLOSE_TIMEOUT_SECS;

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

  const { data: activeSessionsData, loading: isLoadingActive } = useQuery(
    GET_ACTIVE_SESSIONS_WITH_STATUS,
    {
      fetchPolicy: "cache-and-network",
    },
  );

  const activeSessions = activeSessionsData?.activeSessionsWithStatus ?? [];

  // Check if the last used session is active
  const isLastUsedSessionActive = lastUsedSessionId
    ? activeSessions.some((s: { id: string }) => s.id === lastUsedSessionId)
    : false;

  const markSessionAsUsed = useCallback(
    async (sessionId: string) => {
      await setLastUsedSessionMutation({
        variables: { sessionId },
      });
      // Refetch both prefs and sessions so lastUsedSession is immediately available
      await Promise.all([refetchPrefs(), refetchSessions()]);
    },
    [setLastUsedSessionMutation, refetchPrefs, refetchSessions],
  );

  const clearLastUsedSession = useCallback(async () => {
    await setLastUsedSessionMutation({
      variables: { sessionId: "" },
    });
    refetchPrefs();
  }, [setLastUsedSessionMutation, refetchPrefs]);

  const isLoading = isLoadingPrefs || isLoadingLastUsed || isLoadingActive;

  return {
    lastUsedSessionId,
    lastUsedSession,
    activeSessions,

    // shouldAutoSelect: auto-select enabled AND we have a last used session
    // The scope-page will handle cases where the session doesn't exist or is inactive
    shouldAutoSelect: autoSelectLastSession && !!lastUsedSessionId,
    hasLastUsedSession: !!lastUsedSessionId,
    isLastUsedSessionActive,
    autoCloseTimeoutSecs,

    isLoadingPrefs,
    isLoadingLastUsed,
    isLoadingActive,
    isLoadingSession: isLoading,
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

// Helper function to check if a session is inactive based on timeout
export function isSessionInactive(
  lastActivityTime: Date | string | undefined,
  timeoutSecs: number | null,
): boolean {
  if (!timeoutSecs || !lastActivityTime) {
    return false; // No timeout set or no activity time
  }

  const lastActivity =
    lastActivityTime instanceof Date ? lastActivityTime : new Date(lastActivityTime);

  const now = new Date();
  const elapsedSeconds = (now.getTime() - lastActivity.getTime()) / 1000;

  return elapsedSeconds > timeoutSecs;
}
