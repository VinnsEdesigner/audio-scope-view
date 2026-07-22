import { describe, it, expect } from "vitest";
import {
  recentScopeFromRaw,
  dashboardSummaryFromRaw,
  formatRelativeTime,
  timeRangeToString,
} from "../transforms";
import type { RecentScopeServer, DashboardSummaryServer, TimeRange } from "../types";

describe("dashboard transforms", () => {
  describe("recentScopeFromRaw", () => {
    it("should transform server RecentScopeServer to RecentScope domain type", () => {
      const serverScope: RecentScopeServer = {
        id: "scope-1",
        name: "Recent Scope",
        last_activity: "2024-01-15T10:30:00Z",
        waveform_count: 25,
      };

      const recentScope = recentScopeFromRaw(serverScope);

      expect(recentScope.id).toBe("scope-1");
      expect(recentScope.name).toBe("Recent Scope");
      expect(recentScope.lastActivity).toBeInstanceOf(Date);
      expect(recentScope.waveformCount).toBe(25);
    });
  });

  describe("dashboardSummaryFromRaw", () => {
    it("should transform server DashboardSummaryServer to domain type", () => {
      const serverSummary: DashboardSummaryServer = {
        time_range: "last_24_hours",
        generated_at: "2024-01-15T12:00:00Z",
        total_scopes: 10,
        active_scopes: 5,
        total_captures: 100,
        total_waveforms: 200,
        total_samples: 204_800,
        average_peak_amplitude: 0.75,
        average_rms_amplitude: 0.53,
        recent_scopes: [
          {
            id: "scope-1",
            name: "Recent 1",
            last_activity: "2024-01-15T08:00:00Z",
            waveform_count: 10,
          },
          {
            id: "scope-2",
            name: "Recent 2",
            last_activity: "2024-01-15T06:00:00Z",
            waveform_count: 8,
          },
        ],
      };

      const summary = dashboardSummaryFromRaw(serverSummary);

      expect(summary.timeRange).toBe("last_24_hours");
      expect(summary.generatedAt).toBeInstanceOf(Date);
      expect(summary.totalScopes).toBe(10);
      expect(summary.activeScopes).toBe(5);
      expect(summary.totalCaptures).toBe(100);
      expect(summary.totalWaveforms).toBe(200);
      expect(summary.totalSamples).toBe(204_800);
      expect(summary.averagePeakAmplitude).toBe(0.75);
      expect(summary.averageRmsAmplitude).toBe(0.53);
      expect(summary.recentScopes).toHaveLength(2);
      expect(summary.recentScopes[0].id).toBe("scope-1");
      expect(summary.recentScopes[1].id).toBe("scope-2");
    });

    it("should handle empty recent scopes", () => {
      const serverSummary: DashboardSummaryServer = {
        time_range: "last_hour",
        generated_at: "2024-01-15T12:00:00Z",
        total_scopes: 0,
        active_scopes: 0,
        total_captures: 0,
        total_waveforms: 0,
        total_samples: 0,
        average_peak_amplitude: 0,
        average_rms_amplitude: 0,
        recent_scopes: [],
      };

      const summary = dashboardSummaryFromRaw(serverSummary);

      expect(summary.recentScopes).toEqual([]);
      expect(summary.totalScopes).toBe(0);
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
