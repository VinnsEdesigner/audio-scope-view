import { useCallback } from "react";
import {
  exportToCSV,
  downloadFile,
  downloadCanvasAsPNG,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";
import { useAudioAnalyzer } from "./use-audio-analyzer";

export function useExport() {
  const { samples, sampleRate, waveformData, analysisFrame } = useAudioAnalyzer();

  // Determine what data is available for export
  const hasFullSamples = samples.length > 0;
  const hasLiveData = analysisFrame.length > 0 || waveformData.length > 0;
  const hasData = hasFullSamples || hasLiveData;

  // Use full samples if available, otherwise use live analysis frame or waveform data
  const getExportData = useCallback((): { samples: Float32Array; source: string } | undefined => {
    if (hasFullSamples) {
      return { samples, source: "captured" };
    }
    if (analysisFrame.length > 0) {
      return { samples: analysisFrame, source: "live" };
    }
    if (waveformData.length > 0) {
      // Convert waveform data to Float32Array for export
      return { samples: Float32Array.from(waveformData), source: "waveform" };
    }
    return undefined;
  }, [samples, analysisFrame, waveformData, hasFullSamples]);

  const getSampleCount = (): number => {
    if (hasFullSamples) return samples.length;
    if (analysisFrame.length > 0) return analysisFrame.length;
    return waveformData.length;
  };

  const exportCSV = useCallback(() => {
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

      downloadFile(csvContent, filename, "text/csv");

      return { success: true, filename };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export CSV";
      return { success: false, error: message };
    }
  }, [getExportData, sampleRate]);

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

  return {
    exportCSV,
    exportSnapshotPNG,
    hasData,
    sampleCount: getSampleCount(),
    sampleRate,
  };
}
