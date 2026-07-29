import { describe, it, expect } from "vitest";
import type { DashboardSummary, RecentSession, TimeRange } from "../types";

describe("dashboard types", () => {
  describe("DashboardSummary", () => {
    it("should have correct camelCase fields", () => {
      const summary: DashboardSummary = {
        timeRange: "last_24_hours",
        generatedAt: new Date("2024-01-01T12:00:00Z"),
        totalSessions: 10,
        activeSessions: 5,
        totalCaptures: 100,
        totalWaveforms: 200,
        totalSamples: 204_800,
        averagePeakAmplitude: 0.75,
        averageRmsAmplitude: 0.53,
        recentSessions: [],
      };

      expect(summary.timeRange).toMatch(/^(last_hour|last_24_hours|last_7_days|last_30_days)$/);
      expect(summary.generatedAt).toBeInstanceOf(Date);
      expect(typeof summary.totalSessions).toBe("number");
      expect(typeof summary.activeSessions).toBe("number");
      expect(typeof summary.totalCaptures).toBe("number");
      expect(typeof summary.totalWaveforms).toBe("number");
      expect(typeof summary.totalSamples).toBe("number");
      expect(typeof summary.averagePeakAmplitude).toBe("number");
      expect(typeof summary.averageRmsAmplitude).toBe("number");
      expect(Array.isArray(summary.recentSessions)).toBe(true);
    });

    it("should allow empty recent sessions", () => {
      const summary: DashboardSummary = {
        timeRange: "last_hour",
        generatedAt: new Date(),
        totalSessions: 0,
        activeSessions: 0,
        totalCaptures: 0,
        totalWaveforms: 0,
        totalSamples: 0,
        averagePeakAmplitude: 0,
        averageRmsAmplitude: 0,
        recentSessions: [],
      };

      expect(summary.recentSessions).toEqual([]);
    });

    it("should include multiple recent sessions", () => {
      const summary: DashboardSummary = {
        timeRange: "last_7_days",
        generatedAt: new Date(),
        totalSessions: 5,
        activeSessions: 3,
        totalCaptures: 50,
        totalWaveforms: 100,
        totalSamples: 102_400,
        averagePeakAmplitude: 0.82,
        averageRmsAmplitude: 0.58,
        recentSessions: [
          {
            id: "session-1",
            startedAt: new Date("2024-01-01T10:00:00Z"),
            recordingCount: 30,
          },
          {
            id: "session-2",
            startedAt: new Date("2024-01-01T08:00:00Z"),
            recordingCount: 20,
          },
        ],
      };

      expect(summary.recentSessions).toHaveLength(2);
      expect(summary.recentSessions[0].id).toBe("session-1");
      expect(summary.recentSessions[1].id).toBe("session-2");
    });
  });

  describe("RecentSession", () => {
    it("should have correct camelCase fields", () => {
      const recentSession: RecentSession = {
        id: "session-recent-1",
        startedAt: new Date("2024-01-01T11:30:00Z"),
        recordingCount: 15,
      };

      expect(typeof recentSession.id).toBe("string");
      expect(recentSession.startedAt).toBeInstanceOf(Date);
      expect(typeof recentSession.recordingCount).toBe("number");
    });
  });

  describe("TimeRange", () => {
    it("should allow valid time range values", () => {
      const ranges: TimeRange[] = ["last_hour", "last_24_hours", "last_7_days", "last_30_days"];

      expect(ranges).toContain("last_hour");
      expect(ranges).toContain("last_24_hours");
      expect(ranges).toContain("last_7_days");
      expect(ranges).toContain("last_30_days");
    });
  });
});
