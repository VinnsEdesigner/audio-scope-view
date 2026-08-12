// local-session-store.ts — the local-mode session state. Mirrors what the
// server-backed hooks (use-sessions.ts) provide, but reads/writes the
// on-device Room store via local-store.ts instead of Apollo. The scope and
// dashboard screens consume this when persistenceMode === "local".
import { create } from "zustand";
import { localStore, type LocalSession, type InsertSessionInput } from "../lib/local-store";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface LocalSessionState {
  sessions: LocalSession[];
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;

  load: () => Promise<void>;
  create: (input: InsertSessionInput) => Promise<LocalSession | null>;
  rename: (id: string, name: string) => Promise<void>;
  end: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setSyncStatus: (s: SyncStatus, syncedAt?: string) => void;
}

export const useLocalSessionStore = create<LocalSessionState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  syncStatus: "idle",
  lastSyncedAt: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const sessions = await localStore.list(100, 0);
      set({ sessions, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  create: async (input) => {
    try {
      const session = await localStore.insert(input);
      set({ sessions: [session, ...get().sessions] });
      return session;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },

  rename: async (id, name) => {
    const updated = await localStore.update(id, { name });
    if (updated) {
      set({
        sessions: get().sessions.map((s) => (s.id === id ? updated : s)),
      });
    }
  },

  end: async (id) => {
    const updated = await localStore.update(id, {
      endedAt: new Date().toISOString(),
    });
    if (updated) {
      set({
        sessions: get().sessions.map((s) => (s.id === id ? updated : s)),
      });
    }
  },

  remove: async (id) => {
    await localStore.delete(id);
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },

  setSyncStatus: (syncStatus, syncedAt) =>
    set({
      syncStatus,
      lastSyncedAt: syncedAt ?? get().lastSyncedAt,
    }),
}));
