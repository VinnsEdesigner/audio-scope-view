// use-export.ts — RN port of the web hook. The web version calls
// downloadFile() + downloadCanvasAsPNG() (browser <a download> + canvas
// toDataURL). RN has no DOM; instead it writes the CSV string to a temp file
// (expo-file-system) and shares it via expo-sharing. Canvas PNG snapshots are
// not available yet (the RN scope renderer is a later phase) — the hook returns
// an error for that path so callers degrade gracefully.
import { useCallback } from "react";
import { exportToCSV } from "@audio-scope-view/api-client/domain/_shared/audio-utilities";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAudioAnalyzer } from "./use-audio-analyzer";

export function useExport() {
  const { samples, sampleRate, waveformData, analysisFrame } = useAudioAnalyzer();

  const hasFullSamples = samples.length > 0;
  const hasLiveData = analysisFrame.length > 0 || waveformData.length > 0;
  const hasData = hasFullSamples || hasLiveData;

  const getExportData = useCallback((): { samples: Float32Array; source: string } | undefined => {
    if (hasFullSamples) {
      return { samples, source: "captured" };
    }
    if (analysisFrame.length > 0) {
      return { samples: analysisFrame, source: "live" };
    }
    if (waveformData.length > 0) {
      return { samples: Float32Array.from(waveformData), source: "waveform" };
    }
    return undefined;
  }, [samples, analysisFrame, waveformData, hasFullSamples]);

  const getSampleCount = (): number => {
    if (hasFullSamples) return samples.length;
    if (analysisFrame.length > 0) return analysisFrame.length;
    return waveformData.length;
  };

  const exportCSV = useCallback(async () => {
    const exportData = getExportData();
    if (!exportData) {
      return { success: false, error: "No samples to export" };
    }

    try {
      const csvContent = exportToCSV({
        samples: exportData.samples,
        sampleRate,
        includeHeader: true,
        delimiter: ",",
      });

      const timestamp = new Date().toISOString().slice(0, 19).replaceAll(/[:-]/g, "");
      const filename = `waveform_${timestamp}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export waveform",
          UTI: "public.comma-separated-values-text",
        });
      }

      return { success: true, filename };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export CSV";
      return { success: false, error: message };
    }
  }, [getExportData, sampleRate]);

  // RN has no canvas snapshot path yet (scope renderer is a later phase).
  // Kept for API parity with the web hook so callers don't break.
  const exportSnapshotPNG = useCallback((_canvas: unknown) => {
    return { success: false, error: "Canvas snapshots are not available on RN yet" };
  }, []);

  return {
    exportCSV,
    exportSnapshotPNG,
    hasData,
    sampleCount: getSampleCount(),
    sampleRate,
  };
}
