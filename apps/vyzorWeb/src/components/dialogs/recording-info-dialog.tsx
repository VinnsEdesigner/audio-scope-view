import * as React from "react";
import { Calendar, Clock, X } from "lucide-react";
import { useRecording } from "@/hooks";
import {
  formatBytes,
  formatDuration,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";

interface RecordingInfoDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  recordingId: string;
}

interface InfoRowProperties {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProperties) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-bg-elevated rounded-lg">
      <div className="flex items-center gap-2 text-sm text-text-tertiary">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-mono text-foreground">{value}</div>
    </div>
  );
}

interface StatCardProperties {
  value: string;
  label: string;
}

function StatCard({ value, label }: StatCardProperties) {
  return (
    <div className="flex flex-col items-center p-3 bg-bg-elevated rounded-lg">
      <div className="text-sm font-semibold font-mono text-foreground">{value}</div>
      <div className="text-xs text-text-tertiary uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

export function RecordingInfoDialog({
  isOpen: _isOpen,
  onClose,
  recordingId,
}: RecordingInfoDialogProperties) {
  const { data: recording, loading: isLoading } = useRecording(recordingId);

  const formattedDate = React.useMemo(() => {
    if (!recording?.timestamp) return "—";
    return new Date(recording.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [recording?.timestamp]);

  const formattedTime = React.useMemo(() => {
    if (!recording?.timestamp) return "—";
    return new Date(recording.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  }, [recording?.timestamp]);

  const formattedDuration = React.useMemo(() => {
    if (!recording?.durationMs) return "—";
    return formatDuration(recording.durationMs);
  }, [recording?.durationMs]);

  const formattedSize = React.useMemo(() => {
    if (!recording?.sizeBytes) return "—";
    return formatBytes(recording.sizeBytes);
  }, [recording?.sizeBytes]);

  const formattedSampleRate = React.useMemo(() => {
    if (!recording?.sampleCount || !recording?.durationMs) return "—";
    const sampleRate = Math.round((recording.sampleCount / recording.durationMs) * 1000);
    return `${(sampleRate / 1000).toFixed(0)} kHz`;
  }, [recording?.sampleCount, recording?.durationMs]);

  return (
    <div className="w-[320px]">
      {}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Recording Info</h2>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-hover transition-all"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
      </div>

      {}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-text-secondary">Loading...</div>
          </div>
        ) : recording ? (
          <div className="space-y-4">
            {}
            <div className="p-4 bg-bg-elevated rounded-lg">
              <div className="text-xs text-text-tertiary uppercase tracking-wide mb-2">
                Recording Name
              </div>
              <div className="text-base font-medium text-foreground">{recording.name}</div>
            </div>

            {}
            <div className="grid grid-cols-3 gap-3">
              <StatCard value={formattedDuration} label="Duration" />
              <StatCard value={formattedSize} label="Size" />
              <StatCard value={formattedSampleRate} label="Sample Rate" />
            </div>

            {}
            <div className="space-y-2">
              <InfoRow
                icon={<Calendar size={16} className="opacity-70" />}
                label="Created"
                value={formattedDate}
              />
              <InfoRow
                icon={<Clock size={16} className="opacity-70" />}
                label="Time"
                value={formattedTime}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-text-secondary">Recording not found</div>
          </div>
        )}
      </div>
    </div>
  );
}
