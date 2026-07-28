import * as React from "react";
import { Calendar, Clock, Mic } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
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
  isOpen,
  onClose,
  recordingId,
}: RecordingInfoDialogProperties) {
  const { data: recording, isLoading } = useRecording(recordingId);

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
    <Dialog isOpen={isOpen} onClose={onClose} title="Recording Info" maxWidth="max-w-sm">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-text-secondary">Loading...</div>
        </div>
      ) : recording ? (
        <div className="space-y-4">
          {/* Recording Name */}
          <div className="p-4 bg-bg-elevated rounded-lg">
            <div className="text-xs text-text-tertiary uppercase tracking-wide mb-2">
              Recording Name
            </div>
            <div className="text-base font-medium text-foreground">{recording.name}</div>
            <div className="inline-flex items-center gap-2 px-2 py-1 bg-bg-active rounded-full text-xs text-text-secondary mt-3">
              <Mic size={12} />
              <span>{recording.scopeName}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard value={formattedDuration} label="Duration" />
            <StatCard value={formattedSize} label="Size" />
            <StatCard value={formattedSampleRate} label="Sample Rate" />
          </div>

          {/* Info Rows */}
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
    </Dialog>
  );
}
