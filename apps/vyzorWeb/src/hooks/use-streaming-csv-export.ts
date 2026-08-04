import { useCallback, useState } from "react";
import { config } from "@audio-scope-view/api-client/config";

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
        const baseUrl = config.getApiUrl();
        const exportUrl = `${baseUrl}/api/recordings/${encodeURIComponent(recordingId)}/${format}`;

        const response = await fetch(exportUrl, {
          headers: {
            ...(config.bootstrapKey ? { Authorization: `Bearer ${config.bootstrapKey}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to download ${format.toUpperCase()}: ${response.statusText}`);
        }

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get("Content-Disposition");
        let downloadFilename = `recording_${recordingId}.${FORMAT_META[format].extension}`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match) {
            downloadFilename = match[1];
          }
        }

        // Get total samples from header if available
        const headerTotalSamples = response.headers.get("X-Total-Samples");
        const actualTotalSamples = headerTotalSamples
          ? Number.parseInt(headerTotalSamples, 10)
          : (totalSamples ?? 0);

        // Stream the download using fetch + ReadableStream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to read response stream");
        }

        const chunks: Uint8Array[] = [];
        let receivedLength = 0;
        const contentLength = Number.parseInt(response.headers.get("Content-Length") ?? "0", 10);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          // Update progress
          if (contentLength > 0) {
            setExportProgress((previous) => ({
              ...previous,
              progress: Math.round((receivedLength / contentLength) * 100),
              processedSamples: actualTotalSamples,
            }));
          }
        }

        // Combine chunks and download
        const blob = new Blob(chunks, { type: FORMAT_META[format].mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadFilename;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        setExportProgress({
          isExporting: false,
          progress: 100,
          processedSamples: actualTotalSamples,
          totalSamples: actualTotalSamples,
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
