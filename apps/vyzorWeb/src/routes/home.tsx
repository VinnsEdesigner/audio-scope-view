import * as React from "react";
import {
  Mic,
  Radio,
  Settings as SettingsIcon,
  Pin,
  PinOff,
  MoreVertical,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHeader } from "@/contexts/header-context";
import {
  useRecordingStats,
  useRecentRecordings,
  useHomePageSessions,
  usePinRecording,
  useDeleteRecording,
  useRenameRecording,
  useLastUsedSession,
  useCreateNamedSession,
  useSessionSettings,
  formatBytes,
  formatTimestampRelative,
} from "../hooks";
import type { RecordingSummary, SessionWithStatus } from "../hooks";
import { DialogMicRecording } from "../components/dialogs/dialog-mic-recording";
import {
  SelectSessionDialog,
  CreateSessionDialog,
  SessionSettingsDialog,
} from "../components/dialogs";
import { useToast } from "@/hooks";
import { Skeleton } from "@/components/ui/skeleton";

export function Home(): React.ReactElement {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setContent } = useHeader();

  // UI State
  const [isMicDialogOpen, setIsMicDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"recordings" | "sessions">("recordings");
  const [timeFilter, setTimeFilter] = React.useState<"all" | "today" | "week" | "month">("all");
  const [showAllSessions, setShowAllSessions] = React.useState(false);
  const [openMenuId, setOpenMenuId] = React.useState<string | undefined>();
  const [renamingId, setRenamingId] = React.useState<string | undefined>();
  const [renameValue, setRenameValue] = React.useState("");

  // Session dialog state
  const [selectDialogOpen, setSelectDialogOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | undefined>();
  const [cameFromSelectDialog, setCameFromSelectDialog] = React.useState(false);
  const [pendingDestination, setPendingDestination] = React.useState<
    "record" | "oscilloscope" | undefined
  >();

  // Data hooks
  const { data: stats, loading: statsLoading } = useRecordingStats();
  const { data: recentData, loading: recordingsLoading } = useRecentRecordings(20);
  const { sessions, counts, loading: sessionsLoading } = useHomePageSessions();

  const { shouldAutoSelect, lastUsedSession, markSessionAsUsed, isLoadingSession } =
    useLastUsedSession();
  const [createNamedSession, { loading: isCreating }] = useCreateNamedSession();
  const {
    autoSelectLastSession,
    autoCloseTimeoutSecs,
    updateAllPreferences,
    isLoading: isSettingsLoading,
  } = useSessionSettings();

  // Combined loading state - wait for session data before making decisions
  const isLoadingSessionData = sessionsLoading || isLoadingSession;

  const [pinRecording] = usePinRecording();
  const [deleteRecording] = useDeleteRecording();
  const [renameRecording] = useRenameRecording();

  const filteredRecordings = React.useMemo(() => {
    if (!recentData?.recentRecordings || !Array.isArray(recentData.recentRecordings)) return [];

    const now = new Date();
    return recentData.recentRecordings.filter((rec: RecordingSummary) => {
      const recDate = rec.timestamp instanceof Date ? rec.timestamp : new Date(rec.timestamp);
      switch (timeFilter) {
        case "today": {
          return recDate.toDateString() === now.toDateString();
        }
        case "week": {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return recDate >= weekAgo;
        }
        case "month": {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return recDate >= monthAgo;
        }
        default: {
          return true;
        }
      }
    });
  }, [recentData, timeFilter]);

  const displaySessions = Array.isArray(sessions)
    ? showAllSessions
      ? sessions
      : sessions.slice(0, 3)
    : [];

  // Handler functions (defined before useEffect to avoid reference errors)
  const handleMicClick = React.useCallback(() => {
    // Skip if still loading session data - prevent race condition
    if (isLoadingSessionData) {
      return;
    }

    // Check if auto-select is enabled and we have a last used session
    if (shouldAutoSelect && lastUsedSession) {
      // Auto-select: proceed directly with last used session
      setSelectedSessionId(lastUsedSession.id);
      setIsMicDialogOpen(true);
    } else if (sessions.length > 0) {
      // Sessions exist: show selection dialog
      setSelectedSessionId(undefined);
      setSelectDialogOpen(true);
    } else {
      // No sessions: show create dialog
      setSelectedSessionId(undefined);
      setPendingDestination("record");
      setCreateDialogOpen(true);
    }
  }, [isLoadingSessionData, shouldAutoSelect, lastUsedSession, sessions.length]);

  const handlePin = React.useCallback(
    (id: string, isPinned: boolean) => {
      pinRecording({ variables: { id, isPinned: !isPinned } });
      setOpenMenuId(undefined);
      showToast({
        message: isPinned ? "Removing pin..." : "Pinning recording...",
        type: "info",
      });
    },
    [pinRecording, showToast],
  );

  const handleDelete = React.useCallback(
    (id: string) => {
      if (
        confirm("Are you sure you want to delete this recording? This action cannot be undone.")
      ) {
        deleteRecording({
          variables: { id },
          onCompleted: () => {
            showToast({
              message: "Recording deleted successfully",
              type: "success",
            });
          },
          onError: (error: Error) => {
            showToast({
              message: `Failed to delete recording: ${error.message}`,
              type: "error",
            });
          },
        });
        setOpenMenuId(undefined);
      }
    },
    [deleteRecording, showToast],
  );

  const handleRenameStart = React.useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setOpenMenuId(undefined);
  }, []);

  const handleRenameSubmit = React.useCallback(
    (id: string) => {
      const trimmedName = renameValue.trim();
      if (!trimmedName) {
        showToast({
          message: "Recording name cannot be empty",
          type: "warning",
        });
        setRenamingId(undefined);
        setRenameValue("");
        return;
      }

      renameRecording({
        variables: { id, name: trimmedName },
        onCompleted: () => {
          showToast({
            message: "Recording renamed successfully",
            type: "success",
          });
        },
        onError: (error: Error) => {
          showToast({
            message: `Failed to rename: ${error.message}`,
            type: "error",
          });
        },
      });
      setRenamingId(undefined);
      setRenameValue("");
    },
    [renameRecording, showToast, renameValue],
  );

  const handleRenameCancel = React.useCallback(() => {
    setRenamingId(undefined);
    setRenameValue("");
  }, []);

  const handleSessionSelect = React.useCallback(
    async (sessionId: string) => {
      await markSessionAsUsed(sessionId);
      setSelectedSessionId(sessionId);
      setSelectDialogOpen(false);
      setIsMicDialogOpen(true);
    },
    [markSessionAsUsed],
  );

  const handleCreateSession = React.useCallback(
    async (name: string, description: string) => {
      try {
        const result = await createNamedSession({ variables: { input: { name, description } } });
        const newSession = result.data?.createNamedSession;
        if (newSession) {
          await markSessionAsUsed(newSession.id);
          setSelectedSessionId(newSession.id);
          setCreateDialogOpen(false);

          // Only redirect if we had a pending destination
          if (pendingDestination === "record") {
            setIsMicDialogOpen(true);
          }

          showToast({ message: `Session "${name}" created`, type: "success" });

          // Clear pending destination
          setPendingDestination(undefined);
        }
      } catch (error) {
        showToast({
          message: `Failed to create session: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [createNamedSession, markSessionAsUsed, pendingDestination, showToast],
  );

  const handleSaveSettings = React.useCallback(
    async (autoSelect: boolean, autoCloseTimeoutSecs: number | null) => {
      try {
        await updateAllPreferences(autoSelect, autoCloseTimeoutSecs);
        setSettingsDialogOpen(false);
        setDropdownOpen(false);
      } catch (error) {
        showToast({
          message: `Failed to save settings: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [updateAllPreferences, showToast],
  );

  // Set header content (after all handlers are defined)
  React.useEffect(() => {
    setContent({
      title: "Home",
      actions: (
        <>
          {/* Create Session Button */}
          <button
            onClick={() => {
              setPendingDestination(undefined);
              setCreateDialogOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-yellow-700 hover:bg-yellow-800 border border-yellow-900 rounded-lg transition-colors text-white font-semibold"
            title="Create Session"
          >
            <Plus size={16} />
            <span>Create Session</span>
          </button>

          {/* Session Actions Dropdown */}
          <div className="relative">
            <button
              onClick={(event_) => {
                event_.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
              className="w-10 h-10 flex items-center justify-center bg-bg-elevated hover:bg-bg-hover border border-border-subtle rounded-lg transition-colors"
              title="More Session Options"
            >
              <MoreVertical size={18} className="text-text-secondary" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 py-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg z-50">
                <button
                  onClick={(event_) => {
                    event_.stopPropagation();
                    setSettingsDialogOpen(true);
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover transition-colors"
                >
                  <SettingsIcon size={14} />
                  Session Settings
                </button>
              </div>
            )}
          </div>

          {/* Mic Button */}
          <button
            onClick={handleMicClick}
            className="w-10 h-10 flex items-center justify-center bg-bg-elevated hover:bg-bg-hover border border-border-subtle rounded-lg transition-colors"
            title="Test Microphone"
          >
            <Mic size={18} className="text-text-secondary" />
          </button>

          {/* App Settings Button */}
          <button
            onClick={() => navigate("/settings")}
            className="w-10 h-10 flex items-center justify-center bg-bg-elevated hover:bg-bg-hover border border-border-subtle rounded-lg transition-colors"
            title="Settings"
          >
            <SettingsIcon size={18} className="text-text-secondary" />
          </button>
        </>
      ),
    });
  }, [
    setContent,
    handleMicClick,
    navigate,
    dropdownOpen,
    setCreateDialogOpen,
    setPendingDestination,
    setSettingsDialogOpen,
    setDropdownOpen,
  ]);

  React.useEffect(() => {
    const handleClick = () => {
      setOpenMenuId(undefined);
      setDropdownOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const isLoading = statsLoading || recordingsLoading;

  return (
    <div className="w-full bg-black">
      {}
      <div className="bg-yellow-800 rounded-xl p-4 md:p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl md:text-3xl font-semibold text-foreground">Overview</h2>
            <p className="text-sm md:text-lg text-gray-200 mt-0.5">
              Summary of your recordings, storage usage, and active sessions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isLoading ? (
            <>
              <div className="text-center p-4 bg-yellow-600/50 rounded-lg">
                <Skeleton className="h-8 w-16 mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
              <div className="text-center p-4 bg-yellow-600/50 rounded-lg">
                <Skeleton className="h-8 w-16 mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
              <div className="text-center p-4 bg-yellow-600/50 rounded-lg">
                <Skeleton className="h-8 w-16 mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            </>
          ) : (
            <>
              <div className="text-center p-4 bg-yellow-600/50 rounded-lg">
                <div className="text-2xl md:text-3xl font-bold font-mono text-gray-800">
                  {stats?.recordingStats?.totalRecordings ?? 0}
                </div>
                <div className="text-sm text-gray-800 uppercase tracking-wider mt-1">
                  Recordings
                </div>
              </div>
              <div className="text-center p-4 bg-yellow-600/50 rounded-lg">
                <div className="text-2xl md:text-3xl font-bold font-mono text-gray-800">
                  {formatBytes(stats?.recordingStats?.totalSizeBytes ?? 0)}
                </div>
                <div className="text-sm text-gray-800 uppercase tracking-wider mt-1">Storage</div>
              </div>
              <div className="text-center p-4 bg-yellow-600/50 rounded-lg">
                <div className="text-2xl md:text-3xl font-bold font-mono text-gray-800">
                  {counts.liveCount}
                </div>
                <div className="text-sm text-gray-800 uppercase tracking-wider mt-1">
                  Live Sessions
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {}
      <div className="bg-bg-secondary border border-border-subtle rounded-xl p-4 md:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-xl md:text-3xl font-semibold text-foreground">Sessions</h2>
            <p className="text-sm md:text-lg text-text-tertiary mt-0.5">
              Your active recording sessions and their current state
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" />
              {counts.liveCount} live
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              {counts.offlineCount} offline
            </span>
          </div>
        </div>

        <div className="space-y-2 w-full">
          {displaySessions.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <Radio size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active sessions</p>
            </div>
          ) : (
            displaySessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 p-3 bg-bg-elevated rounded-lg"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    session.status === "live"
                      ? "bg-success"
                      : session.status === "paused"
                        ? "bg-text-primary"
                        : "bg-destructive"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    Session {session.id}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {session.recordingCount} recordings
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {sessions.length > 3 && (
          <button
            onClick={() => setShowAllSessions(!showAllSessions)}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-3 text-sm text-text-secondary hover:text-foreground transition-colors"
          >
            {showAllSessions ? (
              <>
                Show less <ChevronUp size={14} />
              </>
            ) : (
              <>
                View {sessions.length - 3} more sessions <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>

      {}
      <div className="bg-bg-secondary border border-border-subtle rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b border-border-subtle gap-3">
          <div className="flex gap-1 p-1 bg-bg-elevated rounded-lg">
            <button
              onClick={() => setActiveTab("recordings")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                activeTab === "recordings"
                  ? "bg-bg-active text-foreground"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              Recordings
            </button>
            <button
              onClick={() => setActiveTab("sessions")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                activeTab === "sessions"
                  ? "bg-bg-active text-foreground"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              All Sessions
            </button>
          </div>

          {activeTab === "recordings" && (
            <div className="flex gap-2 flex-wrap">
              {(["all", "today", "week", "month"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    timeFilter === filter
                      ? "bg-bg-active text-foreground"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  {filter === "all"
                    ? "All"
                    : filter === "today"
                      ? "Today"
                      : filter === "week"
                        ? "7 days"
                        : "30 days"}
                </button>
              ))}
            </div>
          )}
        </div>

        {}
        <div className="p-4">
          {activeTab === "recordings" ? (
            <div className="space-y-2">
              {recordingsLoading ? (
                <>
                  {[1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-bg-elevated rounded-lg"
                    >
                      <Skeleton className="w-9 h-9 rounded-lg" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="w-8 h-8 rounded-md" />
                    </div>
                  ))}
                </>
              ) : filteredRecordings.length === 0 ? (
                <div className="text-center py-8 text-text-tertiary">
                  <FileAudio size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recordings found</p>
                </div>
              ) : (
                filteredRecordings.map((recording: RecordingSummary) => (
                  <div
                    key={recording.id}
                    className="group flex items-center gap-3 p-3 bg-bg-elevated rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => navigate(`/oscilloscope?recording=${recording.id}`)}
                  >
                    <div className="w-9 h-9 flex items-center justify-center bg-bg-primary rounded-lg">
                      <FileAudio size={16} className="text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {renamingId === recording.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(_event) => setRenameValue(_event.target.value)}
                            onKeyDown={(_event) => {
                              if (_event.key === "Enter") handleRenameSubmit(recording.id);
                              if (_event.key === "Escape") handleRenameCancel();
                            }}
                            onBlur={() => handleRenameSubmit(recording.id)}
                            autoFocus
                            className="flex-1 px-2 py-1 text-sm bg-bg-primary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-foreground truncate">
                              {recording.name}
                            </div>
                            {recording.isPinned && (
                              <Pin size={12} className="text-text-tertiary flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-text-tertiary mt-0.5">
                            {recording.sessionName} • {formatTimestampRelative(recording.timestamp)}{" "}
                            • {formatBytes(recording.sizeBytes)}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={(_event) => {
                          _event.stopPropagation();
                          setOpenMenuId(openMenuId === recording.id ? undefined : recording.id);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-active transition-all"
                      >
                        <MoreVertical size={16} className="text-text-secondary" />
                      </button>
                      {openMenuId === recording.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg z-10">
                          <button
                            onClick={(_event) => {
                              _event.stopPropagation();
                              handlePin(recording.id, recording.isPinned);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover transition-colors"
                          >
                            {recording.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                            {recording.isPinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            onClick={(_event) => {
                              _event.stopPropagation();
                              handleRenameStart(recording.id, recording.name);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover transition-colors"
                          >
                            <Edit3 size={14} />
                            Rename
                          </button>
                          <button
                            onClick={(_event) => {
                              _event.stopPropagation();
                              handleDelete(recording.id);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-bg-hover transition-colors"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {isLoading ? (
                <>
                  {[1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-bg-elevated rounded-lg"
                    >
                      <Skeleton className="w-9 h-9 rounded-lg" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-text-tertiary">
                  <Radio size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active sessions</p>
                </div>
              ) : (
                sessions.map((session: SessionWithStatus) => (
                  <div
                    key={session.id}
                    className="group flex items-center gap-3 p-3 bg-bg-elevated rounded-lg cursor-pointer transition-all hover:bg-bg-hover"
                    onClick={() => navigate(`/session/${session.id}`)}
                  >
                    <div className="w-9 h-9 flex items-center justify-center bg-bg-primary rounded-lg">
                      <Radio size={16} className="text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {session.name || `Session ${session.id.slice(0, 8)}`}
                      </div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {session.recordingCount} recordings • Started{" "}
                        {formatTimestampRelative(session.startedAt)}
                        {session.status === "live" && (
                          <span className="ml-2 px-1.5 py-0.5 bg-text-tertiary/10 text-text-tertiary rounded">
                            live
                          </span>
                        )}
                        {session.status === "paused" && (
                          <span className="ml-2 px-1.5 py-0.5 bg-text-tertiary/10 text-text-tertiary rounded">
                            paused
                          </span>
                        )}
                        {session.status === "offline" && (
                          <span className="ml-2 px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">
                            offline
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <DialogMicRecording
        isOpen={isMicDialogOpen}
        onClose={() => setIsMicDialogOpen(false)}
        sessionId={selectedSessionId}
      />

      {/* Select Session Dialog */}
      <SelectSessionDialog
        isOpen={selectDialogOpen}
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onClose={() => setSelectDialogOpen(false)}
        onSelect={handleSessionSelect}
        onCreateNew={() => {
          setCameFromSelectDialog(true);
          setSelectDialogOpen(false);
          setPendingDestination("record");
          setCreateDialogOpen(true);
        }}
        isLoading={sessionsLoading}
      />

      {/* Create Session Dialog */}
      <CreateSessionDialog
        isOpen={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          if (cameFromSelectDialog) {
            setSelectDialogOpen(true);
            setCameFromSelectDialog(false);
          }
          setPendingDestination(undefined);
        }}
        onConfirm={handleCreateSession}
        isLoading={isCreating}
      />

      {/* Session Settings Dialog */}
      <SessionSettingsDialog
        isOpen={settingsDialogOpen}
        autoSelectLastSession={autoSelectLastSession}
        autoCloseTimeoutSecs={autoCloseTimeoutSecs}
        onClose={() => setSettingsDialogOpen(false)}
        onSave={handleSaveSettings}
        isLoading={isSettingsLoading}
      />
    </div>
  );
}
