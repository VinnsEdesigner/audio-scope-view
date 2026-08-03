import { describe, it, expect } from "vitest";
import { sessionFromRaw, sessionsFromRaw } from "../transforms";
import type { SessionServer } from "../types";

describe("session transforms", () => {
  describe("sessionFromRaw", () => {
    it("should transform server SessionServer to Session domain type", () => {
      const serverSession: SessionServer = {
        id: "session-1",
        startedAt: "2024-01-01T00:00:00Z",
        recordingCount: 0,
        isOscilloscopeOpen: false,
        isSubSession: false,
        subSessionCount: 0,
      };

      const session = sessionFromRaw(serverSession);

      expect(session.id).toBe("session-1");
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.endedAt).toBeUndefined();
      expect(session.durationSeconds).toBeUndefined();
      expect(session.recordingCount).toBe(0);
      expect(session.isOscilloscopeOpen).toBe(false);
      expect(session.isSubSession).toBe(false);
      expect(session.subSessionCount).toBe(0);
    });

    it("should handle ended session with duration", () => {
      const serverSession: SessionServer = {
        id: "session-2",
        startedAt: "2024-01-01T00:00:00Z",
        endedAt: "2024-01-01T01:00:00Z",
        durationSeconds: 3600,
        recordingCount: 5,
        isOscilloscopeOpen: false,
        isSubSession: false,
        subSessionCount: 0,
      };

      const session = sessionFromRaw(serverSession);

      expect(session.endedAt).toBeInstanceOf(Date);
      expect(session.durationSeconds).toBe(3600);
      expect(session.recordingCount).toBe(5);
    });

    it("should correctly parse ISO date strings", () => {
      const serverSession: SessionServer = {
        id: "session-3",
        startedAt: "2024-03-10T12:00:00.000Z",
        endedAt: "2024-03-10T13:00:00.000Z",
        durationSeconds: 3600,
        recordingCount: 3,
        isOscilloscopeOpen: true,
        oscilloscopeDurationMs: 5000,
        isSubSession: false,
        subSessionCount: 2,
      };

      const session = sessionFromRaw(serverSession);

      expect(session.startedAt.getTime()).toBe(new Date("2024-03-10T12:00:00.000Z").getTime());
      expect(session.endedAt?.getTime()).toBe(new Date("2024-03-10T13:00:00.000Z").getTime());
      expect(session.isOscilloscopeOpen).toBe(true);
      expect(session.oscilloscopeDurationMs).toBe(5000);
      expect(session.subSessionCount).toBe(2);
    });

    it("should handle named session", () => {
      const serverSession: SessionServer = {
        id: "session-4",
        name: "Morning Lab",
        description: "Testing audio filters",
        startedAt: "2024-01-01T00:00:00Z",
        recordingCount: 2,
        isOscilloscopeOpen: false,
        isSubSession: false,
        subSessionCount: 1,
      };

      const session = sessionFromRaw(serverSession);

      expect(session.name).toBe("Morning Lab");
      expect(session.description).toBe("Testing audio filters");
      expect(session.subSessionCount).toBe(1);
    });

    it("should handle sub-session", () => {
      const serverSession: SessionServer = {
        id: "sub-session-1",
        startedAt: "2024-01-01T00:00:00Z",
        recordingCount: 1,
        isOscilloscopeOpen: false,
        isSubSession: true,
        subSessionCount: 0,
        parentSessionId: "parent-session-1",
      };

      const session = sessionFromRaw(serverSession);

      expect(session.isSubSession).toBe(true);
      expect(session.parentSessionId).toBe("parent-session-1");
      expect(session.subSessionCount).toBe(0);
    });
  });

  describe("sessionsFromRaw", () => {
    it("should transform array of server sessions", () => {
      const serverSessions: SessionServer[] = [
        {
          id: "session-1",
          startedAt: "2024-01-01T00:00:00Z",
          recordingCount: 0,
          isOscilloscopeOpen: false,
          isSubSession: false,
          subSessionCount: 0,
        },
        {
          id: "session-2",
          startedAt: "2024-01-02T00:00:00Z",
          endedAt: "2024-01-02T01:00:00Z",
          durationSeconds: 3600,
          recordingCount: 3,
          isOscilloscopeOpen: false,
          isSubSession: false,
          subSessionCount: 0,
        },
      ];

      const sessions = sessionsFromRaw(serverSessions);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe("session-1");
      expect(sessions[1].id).toBe("session-2");
      expect(sessions[0].recordingCount).toBe(0);
      expect(sessions[1].recordingCount).toBe(3);
    });
  });
});
