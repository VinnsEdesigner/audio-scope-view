import * as React from "react";
import { Camera, FileText, X } from "lucide-react";
import { useExport } from "@/hooks/use-export";
import type { SessionMode } from "@/store";

interface ExportDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mode?: SessionMode;
}

export function ExportDialog({
  isOpen: _isOpen,
  onClose,
  canvasRef,
  mode = "live",
}: ExportDialogProperties) {
  const { exportCSV, exportSnapshotPNG, hasData, sampleCount } = useExport();
  const isPlayback = mode === "playback";

  const handleExportSnapshot = () => {
    const result = exportSnapshotPNG(canvasRef.current);
    if (result.success) {
      onClose();
    }
  };

  const handleExportCSV = () => {
    const result = exportCSV();
    if (result.success) {
      onClose();
    }
  };

  const getDescription = () => {
    if (isPlayback) {
      return "Export recorded data for analysis or sharing.";
    }
    return "Save the current view for reports or offline analysis.";
  };

  return (
    <div className="w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Export</h2>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-hover transition-all"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-text-tertiary">{getDescription()}</p>

        <button
          type="button"
          className="w-full flex items-center gap-3 h-auto py-3 px-4 rounded-lg border border-border bg-transparent hover:bg-bg-hover transition-colors cursor-pointer text-left"
          onClick={handleExportSnapshot}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary">
            <Camera className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="text-left">
            <div className="font-medium text-foreground">Snapshot (PNG)</div>
            <div className="text-xs text-text-tertiary">Save canvas as image</div>
          </div>
        </button>

        <button
          type="button"
          className="w-full flex items-center gap-3 h-auto py-3 px-4 rounded-lg border border-border bg-transparent hover:bg-bg-hover transition-colors cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleExportCSV}
          disabled={!hasData}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary">
            <FileText className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="text-left">
            <div className="font-medium text-foreground">Export CSV</div>
            <div className="text-xs text-text-tertiary">
              {hasData ? `Download ${sampleCount.toLocaleString()} samples` : "No data to export"}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
