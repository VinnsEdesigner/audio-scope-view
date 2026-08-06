import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useLastUsedSession, useCreateNamedSession, useHomePageSessions } from "../hooks";
import { useToast } from "../hooks";
import { SelectSessionDialog, CreateSessionDialog } from "../components/dialogs";
import type { Session } from "@audio-scope-view/api-client/domain";

export type SessionSelectionState =
  | "idle"
  | "loading"
  | "auto_selecting"
  | "showing_select_dialog"
  | "showing_create_dialog"
  | "navigating_to_scope";

export interface SessionSelectionContextValue {
  state: SessionSelectionState;
  openOscilloscopeSession: () => void;
  selectSessionForRecording: (onSelect: (sessionId: string) => void) => void;
  selectedSessionId: string | undefined;
  isDialogOpen: boolean;
  isCreatingSession: boolean;
  handleSessionSelect: (sessionId: string) => Promise<void>;
  handleSessionCreate: (name: string, description: string) => Promise<void>;
  closeDialogs: () => void;
}

const SessionSelectionContext = React.createContext<SessionSelectionContextValue | undefined>(
  undefined,
);

// Helper to check if a session is active (no endedAt date)
// Note: isLastUsedSessionActive is a more comprehensive check that includes
// whether the session is in the active sessions list
function isSessionActive(session: Session | undefined): boolean {
  return session?.endedAt === undefined;
}

export function useSessionSelection(): SessionSelectionContextValue {
  const context = React.useContext(SessionSelectionContext);
  if (!context) {
    throw new Error("useSessionSelection must be used within SessionSelectionProvider");
  }
  return context;
}

interface SessionSelectionProviderProperties {
  children: React.ReactNode;
}

