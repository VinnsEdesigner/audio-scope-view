import { describe, it, expect } from "vitest";
import {
  recentSessionFromRaw,
  dashboardSummaryFromRaw,
  formatRelativeTime,
  timeRangeToString,
} from "../transforms";
import type { RecentSessionServer, DashboardSummaryServer, TimeRange } from "../types";

describe("dashboard transforms", () => {
  describe("recentSessionFromRaw", () => {
    it("should transform server RecentSessionServer to RecentSession domain type", () => {
      const serverSession: RecentSessionServer = {
        id: "session-1",
        started_at: "2024-01-15T10:30:00Z",
        recording_count: 25,
      };

      const recentSession = recentSessionFromRaw(serverSession);

      expect(recentSession.id).toBe("session-1");
      expect(recentSession.startedAt).toBeInstanceOf(Date);
      expect(recentSession.recordingCount).toBe(25);
    });
  });

  describe("dashboardSummaryFromRaw", () => {
    it("should transform server DashboardSummaryServer to domain type", () => {
      const serverSummary: DashboardSummaryServer = {
        time_range: "last_24_hours",
        generated_at: "2024-01-15T12:00:00Z",
        total_sessions: 10,
        active_sessions: 5,
        total_captures: 100,
        total_waveforms: 200,
        total_samples: 204_800,
        average_peak_amplitude: 0.75,
        average_rms_amplitude: 0.53,
        recent_sessions: [
          {
            id: "session-1",
            started_at: "2024-01-15T08:00:00Z",
            recording_count: 10,
          },
          {
            id: "session-2",
            started_at: "2024-01-15T06:00:00Z",
            recording_count: 8,
          },
        ],
      };

      const summary = dashboardSummaryFromRaw(serverSummary);

      expect(summary.timeRange).toBe("last_24_hours");
      expect(summary.generatedAt).toBeInstanceOf(Date);
      expect(summary.totalSessions).toBe(10);
      expect(summary.activeSessions).toBe(5);
      expect(summary.totalCaptures).toBe(100);
      expect(summary.totalWaveforms).toBe(200);
      expect(summary.totalSamples).toBe(204_800);
      expect(summary.averagePeakAmplitude).toBe(0.75);
      expect(summary.averageRmsAmplitude).toBe(0.53);
      expect(summary.recentSessions).toHaveLength(2);
      expect(summary.recentSessions[0].id).toBe("session-1");
      expect(summary.recentSessions[1].id).toBe("session-2");
    });

    it("should handle empty recent sessions", () => {
      const serverSummary: DashboardSummaryServer = {
        time_range: "last_hour",
        generated_at: "2024-01-15T12:00:00Z",
        total_sessions: 0,
        active_sessions: 0,
        total_captures: 0,
        total_waveforms: 0,
        total_samples: 0,
        average_peak_amplitude: 0,
        average_rms_amplitude: 0,
        recent_sessions: [],
      };

      const summary = dashboardSummaryFromRaw(serverSummary);

      expect(summary.recentSessions).toEqual([]);
      expect(summary.totalSessions).toBe(0);
    });
  });

  describe("formatRelativeTime", () => {
    it("should return 'Just now' for recent times", () => {
      const now = new Date();
      const result = formatRelativeTime(now);

      expect(result).toBe("Just now");
    });

    it("should return minutes for times less than an hour", () => {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const result = formatRelativeTime(thirtyMinsAgo);

      expect(result).toMatch(/\d+m ago/);
    });

    it("should return hours for times less than a day", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoHoursAgo);

      expect(result).toMatch(/\d+h ago/);
    });

    it("should return days for times less than a week", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeDaysAgo);

      expect(result).toMatch(/\d+d ago/);
    });
  });

  describe("timeRangeToString", () => {
    it("should return correct string for TimeRange", () => {
      const ranges: TimeRange[] = ["last_hour", "last_24_hours", "last_7_days", "last_30_days"];

      for (const range of ranges) {
        expect(timeRangeToString(range)).toBe(range);
      }
    });
  });
});
