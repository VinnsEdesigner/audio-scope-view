import { describe, it, expect } from "vitest";
import type { Waveform, WaveformSummary, WaveformStatistics, CreateWaveformInput } from "../types";

describe("waveform types", () => {
  describe("Waveform", () => {
    it("should have correct camelCase fields", () => {
      const waveform: Waveform = {
        id: "waveform-1",
        scopeId: "scope-1",
        samples: [0.1, 0.2, 0.3],
        sampleCount: 3,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        durationMs: 100,
        peakAmplitude: 0.9,
        rmsAmplitude: 0.63,
      };

      expect(typeof waveform.id).toBe("string");
      expect(typeof waveform.scopeId).toBe("string");
      expect(Array.isArray(waveform.samples)).toBe(true);
      expect(typeof waveform.sampleCount).toBe("number");
      expect(waveform.timestamp).toBeInstanceOf(Date);
      expect(typeof waveform.durationMs).toBe("number");
      expect(typeof waveform.peakAmplitude).toBe("number");
      expect(typeof waveform.rmsAmplitude).toBe("number");
    });
  });

  describe("WaveformSummary", () => {
    it("should have correct camelCase fields", () => {
      const summary: WaveformSummary = {
        id: "summary-1",
        scopeId: "scope-1",
        sampleCount: 4096,
        timestamp: new Date("2024-01-01T00:00:00Z"),
        durationMs: 200,
        peakAmplitude: 0.88,
        rmsAmplitude: 0.62,
      };

      expect(summary.scopeId).toBe("scope-1");
      expect(summary.sampleCount).toBe(4096);
      expect(summary.timestamp).toBeInstanceOf(Date);
      expect(summary.peakAmplitude).toBe(0.88);
      expect(summary.rmsAmplitude).toBe(0.62);
    });
  });

  describe("WaveformStatistics", () => {
    it("should have correct camelCase fields", () => {
      const stats: WaveformStatistics = {
        totalCount: 50,
        totalSamples: 204_800,
        averagePeak: 0.75,
        averageRms: 0.53,
      };

      expect(stats.totalCount).toBe(50);
      expect(stats.totalSamples).toBe(204_800);
      expect(stats.averagePeak).toBe(0.75);
      expect(stats.averageRms).toBe(0.53);
    });
  });

  describe("CreateWaveformInput", () => {
    it("should require scopeId and samples", () => {
      const input: CreateWaveformInput = {
        scopeId: "scope-1",
        samples: [0.1, 0.2, 0.3],
      };

      expect(input.scopeId).toBe("scope-1");
      expect(input.samples).toEqual([0.1, 0.2, 0.3]);
    });
  });
});