export function SessionSelectionProvider({
  children,
}: SessionSelectionProviderProperties): React.ReactElement {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { sessions, loading: sessionsLoading } = useHomePageSessions();
  const {
    shouldAutoSelect,
    lastUsedSession,
    markSessionAsUsed,
    isLoadingSession,
    isLastUsedSessionActive,
  } = useLastUsedSession();
  const [createNamedSession, { loading: isCreating }] = useCreateNamedSession();

  const [selectDialogOpen, setSelectDialogOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [cameFromSelectDialog, setCameFromSelectDialog] = React.useState(false);
  const [pendingSessionCallback, setPendingSessionCallback] = React.useState<
    ((sessionId: string) => void) | undefined
  >();
  // Track if we should return to home when dialog is closed (for oscilloscope navigation)
  const [returnToHomeOnClose, setReturnToHomeOnClose] = React.useState(false);

  // Track if we just navigated to scope with a specific sessionId (prevents dialog on mount)
  const [justNavigatedToScope, setJustNavigatedToScope] = React.useState(false);
  const [justNavigatedSessionId, setJustNavigatedSessionId] = React.useState<string | undefined>();

  // Combined loading state - wait for session data before making decisions
  const isLoadingSessionData = sessionsLoading || isLoadingSession;

  // Derive the current state for the state machine
  const currentState: SessionSelectionState = React.useMemo(() => {
    if (isLoadingSessionData) {
      return "loading";
    }
    if (justNavigatedToScope && justNavigatedSessionId) {
      return "navigating_to_scope";
    }
    if (selectDialogOpen) {
      return "showing_select_dialog";
    }
    if (createDialogOpen) {
      return "showing_create_dialog";
    }
    return "idle";
  }, [
    isLoadingSessionData,
    justNavigatedToScope,
    justNavigatedSessionId,
    selectDialogOpen,
    createDialogOpen,
  ]);

  const openOscilloscopeSession = React.useCallback(() => {
    // Clear the just-navigated flag when explicitly opening session selection
    setJustNavigatedToScope(false);
    setJustNavigatedSessionId(undefined);

    // Skip if still loading session data - prevent race condition
    if (isLoadingSessionData) {
      return;
    }

    // Set flag so we return to home if user cancels
    setReturnToHomeOnClose(true);

    // Auto-select is enabled when:
    // 1. User has auto-select enabled (shouldAutoSelect)
    // 2. We have a last used session
    // 3. The session is active (no endedAt AND in active sessions list)
    const canAutoSelect =
      shouldAutoSelect &&
      lastUsedSession &&
      isSessionActive(lastUsedSession) &&
      isLastUsedSessionActive;

    if (canAutoSelect) {
      // Auto-select: proceed directly
      setReturnToHomeOnClose(false);
      navigate(`/oscilloscope?sessionId=${lastUsedSession.id}`);
    } else if (sessions.length > 0) {
      // Show selection dialog
      setSelectDialogOpen(true);
    } else {
      // No sessions: show create dialog
      setCreateDialogOpen(true);
    }
  }, [
    shouldAutoSelect,
    lastUsedSession,
    isLastUsedSessionActive,
    sessions.length,
    navigate,
    isLoadingSessionData,
  ]);

  const selectSessionForRecording = React.useCallback(
    (onSelect: (sessionId: string) => void) => {
      // Clear the just-navigated flag
      setJustNavigatedToScope(false);
      setJustNavigatedSessionId(undefined);

      // Skip if still loading session data - prevent race condition
      if (isLoadingSessionData) {
        return;
      }

      setPendingSessionCallback(() => onSelect);

      // Auto-select is enabled when:
      // 1. User has auto-select enabled (shouldAutoSelect)
      // 2. We have a last used session
      // 3. The session is active (no endedAt AND in active sessions list)
      const canAutoSelect =
        shouldAutoSelect &&
        lastUsedSession &&
        isSessionActive(lastUsedSession) &&
        isLastUsedSessionActive;

      if (canAutoSelect) {
        // Auto-select: call the callback directly
        onSelect(lastUsedSession.id);
      } else if (sessions.length > 0) {
        // Show selection dialog
        setSelectDialogOpen(true);
      } else {
        // No sessions: show create dialog
        setCreateDialogOpen(true);
      }
    },
    [
      shouldAutoSelect,
      lastUsedSession,
      isLastUsedSessionActive,
      sessions.length,
      isLoadingSessionData,
    ],
  );

  const handleSessionSelect = React.useCallback(
    async (sessionId: string) => {
      await markSessionAsUsed(sessionId);
      setSelectDialogOpen(false);
      setReturnToHomeOnClose(false); // Reset flag on success

      // Mark that we're navigating to scope with a specific session
      setJustNavigatedToScope(true);
      setJustNavigatedSessionId(sessionId);

      if (pendingSessionCallback) {
        pendingSessionCallback(sessionId);
        setPendingSessionCallback(undefined);
      } else {
        navigate(`/oscilloscope?sessionId=${sessionId}`);
      }
    },
    [markSessionAsUsed, navigate, pendingSessionCallback],
  );

  const handleSessionCreate = React.useCallback(
    async (name: string, description: string) => {
      try {
        const result = await createNamedSession({ variables: { input: { name, description } } });
        const newSession = result.data?.createNamedSession;
        if (newSession) {
          await markSessionAsUsed(newSession.id);
          setCreateDialogOpen(false);
          setReturnToHomeOnClose(false); // Reset flag on success

          // Mark that we're navigating to scope with this newly created session
          setJustNavigatedToScope(true);
          setJustNavigatedSessionId(newSession.id);

          if (pendingSessionCallback) {
            pendingSessionCallback(newSession.id);
            setPendingSessionCallback(undefined);
            showToast({ message: `Session "${name}" created`, type: "success" });
          } else {
            navigate(`/oscilloscope?sessionId=${newSession.id}`);
            showToast({ message: `Session "${name}" created`, type: "success" });
          }
        }
      } catch (error) {
        showToast({
          message: `Failed to create session: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [createNamedSession, markSessionAsUsed, navigate, showToast, pendingSessionCallback],
  );

  const closeDialogs = React.useCallback(() => {
    setSelectDialogOpen(false);
    setCreateDialogOpen(false);
    setPendingSessionCallback(undefined);
    // Clear the just-navigated flag when closing dialogs
    setJustNavigatedToScope(false);
    setJustNavigatedSessionId(undefined);
    // If we're in oscilloscope session mode (not recording mode), return to home
    if (returnToHomeOnClose) {
      setReturnToHomeOnClose(false);
      navigate("/");
    }
  }, [returnToHomeOnClose, navigate]);

  // Reset just-navigated state when we detect we've left the scope page
  // This is checked by seeing if we're not on a scope URL
  React.useEffect(() => {
    if (!globalThis.location.pathname.includes("/oscilloscope")) {
      setJustNavigatedToScope(false);
      setJustNavigatedSessionId(undefined);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      state: currentState,
      openOscilloscopeSession,
      selectSessionForRecording,
      selectedSessionId: lastUsedSession?.id,
      isDialogOpen: selectDialogOpen || createDialogOpen,
      isCreatingSession: isCreating,
      handleSessionSelect,
      handleSessionCreate,
      closeDialogs,
    }),
    [
      currentState,
      openOscilloscopeSession,
      selectSessionForRecording,
      lastUsedSession,
      selectDialogOpen,
      createDialogOpen,
      isCreating,
      handleSessionSelect,
      handleSessionCreate,
      closeDialogs,
    ],
  );

  return (
    <SessionSelectionContext.Provider value={value}>
      {children}

      {/* Select Session Dialog */}
      <SelectSessionDialog
        isOpen={selectDialogOpen}
        sessions={sessions}
        selectedSessionId={lastUsedSession?.id}
        onClose={() => {
          setSelectDialogOpen(false);
          setPendingSessionCallback(undefined);
        }}
        onSelect={handleSessionSelect}
        onCreateNew={() => {
          setCameFromSelectDialog(true);
          setSelectDialogOpen(false);
          setCreateDialogOpen(true);
        }}
        isLoading={sessionsLoading}
      />

      {/* Create Session Dialog */}
      <CreateSessionDialog
        isOpen={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setPendingSessionCallback(undefined);
          if (cameFromSelectDialog) {
            setSelectDialogOpen(true);
            setCameFromSelectDialog(false);
          }
        }}
        onConfirm={handleSessionCreate}
        isLoading={isCreating}
      />
    </SessionSelectionContext.Provider>
  );
}
