import * as React from "react";
import { Camera, FileText } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useExport } from "@/hooks/use-export";
import type { ScopeMode } from "@/store";

interface ExportDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mode?: ScopeMode;
}

export function ExportDialog({
  isOpen,
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
    <Dialog isOpen={isOpen} onClose={onClose} title="Export" maxWidth="sm:max-w-md">
      <div className="space-y-4 py-4">
        <p className="text-sm text-text-tertiary mb-4">{getDescription()}</p>

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

      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          Cancel
        </button>
      </DialogFooter>
    </Dialog>
  );
}
