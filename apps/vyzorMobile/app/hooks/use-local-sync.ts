// use-local-sync.ts — pushes locally-captured (serverDirty) sessions to the
// deployed server when the app is online. This is the "sync" half of
// server-optional local mode: capture writes to Room immediately (no network
// wait), and this hook drains the dirty queue to the server via the existing
// Apollo mutations, then marks each row clean.
//
// It is a best-effort drain: a row that fails to push stays dirty and is
// retried on the next tick. The hook is mounted once (in _layout) when
// persistenceMode === "local".
import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_NAMED_SESSION, UPDATE_SESSION } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import { localStore } from "../lib/local-store";
import { useLocalSessionStore } from "../store/local-session-store";

const SYNC_INTERVAL_MS = 30_000;

export function useLocalSync(enabled: boolean) {
  const [createNamedSession] = useMutation(CREATE_NAMED_SESSION);
  const [updateSession] = useMutation(UPDATE_SESSION);
  const setSyncStatus = useLocalSessionStore((s) => s.setSyncStatus);
  const load = useLocalSessionStore((s) => s.load);
  const running = useRef(false);

  const drain = useCallback(async () => {
    if (running.current || !enabled) return;
    running.current = true;
    setSyncStatus("syncing");
    try {
      const dirty = await localStore.dirty();
      if (dirty.length === 0) {
        setSyncStatus("synced", new Date().toISOString());
        return;
      }

      for (const row of dirty) {
        try {
          // First push: create on the server with the local id.
          if (row.serverId == null) {
            await createNamedSession({
              variables: { input: { name: row.name ?? "Mobile session" } },
            });
            await localStore.markClean(row.id, row.id);
          } else {
            await updateSession({
              variables: { id: row.serverId, input: { name: row.name, description: row.description } },
            });
            await localStore.markClean(row.id, row.serverId);
          }
        } catch {
          // Leave dirty; retried next tick. Don't abort the whole drain.
        }
      }
      setSyncStatus("synced", new Date().toISOString());
      await load();
    } catch {
      setSyncStatus("error");
    } finally {
      running.current = false;
    }
  }, [enabled, createNamedSession, updateSession, setSyncStatus, load]);

  useEffect(() => {
    if (!enabled) return;
    // Drain once shortly after mount, then on an interval.
    const initial = setTimeout(() => void drain(), 2_000);
    const interval = setInterval(() => void drain(), SYNC_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [enabled, drain]);

  return { drain };
}
