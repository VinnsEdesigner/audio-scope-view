import { describe, it, expect } from "vitest";
import type { Session, CaptureSettingsInput } from "../types";

describe("session types", () => {
  describe("Session", () => {
    it("should have correct camelCase fields", () => {
      const session: Session = {
        id: "session-1",
        startedAt: new Date("2024-01-01T00:00:00Z"),
        recordingCount: 0,
        isOscilloscopeOpen: false,
        isSubSession: false,
        subSessionCount: 0,
      };

      expect(typeof session.id).toBe("string");
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.endedAt).toBeUndefined();
      expect(session.durationSeconds).toBeUndefined();
      expect(session.recordingCount).toBe(0);
      expect(session.isOscilloscopeOpen).toBe(false);
      expect(session.isSubSession).toBe(false);
      expect(session.subSessionCount).toBe(0);
    });

    it("should allow ended session with duration", () => {
      const session: Session = {
        id: "session-2",
        startedAt: new Date("2024-01-01T00:00:00Z"),
        endedAt: new Date("2024-01-01T01:00:00Z"),
        durationSeconds: 3600,
        recordingCount: 5,
        isOscilloscopeOpen: false,
        isSubSession: false,
        subSessionCount: 0,
      };

      expect(session.endedAt).toBeInstanceOf(Date);
      expect(session.durationSeconds).toBe(3600);
      expect(session.recordingCount).toBe(5);
    });

    it("should allow named session", () => {
      const session: Session = {
        id: "session-3",
        name: "Morning Lab Session",
        description: "Testing audio filters",
        startedAt: new Date("2024-01-01T00:00:00Z"),
        recordingCount: 3,
        isOscilloscopeOpen: true,
        oscilloscopeDurationMs: 5000,
        isSubSession: false,
        subSessionCount: 2,
        parentSessionId: undefined,
      };

      expect(session.name).toBe("Morning Lab Session");
      expect(session.description).toBe("Testing audio filters");
      expect(session.isOscilloscopeOpen).toBe(true);
      expect(session.oscilloscopeDurationMs).toBe(5000);
      expect(session.subSessionCount).toBe(2);
      expect(session.isSubSession).toBe(false);
    });

    it("should allow sub-session", () => {
      const session: Session = {
        id: "sub-session-1",
        startedAt: new Date("2024-01-01T00:00:00Z"),
        recordingCount: 1,
        isOscilloscopeOpen: false,
        isSubSession: true,
        subSessionCount: 0,
        parentSessionId: "parent-session-1",
      };

      expect(session.isSubSession).toBe(true);
      expect(session.parentSessionId).toBe("parent-session-1");
      expect(session.subSessionCount).toBe(0);
    });
  });

  describe("CaptureSettingsInput", () => {
    it("should have camelCase fields", () => {
      const input: CaptureSettingsInput = {
        frequency: 1000,
        amplitude: 0.5,
        noiseLevel: 0.02,
        durationMs: 100,
      };

      expect(input.frequency).toBe(1000);
      expect(input.amplitude).toBe(0.5);
      expect(input.noiseLevel).toBe(0.02);
      expect(input.durationMs).toBe(100);
    });

    it("should allow partial input", () => {
      const input: CaptureSettingsInput = { noiseLevel: 0.01 };

      expect(input.noiseLevel).toBe(0.01);
      expect(input.frequency).toBeUndefined();
    });
  });
});
