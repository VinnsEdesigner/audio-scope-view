import { useCallback, useState } from "react";
import { config as _config } from "@audio-scope-view/api-client/config";

export type ExportFormat = "csv" | "wav" | "json";

export interface ExportProgress {
  isExporting: boolean;
  progress: number; // 0-100
  processedSamples: number;
  totalSamples: number;
  error: string | undefined;
  format: ExportFormat | undefined;
}

export interface UseRecordingExportReturn {
  exportProgress: ExportProgress;
  exportRecording: (
    recordingId: string,
    format: ExportFormat,
    totalSamples?: number,
  ) => Promise<void>;
  cancelExport: () => void;
}

// Format metadata
const FORMAT_META: Record<ExportFormat, { extension: string; mimeType: string }> = {
  csv: { extension: "csv", mimeType: "text/csv;charset=utf-8" },
  wav: { extension: "wav", mimeType: "audio/wav" },
  json: { extension: "json", mimeType: "application/json" },
};

export function useRecordingExport(): UseRecordingExportReturn {
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    isExporting: false,
    progress: 0,
    processedSamples: 0,
    totalSamples: 0,
    error: undefined,
    format: undefined,
  });

  const cancelExport = useCallback(() => {
    setExportProgress({
      isExporting: false,
      progress: 0,
      processedSamples: 0,
      totalSamples: 0,
      error: undefined,
      format: undefined,
    });
  }, []);

  /**
   * Export a recording using direct download link.
   *
   * This approach uses a hidden <a> tag with download attribute, which lets the browser
   * handle the download natively. The browser streams directly to disk without loading
   * the entire file into memory, avoiding memory issues with large files.
   */
  const exportRecording = useCallback(
    async (recordingId: string, format: ExportFormat, totalSamples?: number) => {
      setExportProgress({
        isExporting: true,
        progress: 0,
        processedSamples: 0,
        totalSamples: totalSamples ?? 0,
        error: undefined,
        format,
      });

      try {
        // Build the export URL - relative URL works since simple-server proxies /api/*
        const exportUrl = `/api/recordings/${encodeURIComponent(recordingId)}/${format}`;

        // Build download filename
        const downloadFilename = `recording_${recordingId}.${FORMAT_META[format].extension}`;

        // Create a temporary hidden link and trigger direct download
        // The browser handles streaming to disk natively - no memory issues
        const link = document.createElement("a");
        link.href = exportUrl;
        link.download = downloadFilename;
        link.style.display = "none";

        // For CSV/JSON, we want the browser to download rather than display
        // Adding target="_blank" with download attribute forces download behavior
        if (format === "csv" || format === "json") {
          link.target = "_blank";
        }

        // Set the appropriate MIME type for the download
        link.type = FORMAT_META[format].mimeType;

        document.body.append(link);
        link.click();

        // Clean up immediately after click
        setTimeout(() => {
          link.remove();
        }, 100);

        // Mark export as complete (browser handles the actual download)
        setExportProgress({
          isExporting: false,
          progress: 100,
          processedSamples: totalSamples ?? 0,
          totalSamples: totalSamples ?? 0,
          error: undefined,
          format,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : `Failed to export ${format.toUpperCase()}`;
        setExportProgress((previous) => ({
          ...previous,
          isExporting: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [],
  );

  return {
    exportProgress,
    exportRecording,
    cancelExport,
  };
}

// Convenience exports for specific formats
export function useStreamingCSVExport() {
  const hook = useRecordingExport();

  return {
    exportProgress: hook.exportProgress,
    exportRecordingToCSV: (
      recordingId: string,
      _sampleRate: number,
      totalSamples: number,
      _filename?: string,
    ) => {
      return hook.exportRecording(recordingId, "csv", totalSamples);
    },
    cancelExport: hook.cancelExport,
  };
}
