import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useLastUsedSession, useCreateNamedSession, useHomePageSessions } from "../hooks";
import { useToast } from "../hooks";
import { SelectSessionDialog, CreateSessionDialog } from "../components/dialogs";

export interface SessionSelectionContextValue {
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
  const { shouldAutoSelect, lastUsedSession, markSessionAsUsed, isLoadingSession } =
    useLastUsedSession();
  const [createNamedSession, { loading: isCreating }] = useCreateNamedSession();

  const [selectDialogOpen, setSelectDialogOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [cameFromSelectDialog, setCameFromSelectDialog] = React.useState(false);
  const [pendingSessionCallback, setPendingSessionCallback] = React.useState<
    ((sessionId: string) => void) | undefined
  >();

  // Combined loading state - wait for session data before making decisions
  const isLoadingSessionData = sessionsLoading || isLoadingSession;

  const openOscilloscopeSession = React.useCallback(() => {
    // Skip if still loading session data - prevent race condition
    if (isLoadingSessionData) {
      return;
    }

    if (shouldAutoSelect && lastUsedSession) {
      // Auto-select: proceed directly
      navigate(`/oscilloscope?sessionId=${lastUsedSession.id}`);
    } else if (sessions.length > 0) {
      // Show selection dialog
      setSelectDialogOpen(true);
    } else {
      // No sessions: show create dialog
      setCreateDialogOpen(true);
    }
  }, [shouldAutoSelect, lastUsedSession, sessions.length, navigate, isLoadingSessionData]);

  const selectSessionForRecording = React.useCallback(
    (onSelect: (sessionId: string) => void) => {
      // Skip if still loading session data - prevent race condition
      if (isLoadingSessionData) {
        return;
      }

      setPendingSessionCallback(() => onSelect);

      if (shouldAutoSelect && lastUsedSession) {
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
    [shouldAutoSelect, lastUsedSession, sessions.length, isLoadingSessionData],
  );

  const handleSessionSelect = React.useCallback(
    async (sessionId: string) => {
      await markSessionAsUsed(sessionId);
      setSelectDialogOpen(false);
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
  }, []);

  const value = React.useMemo(
    () => ({
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
