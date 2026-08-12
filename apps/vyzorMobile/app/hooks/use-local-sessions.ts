// use-local-sessions.ts — the local-mode session facade. Screens call this
// instead of use-sessions.ts when persistenceMode === "local". Returns the
// same shape (data/loading/error + create/rename/end/delete) so a screen can
// switch between server and local mode with one conditional.
import { useCallback, useEffect } from "react";
import { useLocalSessionStore } from "../store/local-session-store";
import type { LocalSession, InsertSessionInput } from "../lib/local-store";

export interface UseLocalSessionsReturn {
  sessions: LocalSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: InsertSessionInput) => Promise<LocalSession | null>;
  rename: (id: string, name: string) => Promise<void>;
  end: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useLocalSessions(): UseLocalSessionsReturn {
  const sessions = useLocalSessionStore((s) => s.sessions);
  const loading = useLocalSessionStore((s) => s.loading);
  const error = useLocalSessionStore((s) => s.error);
  const load = useLocalSessionStore((s) => s.load);
  const create = useLocalSessionStore((s) => s.create);
  const rename = useLocalSessionStore((s) => s.rename);
  const end = useLocalSessionStore((s) => s.end);
  const remove = useLocalSessionStore((s) => s.remove);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { sessions, loading, error, refresh, create, rename, end, remove };
}
