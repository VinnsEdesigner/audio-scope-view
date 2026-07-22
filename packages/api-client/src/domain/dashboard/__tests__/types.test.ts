import { describe, it, expect } from "vitest";
import type { DashboardSummary, RecentScope, TimeRange } from "../types";

describe("dashboard types", () => {
  describe("DashboardSummary", () => {
    it("should have correct camelCase fields", () => {
      const summary: DashboardSummary = {
        timeRange: "last_24_hours",
        generatedAt: new Date("2024-01-01T12:00:00Z"),
        totalScopes: 10,
        activeScopes: 5,
        totalCaptures: 100,
        totalWaveforms: 200,
        totalSamples: 204_800,
        averagePeakAmplitude: 0.75,
        averageRmsAmplitude: 0.53,
        recentScopes: [],
      };

      expect(summary.timeRange).toMatch(/^(last_hour|last_24_hours|last_7_days|last_30_days)$/);
      expect(summary.generatedAt).toBeInstanceOf(Date);
      expect(typeof summary.totalScopes).toBe("number");
      expect(typeof summary.activeScopes).toBe("number");
      expect(typeof summary.totalCaptures).toBe("number");
      expect(typeof summary.totalWaveforms).toBe("number");
      expect(typeof summary.totalSamples).toBe("number");
      expect(typeof summary.averagePeakAmplitude).toBe("number");
      expect(typeof summary.averageRmsAmplitude).toBe("number");
      expect(Array.isArray(summary.recentScopes)).toBe(true);
    });

    it("should allow empty recent scopes", () => {
      const summary: DashboardSummary = {
        timeRange: "last_hour",
        generatedAt: new Date(),
        totalScopes: 0,
        activeScopes: 0,
        totalCaptures: 0,
        totalWaveforms: 0,
        totalSamples: 0,
        averagePeakAmplitude: 0,
        averageRmsAmplitude: 0,
        recentScopes: [],
      };

      expect(summary.recentScopes).toEqual([]);
    });

    it("should include multiple recent scopes", () => {
      const summary: DashboardSummary = {
        timeRange: "last_7_days",
        generatedAt: new Date(),
        totalScopes: 5,
        activeScopes: 3,
        totalCaptures: 50,
        totalWaveforms: 100,
        totalSamples: 102_400,
        averagePeakAmplitude: 0.82,
        averageRmsAmplitude: 0.58,
        recentScopes: [
          {
            id: "scope-1",
            name: "Scope One",
            lastActivity: new Date("2024-01-01T10:00:00Z"),
            waveformCount: 30,
          },
          {
            id: "scope-2",
            name: "Scope Two",
            lastActivity: new Date("2024-01-01T08:00:00Z"),
            waveformCount: 20,
          },
        ],
      };

      expect(summary.recentScopes).toHaveLength(2);
      expect(summary.recentScopes[0].id).toBe("scope-1");
      expect(summary.recentScopes[1].id).toBe("scope-2");
    });
  });

  describe("RecentScope", () => {
    it("should have correct camelCase fields", () => {
      const recentScope: RecentScope = {
        id: "scope-recent-1",
        name: "Recently Active",
        lastActivity: new Date("2024-01-01T11:30:00Z"),
        waveformCount: 15,
      };

      expect(typeof recentScope.id).toBe("string");
      expect(typeof recentScope.name).toBe("string");
      expect(recentScope.lastActivity).toBeInstanceOf(Date);
      expect(typeof recentScope.waveformCount).toBe("number");
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
