import { describe, it, expect } from "vitest";
import { sessionFromRaw, sessionsFromRaw } from "../transforms";
import type { SessionServer } from "../types";

describe("session transforms", () => {
  describe("sessionFromRaw", () => {
    it("should transform server SessionServer to Session domain type", () => {
      const serverSession: SessionServer = {
        id: "session-1",
        started_at: "2024-01-01T00:00:00Z",
        ended_at: null,
        duration_seconds: null,
        recording_count: 0,
      };

      const session = sessionFromRaw(serverSession);

      expect(session.id).toBe("session-1");
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.endedAt).toBeNull();
      expect(session.durationSeconds).toBeNull();
      expect(session.recordingCount).toBe(0);
    });

    it("should handle ended session with duration", () => {
      const serverSession: SessionServer = {
        id: "session-2",
        started_at: "2024-01-01T00:00:00Z",
        ended_at: "2024-01-01T01:00:00Z",
        duration_seconds: 3600,
        recording_count: 5,
      };

      const session = sessionFromRaw(serverSession);

      expect(session.endedAt).toBeInstanceOf(Date);
      expect(session.durationSeconds).toBe(3600);
      expect(session.recordingCount).toBe(5);
    });

    it("should correctly parse ISO date strings", () => {
      const serverSession: SessionServer = {
        id: "session-3",
        started_at: "2024-03-10T12:00:00.000Z",
        ended_at: "2024-03-10T13:00:00.000Z",
        duration_seconds: 3600,
        recording_count: 3,
      };

      const session = sessionFromRaw(serverSession);

      expect(session.startedAt.getTime()).toBe(new Date("2024-03-10T12:00:00.000Z").getTime());
      expect(session.endedAt?.getTime()).toBe(new Date("2024-03-10T13:00:00.000Z").getTime());
    });
  });

  describe("sessionsFromRaw", () => {
    it("should transform array of server sessions", () => {
      const serverSessions: SessionServer[] = [
        {
          id: "session-1",
          started_at: "2024-01-01T00:00:00Z",
          ended_at: null,
          duration_seconds: null,
          recording_count: 0,
        },
        {
          id: "session-2",
          started_at: "2024-01-02T00:00:00Z",
          ended_at: "2024-01-02T01:00:00Z",
          duration_seconds: 3600,
          recording_count: 3,
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
