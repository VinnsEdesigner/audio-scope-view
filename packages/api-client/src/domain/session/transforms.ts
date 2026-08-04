import type { Session, SessionServer } from "./types";

export function sessionFromRaw(serverSession: SessionServer): Session {
  return {
    id: serverSession.id,
    name: serverSession.name,
    description: serverSession.description,
    startedAt: new Date(serverSession.startedAt),
    endedAt: serverSession.endedAt ? new Date(serverSession.endedAt) : undefined,
    durationSeconds: serverSession.durationSeconds,
    recordingCount: serverSession.recordingCount,
    isOscilloscopeOpen: serverSession.isOscilloscopeOpen,
    oscilloscopeDurationMs: serverSession.oscilloscopeDurationMs,
    parentSessionId: serverSession.parentSessionId,
    isSubSession: serverSession.isSubSession,
    autoCloseTimeoutSecs: serverSession.autoCloseTimeoutSecs,
    subSessionCount: serverSession.subSessionCount,
    peakAmplitude: serverSession.peakAmplitude,
    rmsAmplitude: serverSession.rmsAmplitude,
    dcOffset: serverSession.dcOffset,
    dominantFrequency: serverSession.dominantFrequency,
    frequencyHigh: serverSession.frequencyHigh,
    frequencyLow: serverSession.frequencyLow,
  };
}

export function sessionsFromRaw(serverSessions: SessionServer[]): Session[] {
  return serverSessions.map((s) => sessionFromRaw(s));
}
