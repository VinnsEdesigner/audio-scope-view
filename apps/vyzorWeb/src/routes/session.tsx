import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Radio,
  FileAudio,
  Activity,
  Edit3,
  Trash2,
  Eye,
  Database,
  Download,
  FileText,
  Activity as FrequencyIcon,
  Gauge,
  MoreVertical,
  FileSpreadsheet,
} from "lucide-react";
import {
  useSessionDetail,
  useSubSessions,
  useParentSession,
  useRecordings,
  useDeleteSession,
  useDeleteRecording,
  useEndSession,
  useUpdateSession,
  useLastUsedSession,
  formatBytes,
  formatDuration,
  formatTimestampRelative,
  formatSampleRate,
  formatFrequency,
  formatSampleCount,
  formatBitDepth,
  formatDCOffset,
  formatDecibel,
  formatSessionDate,
  formatSessionTime,
} from "../hooks";
import type { SessionWithStatus, RecordingSummary, Session } from "../hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast, useRecordingExport } from "@/hooks";
import { EditSessionDialog } from "@/components/dialogs";

type TabType = "live-captures" | "recordings";

interface LiveCaptureCardProperties {
  subSession: SessionWithStatus;
  onSelect: (sessionId: string) => void;
}

function LiveCaptureCard({ subSession, onSelect }: LiveCaptureCardProperties) {
  return (
    <div
      className="bg-bg-secondary rounded-[10px] p-3 cursor-pointer transition-all hover:bg-bg-tertiary"
      onClick={() => onSelect(subSession.id)}
    >
      <div className="flex items-baseline justify-between mb-3 pb-2.5 border-b border-border-subtle">
        <span className="text-sm font-semibold text-foreground font-mono">
          {subSession.name || `Session ${subSession.id.slice(0, 8)}`}
        </span>
        <span className="text-xs text-text-secondary font-mono">
          {formatTimestampRelative(subSession.startedAt)}
        </span>
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">Status</span>
          <span className="text-xs font-semibold text-foreground">{subSession.status}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">Recordings</span>
          <span className="text-xs font-semibold text-foreground">{subSession.recordingCount}</span>
        </div>
        {subSession.durationSeconds !== undefined && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-text-tertiary uppercase tracking-wide">Duration</span>
            <span className="text-xs font-semibold text-foreground font-mono">
              {formatDuration(subSession.durationSeconds)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface RecordingCardProperties {
  recording: RecordingSummary;
  onView: (recording: RecordingSummary) => void;
  onDelete: (recording: RecordingSummary) => void;
  onDownloadCsv: (recording: RecordingSummary) => void;
  onDownloadWav: (recording: RecordingSummary) => void;
  onDownloadJson: (recording: RecordingSummary) => void;
}

function RecordingCard({
  recording,
  onView,
  onDelete,
  onDownloadCsv,
  onDownloadWav,
  onDownloadJson,
}: RecordingCardProperties) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuReference = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuReference.current && !menuReference.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div className="bg-bg-secondary rounded-[10px] p-4 transition-all hover:bg-bg-tertiary">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground truncate flex-1 mr-2">
          {recording.name}
        </span>
        <div className="relative" ref={menuReference}>
          <button
            onClick={(event_) => {
              event_.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-hover transition-all"
            title="More options"
          >
            <MoreVertical size={16} className="text-icon" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-bg-secondary border border-border rounded-lg shadow-lg z-10 overflow-hidden">
              <button
                onClick={(event_) => {
                  event_.stopPropagation();
                  onView(recording);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground transition-all"
              >
                <Eye size={14} className="text-icon" />
                View
              </button>
              <div className="border-t border-border-subtle" />
              <button
                onClick={(event_) => {
                  event_.stopPropagation();
                  onDownloadCsv(recording);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground transition-all"
              >
                <FileSpreadsheet size={14} className="text-icon" />
                CSV
              </button>
              <button
                onClick={(event_) => {
                  event_.stopPropagation();
                  onDownloadWav(recording);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground transition-all"
              >
                <Download size={14} className="text-icon" />
                WAV
              </button>
              <button
                onClick={(event_) => {
                  event_.stopPropagation();
                  onDownloadJson(recording);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground transition-all"
              >
                <FileText size={14} className="text-icon" />
                JSON
              </button>
              <div className="border-t border-border-subtle" />
              <button
                onClick={(event_) => {
                  event_.stopPropagation();
                  onDelete(recording);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <Trash2 size={14} className="text-destructive" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {}
      <div className="grid grid-cols-4 gap-2 mb-3 p-3 bg-bg-tertiary rounded-lg">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">Peak +</span>
          <span className="text-sm font-semibold text-foreground font-mono">
            {formatDecibel(recording.peakDb ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">Peak -</span>
          <span className="text-sm font-semibold text-foreground font-mono">
            {formatDecibel(recording.peakNegativeDb ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">RMS</span>
          <span className="text-sm font-semibold text-foreground font-mono">
            {formatDecibel(recording.rmsDb ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">DC Offset</span>
          <span className="text-sm font-semibold text-foreground font-mono">
            {formatDCOffset(recording.dcOffset ?? 0)}
          </span>
        </div>
      </div>

      {}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <Clock size={10} className="text-icon" />
            Duration
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatDuration((recording.durationMs ?? 0) / 1000)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <FileAudio size={10} className="text-icon" />
            Sample Rate
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatSampleRate(recording.sampleRate ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <FileText size={10} className="text-icon" />
            Samples
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatSampleCount(recording.sampleCount ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <Download size={10} className="text-icon" />
            Size
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatBytes(recording.sizeBytes ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <FrequencyIcon size={10} className="text-icon" />
            Dominant
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatFrequency(recording.dominantFrequency ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <Activity size={10} className="text-icon" />
            High Freq
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatFrequency(recording.frequencyHigh ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <Activity size={10} className="text-icon" />
            Low Freq
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatFrequency(recording.frequencyLow ?? 0)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide flex items-center gap-1">
            <Gauge size={10} className="text-icon" />
            Bit Depth
          </span>
          <span className="text-xs font-mono text-foreground">
            {formatBitDepth(recording.bitDepth ?? 0)}
          </span>
        </div>
      </div>

      <div className="flex items-center pt-3 border-t border-border-subtle">
        <span className="text-xs text-text-secondary">
          {recording.isPinned && <span className="mr-2">🔒</span>}
          {formatTimestampRelative(recording.timestamp)}
        </span>
      </div>
    </div>
  );
}

export function Session(): React.ReactElement {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { exportRecording } = useRecordingExport();

  const [activeTab, setActiveTab] = React.useState<TabType>("recordings");
  const [recordingsOffset, setRecordingsOffset] = React.useState(0);
  const [recordingsLimit] = React.useState(10);
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);

  const {
    data: sessionData,
    loading: sessionLoading,
    refetch: refetchSession,
  } = useSessionDetail(sessionId);
  const { data: parentSessionData } = useParentSession(sessionId);
  const {
    data: subSessionsData,
    loading: subSessionsLoading,
    refetch: refetchSubSessions,
  } = useSubSessions(sessionId, {
    limit: 50,
  });
  const {
    data: recordingsData,
    loading: recordingsLoading,
    refetch: refetchRecordings,
  } = useRecordings({
    sessionId,
    limit: recordingsLimit,
    offset: recordingsOffset,
  });

  const [deleteSession, { loading: isDeleting }] = useDeleteSession();
  const [endSession, { loading: isEnding }] = useEndSession();
  const [updateSession, { loading: isUpdating }] = useUpdateSession();
  const [deleteRecording] = useDeleteRecording();
  const { markSessionAsUsed } = useLastUsedSession();

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const editButtonReference = React.useRef<HTMLButtonElement>(null);

  const session = sessionData?.session;
  const parentSession = parentSessionData?.parentSession;
  const subSessions = subSessionsData?.subSessions || [];
  const recordings = React.useMemo(
    () => recordingsData?.recordings?.recordings || [],
    [recordingsData?.recordings?.recordings],
  );
  const recordingsTotal = recordingsData?.recordings?.total || 0;

  const totalDurationMs = React.useMemo(() => {
    return recordings.reduce((sum: number, r: RecordingSummary) => sum + (r.durationMs || 0), 0);
  }, [recordings]);

  const totalStorageBytes = React.useMemo(() => {
    return recordings.reduce((sum: number, r: RecordingSummary) => sum + (r.sizeBytes || 0), 0);
  }, [recordings]);

  React.useEffect(() => {
    if (session) {
      markSessionAsUsed(session.id);
    }
  }, [session, markSessionAsUsed]);

  const handleEnd = React.useCallback(async () => {
    if (!session) return;
    if (!confirm("Are you sure you want to end this session?")) return;
    try {
      await endSession({ variables: { id: session.id } });
      showToast({ message: "Session ended successfully", type: "success" });
    } catch (error) {
      showToast({
        message: `Failed to end session: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: "error",
      });
    }
  }, [session, endSession, showToast]);

  const handleDelete = React.useCallback(async () => {
    if (!session) return;
    if (
      !confirm(
        `Are you sure you want to delete this session?\n\nThis will also delete all recordings and data associated with it.\n\nThis action cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await deleteSession({ variables: { id: session.id } });
      showToast({ message: "Session deleted successfully", type: "success" });
      navigate("/");
    } catch (error) {
      showToast({
        message: `Failed to delete session: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: "error",
      });
    }
  }, [session, deleteSession, navigate, showToast]);

  const handleView = React.useCallback(
    (recording: RecordingSummary) => {
      navigate(`/oscilloscope?recording=${recording.id}`);
    },
    [navigate],
  );

  const handleDeleteRecording = React.useCallback(
    async (recording: RecordingSummary) => {
      if (!confirm(`Are you sure you want to delete "${recording.name}"?`)) return;
      showToast({ message: `Deleting ${recording.name}...`, type: "info" });
      try {
        await deleteRecording({ variables: { id: recording.id } });
        showToast({ message: `${recording.name} deleted`, type: "success" });
        refetchRecordings();
      } catch (error) {
        showToast({
          message: `Failed to delete recording: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [deleteRecording, refetchRecordings, showToast],
  );

  const handleDownloadCsv = React.useCallback(
    async (recording: RecordingSummary) => {
      showToast({ message: `Exporting ${recording.name} to CSV...`, type: "info" });
      try {
        await exportRecording(recording.id, "csv", recording.sampleCount);
        showToast({ message: `${recording.name} exported to CSV`, type: "success" });
      } catch (error) {
        showToast({
          message: `Failed to export CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [showToast, exportRecording],
  );

  const handleDownloadWav = React.useCallback(
    async (recording: RecordingSummary) => {
      showToast({ message: `Exporting ${recording.name} to WAV...`, type: "info" });
      try {
        await exportRecording(recording.id, "wav", recording.sampleCount);
        showToast({ message: `${recording.name} exported to WAV`, type: "success" });
      } catch (error) {
        showToast({
          message: `Failed to export WAV: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [showToast, exportRecording],
  );

  const handleDownloadJson = React.useCallback(
    async (recording: RecordingSummary) => {
      showToast({ message: `Exporting ${recording.name} to JSON...`, type: "info" });
      try {
        await exportRecording(recording.id, "json", recording.sampleCount);
        showToast({ message: `${recording.name} exported to JSON`, type: "success" });
      } catch (error) {
        showToast({
          message: `Failed to export JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [showToast, exportRecording],
  );

  const handleOpenEdit = React.useCallback(() => {
    setEditDialogOpen(true);
  }, []);

  const handleSaveSession = React.useCallback(
    async (name: string, description: string) => {
      if (!session) return;
      try {
        await updateSession({
          variables: { id: session.id, input: { name, description } },
        });
        setEditDialogOpen(false);
        refetchSession();
        showToast({ message: "Session updated successfully", type: "success" });
      } catch (error) {
        showToast({
          message: `Failed to update session: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "error",
        });
      }
    },
    [session, updateSession, refetchSession, showToast],
  );

  const handleDeleteFromEdit = React.useCallback(() => {
    setEditDialogOpen(false);
    handleDelete();
  }, [handleDelete]);

  const handleOpenOscilloscope = React.useCallback(() => {
    navigate(`/oscilloscope?sessionId=${sessionId}`);
  }, [navigate, sessionId]);

  const handleSelectSubSession = React.useCallback(
    (subSessionId: string) => {
      navigate(`/session/${subSessionId}`);
    },
    [navigate],
  );

  const isLoading = sessionLoading;

  return (
    <div className="w-full min-h-screen bg-bg-primary">
      <header className="px-4 py-3 md:px-6 md:py-4 bg-bg-secondary border-b border-border-subtle pl-14 sm:pl-12 md:pl-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-tertiary transition-all shrink-0 -ml-2 sm:ml-0"
            >
              <ArrowLeft size={18} className="text-text-secondary" />
            </button>
            {isLoading ? (
              <div className="space-y-1">
                <Skeleton className="h-6 w-32 md:w-48" />
                <Skeleton className="h-4 w-24 md:w-32" />
              </div>
            ) : session ? (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
                    {session.name || `Session ${sessionId?.slice(0, 8)}`}
                  </h1>
                  {!session.endedAt && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-neutral-500/20 border border-neutral-500/30 text-neutral-400 rounded shrink-0">
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {session.startedAt && (
                    <>
                      <span className="text-xs text-text-secondary">
                        {formatSessionDate(session.startedAt)}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {formatSessionTime(session.startedAt)}
                      </span>
                    </>
                  )}
                </div>
                {session.description && (
                  <p className="text-sm text-text-secondary mt-2 max-w-md">{session.description}</p>
                )}
              </div>
            ) : undefined}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={handleOpenOscilloscope}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-yellow-700 hover:bg-yellow-800 border border-yellow-900 transition-all text-white font-semibold"
            >
              Open Oscilloscope
            </button>
            {!session?.endedAt && (
              <button
                onClick={handleEnd}
                disabled={isLoading || isEnding}
                className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-yellow-700 hover:bg-yellow-800 border border-yellow-900 transition-all text-white font-semibold"
              >
                End Session
              </button>
            )}
            {/* Desktop: Edit and Delete buttons - hidden on mobile */}
            <button
              ref={editButtonReference}
              onClick={handleOpenEdit}
              disabled={isLoading || isDeleting || isUpdating}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-bg-tertiary hover:bg-bg-hover border border-border transition-all text-text-secondary hover:text-foreground"
            >
              <Edit3 size={14} />
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isLoading || isDeleting}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-bg-tertiary hover:bg-bg-hover border border-border transition-all text-destructive hover:text-destructive"
            >
              <Trash2 size={14} />
              Delete
            </button>
            {/* Mobile: More menu button */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-tertiary transition-all"
              >
                <MoreVertical size={18} className="text-text-secondary" />
              </button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-bg-elevated border border-border rounded-lg shadow-lg z-20">
                    <button
                      onClick={() => {
                        handleOpenEdit();
                        setMoreMenuOpen(false);
                      }}
                      disabled={isLoading || isDeleting || isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground transition-colors"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDelete();
                        setMoreMenuOpen(false);
                      }}
                      disabled={isLoading || isDeleting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {}
      {parentSession && (
        <div className="mx-4 md:mx-6 mt-4 p-4 bg-icon/10 border border-icon/30 rounded-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Radio size={16} className="text-icon shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-text-tertiary uppercase tracking-wide">
                  Parent Session
                </span>
                <p className="text-sm font-medium text-foreground truncate">
                  {parentSession.name || `Session ${parentSession.id?.slice(0, 8)}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/session/${parentSession.id}`)}
              className="px-3 py-1.5 text-xs font-medium bg-icon/20 hover:bg-icon/30 border border-icon/40 rounded-md transition-all text-text-secondary shrink-0"
            >
              View Parent
            </button>
          </div>
        </div>
      )}

      {}
      {!session?.isSubSession && subSessions.length > 0 && (
        <div className="mx-4 md:mx-6 mt-4 p-3 bg-icon/10 border border-icon/30 rounded-xl flex items-center gap-2">
          <Radio size={14} className="text-icon animate-pulse shrink-0" />
          <span className="text-xs text-text-secondary flex-1 min-w-0 truncate">
            {subSessions.length} live capture{subSessions.length > 1 ? "s" : ""} in progress
          </span>
          <button
            onClick={() => {
              refetchSubSessions();
              refetchSession();
            }}
            className="px-2 py-0.5 text-xs bg-icon/20 hover:bg-icon/30 rounded transition-all text-text-secondary shrink-0"
          >
            Refresh
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="mx-4 md:mx-6 mt-6 p-4 md:p-5 bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-4 md:mx-6 mt-6 p-4 md:p-5 bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] md:text-[11px] text-text-tertiary uppercase tracking-wide">
                Session ID
              </span>
              <span className="text-xs md:text-sm font-medium text-foreground font-mono truncate">
                {sessionId?.slice(0, 8)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] md:text-[11px] text-text-tertiary uppercase tracking-wide">
                Started
              </span>
              <span className="text-xs md:text-sm font-medium text-foreground truncate">
                {session?.startedAt ? formatTimestampRelative(session.startedAt) : "-"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] md:text-[11px] text-text-tertiary uppercase tracking-wide">
                Last Activity
              </span>
              <span className="text-xs md:text-sm font-medium text-foreground truncate">
                {session?.endedAt
                  ? "Ended"
                  : session?.durationSeconds
                    ? formatDuration(session.durationSeconds)
                    : "Active"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] md:text-[11px] text-text-tertiary uppercase tracking-wide">
                Status
              </span>
              <span className="text-xs md:text-sm font-medium text-foreground">
                {session?.endedAt ? "Ended" : session?.isOscilloscopeOpen ? "Active" : "Idle"}
              </span>
            </div>
          </div>
        </div>
      )}

      <main className="px-4 md:px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 p-1 bg-bg-secondary rounded-xl">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="flex flex-col items-center justify-center gap-1 px-2 md:px-4 py-4 md:py-5 bg-bg-tertiary rounded-lg"
              >
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 p-1 bg-bg-secondary rounded-xl">
            {[
              { icon: FileAudio, label: "Recordings", value: recordingsTotal.toString() },
              {
                icon: Clock,
                label: "Total Duration",
                value: formatDuration(totalDurationMs / 1000),
              },
              { icon: Database, label: "Storage Used", value: formatBytes(totalStorageBytes ?? 0) },
              {
                icon: Activity,
                label: "Oscilloscope Time",
                value: formatDuration((session?.oscilloscopeDurationMs || 0) / 1000),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center justify-center gap-1 px-2 md:px-4 py-4 md:py-5 bg-bg-tertiary rounded-lg transition-all hover:bg-bg-hover"
              >
                <stat.icon size={14} className="text-icon mb-1 md:w-4 md:h-4" />
                <span className="text-base md:text-xl font-bold text-foreground font-mono">
                  {stat.value}
                </span>
                <span className="text-[9px] md:text-[10px] text-text-tertiary uppercase tracking-wide text-center leading-tight">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 mb-6 p-1 bg-bg-secondary rounded-xl">
          {[
            { key: "recordings" as TabType, label: "Recordings", count: recordingsTotal },
            { key: "live-captures" as TabType, label: "Live Captures", count: subSessions.length },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`flex-1 flex items-center justify-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-4 md:py-5 rounded-lg transition-all ${
                activeTab === item.key
                  ? "bg-bg-tertiary text-foreground"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              <span className="text-xs md:text-sm font-medium truncate">{item.label}</span>
              <span className="text-xs font-mono opacity-60 shrink-0">({item.count})</span>
            </button>
          ))}
        </div>

        {activeTab === "live-captures" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {subSessionsLoading ? (
                <>
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </>
              ) : subSessions.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-text-tertiary">
                  <Radio size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No live captures yet</p>
                </div>
              ) : (
                subSessions.map((subSession: SessionWithStatus) => (
                  <LiveCaptureCard
                    key={subSession.id}
                    subSession={subSession}
                    onSelect={handleSelectSubSession}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {recordingsLoading ? (
                <>
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </>
              ) : recordings.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-text-tertiary">
                  <FileAudio size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recordings yet</p>
                </div>
              ) : (
                recordings.map((recording: RecordingSummary) => (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    onView={handleView}
                    onDelete={handleDeleteRecording}
                    onDownloadCsv={handleDownloadCsv}
                    onDownloadWav={handleDownloadWav}
                    onDownloadJson={handleDownloadJson}
                  />
                ))
              )}
            </div>

            {}
            {recordingsTotal > recordingsLimit && (
              <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                <span className="text-xs text-text-tertiary">
                  Showing {recordingsOffset + 1}-
                  {Math.min(recordingsOffset + recordings.length, recordingsTotal)} of{" "}
                  {recordingsTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setRecordingsOffset(Math.max(0, recordingsOffset - recordingsLimit))
                    }
                    disabled={recordingsOffset === 0}
                    className="px-3 py-1.5 text-xs font-medium bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setRecordingsOffset(recordingsOffset + recordingsLimit)}
                    disabled={recordingsOffset + recordingsLimit >= recordingsTotal}
                    className="px-3 py-1.5 text-xs font-medium bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Session Dialog */}
      <EditSessionDialog
        isOpen={editDialogOpen}
        sessionId={sessionId || ""}
        sessionName={session?.name || ""}
        sessionDescription={session?.description ?? ""}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveSession}
        onDelete={handleDeleteFromEdit}
        isLoading={isUpdating}
      />
    </div>
  );
}
