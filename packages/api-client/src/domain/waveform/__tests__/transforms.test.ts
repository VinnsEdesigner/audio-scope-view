import { describe, it, expect } from "vitest";
import {
  waveformFromRaw,
  waveformSummaryFromRaw,
  waveformStatisticsFromRaw,
  computeWaveformStats,
  resampleWaveform,
  waveformToTimeDomain,
} from "../transforms";
import type { WaveformServer, WaveformSummaryServer, WaveformStatisticsServer } from "../types";

describe("waveform transforms", () => {
  describe("waveformFromRaw", () => {
    it("should transform server WaveformServer to Waveform domain type", () => {
      const serverWaveform: WaveformServer = {
        id: "waveform-1",
        scope_id: "scope-1",
        samples: [0.1, 0.2, 0.3, 0.4, 0.5],
        sample_count: 5,
        timestamp: "2024-01-01T12:00:00Z",
        duration_ms: 100,
        peak_amplitude: 0.9,
        rms_amplitude: 0.63,
      };

      const waveform = waveformFromRaw(serverWaveform);

      expect(waveform.id).toBe("waveform-1");
      expect(waveform.scopeId).toBe("scope-1");
      expect(waveform.samples).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(waveform.sampleCount).toBe(5);
      expect(waveform.timestamp).toBeInstanceOf(Date);
      expect(waveform.durationMs).toBe(100);
      expect(waveform.peakAmplitude).toBe(0.9);
      expect(waveform.rmsAmplitude).toBe(0.63);
    });

    it("should handle empty samples array", () => {
      const serverWaveform: WaveformServer = {
        id: "waveform-empty",
        scope_id: "scope-1",
        samples: [],
        sample_count: 0,
        timestamp: "2024-01-01T12:00:00Z",
        duration_ms: 0,
        peak_amplitude: 0,
        rms_amplitude: 0,
      };

      const waveform = waveformFromRaw(serverWaveform);

      expect(waveform.samples).toEqual([]);
      expect(waveform.sampleCount).toBe(0);
    });
  });

  describe("waveformSummaryFromRaw", () => {
    it("should transform server WaveformSummary to domain type", () => {
      const serverSummary: WaveformSummaryServer = {
        id: "summary-1",
        scope_id: "scope-1",
        sample_count: 4096,
        timestamp: "2024-02-20T15:00:00Z",
        duration_ms: 200,
        peak_amplitude: 0.88,
        rms_amplitude: 0.62,
      };

      const summary = waveformSummaryFromRaw(serverSummary);

      expect(summary.id).toBe("summary-1");
      expect(summary.scopeId).toBe("scope-1");
      expect(summary.sampleCount).toBe(4096);
      expect(summary.timestamp).toBeInstanceOf(Date);
      expect(summary.durationMs).toBe(200);
      expect(summary.peakAmplitude).toBe(0.88);
      expect(summary.rmsAmplitude).toBe(0.62);
    });
  });

  describe("waveformStatisticsFromRaw", () => {
    it("should transform server statistics to domain type", () => {
      const serverStats: WaveformStatisticsServer = {
        total_count: 50,
        total_samples: 204_800,
        average_peak: 0.75,
        average_rms: 0.53,
      };

      const stats = waveformStatisticsFromRaw(serverStats);

      expect(stats.totalCount).toBe(50);
      expect(stats.totalSamples).toBe(204_800);
      expect(stats.averagePeak).toBe(0.75);
      expect(stats.averageRms).toBe(0.53);
    });
  });

  describe("computeWaveformStats", () => {
    it("should compute correct statistics for samples", () => {
      const samples = [1, 2, 3, 4, 5];
      const stats = computeWaveformStats(samples);

      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.mean).toBe(3);
    });

    it("should handle empty array", () => {
      const stats = computeWaveformStats([]);

      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.mean).toBe(0);
    });

    it("should handle single sample", () => {
      const stats = computeWaveformStats([5]);

      expect(stats.min).toBe(5);
      expect(stats.max).toBe(5);
      expect(stats.mean).toBe(5);
    });

    it("should handle negative values", () => {
      const samples = [-3, -2, -1, 0, 1, 2, 3];
      const stats = computeWaveformStats(samples);

      expect(stats.min).toBe(-3);
      expect(stats.max).toBe(3);
    });

    it("should handle audio-like samples (centered around 0)", () => {
      const samples = [-0.5, 0, 0.5, -0.25, 0.25];
      const stats = computeWaveformStats(samples);

      expect(stats.min).toBeCloseTo(-0.5);
      expect(stats.max).toBeCloseTo(0.5);
      expect(stats.mean).toBeCloseTo(0);
    });
  });

  describe("resampleWaveform", () => {
    it("should return same array if length matches", () => {
      const samples = [1, 2, 3, 4, 5];
      const targetLength = 5;

      const resampled = resampleWaveform(samples, targetLength);

      expect(resampled).toEqual(samples);
    });

    it("should upsample waveform with linear interpolation", () => {
      const samples = [0, 1, 0, -1, 0];
      const targetLength = 10;

      const resampled = resampleWaveform(samples, targetLength);

      expect(resampled).toHaveLength(10);
      expect(resampled[0]).toBe(0);
    });

    it("should downsample waveform", () => {
      const samples = [
        0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75, -1, -0.75, -0.5, -0.25,
      ];
      const targetLength = 4;

      const resampled = resampleWaveform(samples, targetLength);

      expect(resampled).toHaveLength(4);
    });

    it("should handle empty array", () => {
      const resampled = resampleWaveform([], 10);

      expect(resampled).toEqual([]);
    });

    it("should handle zero target length", () => {
      const samples = [1, 2, 3];
      const resampled = resampleWaveform(samples, 0);

      expect(resampled).toEqual([]);
    });
  });

  describe("waveformToTimeDomain", () => {
    it("should convert waveform samples to time domain", () => {
      const waveform = {
        samples: [0, 0.5, 1, 0.5, 0],
        sampleRate: 1000,
      };

      const timeDomain = waveformToTimeDomain(waveform);

      expect(timeDomain).toHaveLength(5);
      expect(timeDomain[0].amplitude).toBe(0);
      expect(timeDomain[1].amplitude).toBe(0.5);
      expect(timeDomain[2].amplitude).toBe(1);
    });

    it("should calculate correct time intervals", () => {
      const waveform = {
        samples: [0, 1, 0],
        sampleRate: 1000,
      };

      const timeDomain = waveformToTimeDomain(waveform);

      expect(timeDomain[0].time).toBe(0);
      expect(timeDomain[1].time).toBe(1);
      expect(timeDomain[2].time).toBe(2);
    });

    it("should handle empty samples", () => {
      const waveform = {
        samples: [],
        sampleRate: 1000,
      };

      const timeDomain = waveformToTimeDomain(waveform);

      expect(timeDomain).toEqual([]);
    });
  });
});
