/**
 * Home Page - Main dashboard view
 * Shows recording stats, scopes with status, and recent recordings
 */

import * as React from "react";
import { 
  Mic, 
  Radio, 
  Settings as SettingsIcon, 
  Clock,
  Pin,
  PinOff,
  MoreVertical,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Circle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
  useRecordingStats, 
  useRecentRecordings,
  useHomePageScopes,
  usePinRecording,
  useDeleteRecording,
} from "../hooks";
import { DialogMicRecording } from "../components/dialogs/dialog-mic-recording";
import { useToast } from "../components/ui/toast";

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Format duration
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
};

// Format relative time
const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function Home(): React.ReactElement {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // State
  const [isMicDialogOpen, setIsMicDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"recordings" | "scopes">("recordings");
  const [timeFilter, setTimeFilter] = React.useState<"all" | "today" | "week" | "month">("all");
  const [showAllScopes, setShowAllScopes] = React.useState(false);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  // Queries
  const { data: stats, isLoading: statsLoading } = useRecordingStats();
  const { data: recentData, isLoading: recordingsLoading } = useRecentRecordings(20);
  const { scopes, counts } = useHomePageScopes();

  // Mutations
  const pinRecording = usePinRecording();
  const deleteRecording = useDeleteRecording();
  const renameRecording = useRenameRecording();

  // Filter recordings based on time
  const filteredRecordings = React.useMemo(() => {
    if (!recentData?.recordings) return [];
    
    const now = new Date();
    return recentData.recordings.filter(rec => {
      const recDate = new Date(rec.timestamp);
      switch (timeFilter) {
        case "today":
          return recDate.toDateString() === now.toDateString();
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return recDate >= weekAgo;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return recDate >= monthAgo;
        default:
          return true;
      }
    });
  }, [recentData, timeFilter]);

  // Display scopes
  const displayScopes = showAllScopes ? scopes : scopes.slice(0, 3);

  // Handle pin
  const handlePin = (id: string, isPinned: boolean) => {
    pinRecording.mutate({ id, isPinned: !isPinned });
    setOpenMenuId(null);
    showToast({
      message: isPinned ? "Recording unpinned" : "Recording pinned",
      type: "success",
    });
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this recording?")) {
      deleteRecording.mutate(id);
      setOpenMenuId(null);
      showToast({
        message: "Recording deleted",
        type: "success",
      });
    }
  };

  // Handle rename start
  const handleRenameStart = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setOpenMenuId(null);
  };

  // Handle rename submit
  const handleRenameSubmit = (id: string) => {
    if (renameValue.trim()) {
      renameRecording.mutate({ id, name: renameValue.trim() });
      showToast({
        message: "Recording renamed",
        type: "success",
      });
    }
    setRenamingId(null);
    setRenameValue("");
  };

  // Handle rename cancel
  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="min-h-full bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border-subtle bg-bg-secondary">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-bg-elevated rounded-lg">
            <Radio size={20} className="text-text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Audio Scope View</h1>
            <p className="text-sm text-text-tertiary">Signal analysis dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMicDialogOpen(true)}
            className="w-10 h-10 flex items-center justify-center bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
            title="Test Microphone"
          >
            <Mic size={18} />
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="w-10 h-10 flex items-center justify-center bg-bg-elevated hover:bg-bg-hover border border-border-subtle rounded-lg transition-colors"
            title="Settings"
          >
            <SettingsIcon size={18} className="text-text-secondary" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6 lg:p-8 flex flex-col gap-6">
        {/* Quick Stats */}
        <div className="bg-bg-secondary border border-border-subtle rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Overview</h2>
              <p className="text-sm text-text-tertiary mt-0.5">Your recording activity at a glance</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 bg-bg-elevated rounded-lg">
              <div className="text-2xl font-bold font-mono text-foreground">
                {statsLoading ? "-" : (stats?.total_recordings ?? 0)}
              </div>
              <div className="text-xs text-text-tertiary uppercase tracking-wider mt-1">Recordings</div>
            </div>
            <div className="text-center p-4 bg-bg-elevated rounded-lg">
              <div className="text-2xl font-bold font-mono text-foreground">
                {statsLoading ? "-" : formatBytes(stats?.total_size_bytes ?? 0)}
              </div>
              <div className="text-xs text-text-tertiary uppercase tracking-wider mt-1">Storage</div>
            </div>
            <div className="text-center p-4 bg-bg-elevated rounded-lg">
              <div className="text-2xl font-bold font-mono text-foreground">
                {statsLoading ? "-" : counts.liveCount}
              </div>
              <div className="text-xs text-text-tertiary uppercase tracking-wider mt-1">Live Scopes</div>
            </div>
          </div>
        </div>

        {/* Active Scopes */}
        <div className="bg-bg-secondary border border-border-subtle rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Scopes</h2>
              <p className="text-sm text-text-tertiary mt-0.5">Status of all your audio scopes</p>
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

          <div className="space-y-2">
            {displayScopes.length === 0 ? (
              <div className="text-center py-8 text-text-tertiary">
                <Radio size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No scopes created yet</p>
                <button 
                  onClick={() => navigate("/scopes")}
                  className="text-accent hover:underline text-sm mt-1"
                >
                  Create your first scope
                </button>
              </div>
            ) : (
              displayScopes.map((scope) => (
                <div
                  key={scope.id}
                  className="flex items-center gap-3 p-3 bg-bg-elevated rounded-lg hover:bg-bg-hover cursor-pointer transition-colors"
                  onClick={() => navigate(`/scopes/${scope.id}`)}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    scope.status === "live" ? "bg-success" :
                    scope.status === "paused" ? "bg-text-primary" :
                    "bg-destructive"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{scope.name}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {scope.recording_count} recordings
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {scopes.length > 3 && (
            <button
              onClick={() => setShowAllScopes(!showAllScopes)}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-3 text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              {showAllScopes ? (
                <>Show less <ChevronUp size={14} /></>
              ) : (
                <>View {scopes.length - 3} more scopes <ChevronDown size={14} /></>
              )}
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-bg-secondary border border-border-subtle rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border-subtle">
            <div className="flex gap-1 p-1 bg-bg-elevated rounded-lg">
              <button
                onClick={() => setActiveTab("recordings")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "recordings"
                    ? "bg-bg-active text-foreground"
                    : "text-text-secondary hover:text-foreground"
                }`}
              >
                <FileAudio size={16} />
                Recordings
              </button>
              <button
                onClick={() => setActiveTab("scopes")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "scopes"
                    ? "bg-bg-active text-foreground"
                    : "text-text-secondary hover:text-foreground"
                }`}
              >
                <Radio size={16} />
                All Scopes
              </button>
            </div>

            {activeTab === "recordings" && (
              <div className="flex gap-2">
                {(["all", "today", "week", "month"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      timeFilter === filter
                        ? "bg-bg-active text-foreground"
                        : "text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    {filter === "all" ? "All" :
                     filter === "today" ? "Today" :
                     filter === "week" ? "7 days" : "30 days"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            {activeTab === "recordings" ? (
              <div className="space-y-2">
                {recordingsLoading ? (
                  <div className="text-center py-8 text-text-tertiary">Loading recordings...</div>
                ) : filteredRecordings.length === 0 ? (
                  <div className="text-center py-8 text-text-tertiary">
                    <FileAudio size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recordings found</p>
                  </div>
                ) : (
                  filteredRecordings.map((recording) => (
                    <div
                      key={recording.id}
                      className="group flex items-center gap-3 p-3 bg-bg-elevated rounded-lg hover:bg-bg-hover transition-colors"
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
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSubmit(recording.id);
                                if (e.key === "Escape") handleRenameCancel();
                              }}
                              onBlur={() => handleRenameSubmit(recording.id)}
                              autoFocus
                              className="flex-1 px-2 py-1 text-sm bg-bg-primary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-foreground truncate">{recording.name}</div>
                              {recording.is_pinned && (
                                <Pin size={12} className="text-accent flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-text-tertiary mt-0.5">
                              {recording.scope_name} • {formatRelativeTime(recording.timestamp)} • {formatBytes(recording.size_bytes)}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === recording.id ? null : recording.id);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-bg-active transition-all"
                        >
                          <MoreVertical size={16} className="text-text-secondary" />
                        </button>
                        {openMenuId === recording.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePin(recording.id, recording.is_pinned);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover transition-colors"
                            >
                              {recording.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                              {recording.is_pinned ? "Unpin" : "Pin"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameStart(recording.id, recording.name);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover transition-colors"
                            >
                              <Edit3 size={14} />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
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
                {scopes.length === 0 ? (
                  <div className="text-center py-8 text-text-tertiary">
                    <Radio size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No scopes created yet</p>
                  </div>
                ) : (
                  scopes.map((scope) => (
                    <div
                      key={scope.id}
                      className="group flex items-center gap-3 p-3 bg-bg-elevated rounded-lg hover:bg-bg-hover cursor-pointer transition-colors"
                      onClick={() => navigate(`/scopes/${scope.id}`)}
                    >
                      <div className="w-9 h-9 flex items-center justify-center bg-bg-primary rounded-lg">
                        <Radio size={16} className="text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-foreground truncate">{scope.name}</div>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium uppercase rounded ${
                            scope.status === "live" ? "bg-success/10 text-success" :
                            scope.status === "paused" ? "bg-text-tertiary/10 text-text-tertiary" :
                            "bg-destructive/10 text-destructive"
                          }`}>
                            {scope.status}
                          </span>
                        </div>
                        <div className="text-xs text-text-tertiary mt-0.5">
                          {scope.recording_count} recordings • Created {formatRelativeTime(scope.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Test Microphone Dialog */}
      <DialogMicRecording
        isOpen={isMicDialogOpen}
        onClose={() => setIsMicDialogOpen(false)}
      />
    </div>
  );
}
