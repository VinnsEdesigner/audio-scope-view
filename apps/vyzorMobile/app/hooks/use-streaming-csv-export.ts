// use-streaming-csv-export.ts — RN port of the web hook. The web version builds
// a download <a> and lets the browser stream to disk; RN has no DOM, so this
// fetches the export bytes from the API and shares them via expo-sharing
// (writing to a cache file first). The ExportProgress shape matches the web
// hook so consumers are unchanged.
import { useCallback, useState } from "react";
import { config } from "../lib/api-config";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

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
        // Build the export URL from the configured API base.
        const base = config.graphqlEndpoint.replace(/\/graphql$/, "");
        const exportUrl = `${base}/api/recordings/${encodeURIComponent(recordingId)}/${format}`;
        const downloadFilename = `recording_${recordingId}.${FORMAT_META[format].extension}`;

        const response = await fetch(exportUrl, {
          headers: config.bootstrapKey
            ? { Authorization: `Bearer ${config.bootstrapKey}` }
            : undefined,
        });
        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        const reader = new FileReader();
        const base64: string = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            // result is "data:<mime>;base64,<data>" — strip the prefix.
            const comma = result.indexOf(",");
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
          };
          reader.onerror = () => reject(new Error("Failed to read export bytes"));
          reader.readAsDataURL(blob);
        });

        const fileUri = `${FileSystem.cacheDirectory}${downloadFilename}`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: FORMAT_META[format].mimeType,
            dialogTitle: `Export ${format.toUpperCase()}`,
          });
        }

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
