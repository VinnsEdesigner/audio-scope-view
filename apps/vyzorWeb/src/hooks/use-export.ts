import { useCallback } from "react";
import {
  exportToCSV,
  downloadFile,
  downloadCanvasAsPNG,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";
import { useAudioAnalyzer } from "./use-audio-analyzer";

export function useExport() {
  const { samples, sampleRate, waveformData } = useAudioAnalyzer();

  const exportCSV = useCallback(() => {
    if (samples.length === 0) {
      return { success: false, error: "No samples to export" };
    }

    try {
      const csvContent = exportToCSV({
        samples,
        sampleRate,
        includeHeader: true,
        delimiter: ",",
      });

      const timestamp = new Date().toISOString().slice(0, 19).replaceAll(/[:-]/g, "");
      const filename = `waveform_${timestamp}.csv`;

      downloadFile(csvContent, filename, "text/csv");

      return { success: true, filename };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export CSV";
      return { success: false, error: message };
    }
  }, [samples, sampleRate]);

  const exportSnapshotPNG = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      return { success: false, error: "Canvas not available" };
    }

    try {
      const timestamp = new Date().toISOString().slice(0, 19).replaceAll(/[:-]/g, "");
      const filename = `scope_snapshot_${timestamp}.png`;

      downloadCanvasAsPNG(canvas, filename);

      return { success: true, filename };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export snapshot";
      return { success: false, error: message };
    }
  }, []);

  const hasData = samples.length > 0 || waveformData.length > 0;

  return {
    exportCSV,
    exportSnapshotPNG,
    hasData,
    sampleCount: samples.length,
    sampleRate,
  };
}
