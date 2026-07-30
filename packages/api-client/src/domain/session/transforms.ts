import type { Session, SessionServer } from "./types";

export function sessionFromRaw(serverSession: SessionServer): Session {
  return {
    id: serverSession.id,
    startedAt: new Date(serverSession.startedAt),
    endedAt: serverSession.endedAt ? new Date(serverSession.endedAt) : undefined,
    durationSeconds: serverSession.durationSeconds,
    recordingCount: serverSession.recordingCount,
  };
}

export function sessionsFromRaw(serverSessions: SessionServer[]): Session[] {
  return serverSessions.map((s) => sessionFromRaw(s));
}
