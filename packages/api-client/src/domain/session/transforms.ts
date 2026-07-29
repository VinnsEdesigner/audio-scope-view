import type { Session, SessionServer } from "./types";

export function sessionFromRaw(serverSession: SessionServer): Session {
  return {
    id: serverSession.id,
    startedAt: new Date(serverSession.started_at),
    endedAt: serverSession.ended_at ? new Date(serverSession.ended_at) : null,
    durationSeconds: serverSession.duration_seconds,
    recordingCount: serverSession.recording_count,
  };
}

export function sessionsFromRaw(serverSessions: SessionServer[]): Session[] {
  return serverSessions.map((s) => sessionFromRaw(s));
}
