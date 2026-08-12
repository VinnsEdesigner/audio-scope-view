// local-store.ts — typed JS wrapper over the native AudioScopeLocalStore
// module (Room SQLite on Android). This is the persistence layer for
// server-optional local mode: sessions are written here first, then synced
// to the deployed server when connectivity is available (see
// app/hooks/use-local-sync.ts).
//
// The native module returns each row as a JSON string (see
// LocalStoreModule.kt) so we parse into the same LocalSession shape the
// Apollo client uses. On non-Android platforms (web dev, Jest) the native
// module is absent; a clear thrown error lets callers fall back to the
// server path instead of crashing the store.
import { Platform } from "react-native";
import type { SessionServer } from "@audio-scope-view/api-client/domain/session";

/**
 * A session row as stored locally. Extends `SessionServer` (the wire type —
 * all timestamps are ISO strings) with the two local-only columns the Room
 * DB tracks for sync: `serverDirty` (not yet pushed) and `serverId` (the
 * server's id once pushed). The dashboard treats this identically to a
 * server session for display.
 */
export interface LocalSession extends SessionServer {
  serverDirty: boolean;
  serverId: string | null;
}

interface NativeLocalStore {
  insertSession(input: unknown): Promise<string>;
  updateSession(id: string, patch: unknown): Promise<string>;
  getSession(id: string): Promise<string>;
  listSessions(limit: number, offset: number): Promise<string>;
  countSessions(): Promise<string>;
  dirtySessions(): Promise<string>;
  markClean(id: string, serverId: string): Promise<string>;
  deleteSession(id: string): Promise<string>;
  clearAll(): Promise<string>;
}

function getNative(): NativeLocalStore {
  if (Platform.OS !== "android") {
    throw new Error(
      "AudioScopeLocalStore is only available on Android (server-optional local mode).",
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NativeModules } = require("react-native");
  const native = NativeModules.AudioScopeLocalStore as NativeLocalStore | undefined;
  if (!native) {
    throw new Error(
      "AudioScopeLocalStore native module is not registered. Rebuild the Android app.",
    );
  }
  return native;
}

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

export interface InsertSessionInput {
  id?: string;
  name?: string;
  description?: string;
  startedAt?: string;
  parentSessionId?: string;
  isSubSession?: boolean;
}

export const localStore = {
  async insert(input: InsertSessionInput): Promise<LocalSession> {
    return parse<LocalSession>(await getNative().insertSession(input));
  },

  async update(
    id: string,
    patch: Partial<Omit<LocalSession, "id" | "serverDirty" | "serverId">>,
  ): Promise<LocalSession | null> {
    return parse<LocalSession | null>(await getNative().updateSession(id, patch));
  },

  async get(id: string): Promise<LocalSession | null> {
    return parse<LocalSession | null>(await getNative().getSession(id));
  },

  async list(limit = 50, offset = 0): Promise<LocalSession[]> {
    return parse<LocalSession[]>(await getNative().listSessions(limit, offset));
  },

  async count(): Promise<number> {
    return Number(await getNative().countSessions());
  },

  async dirty(): Promise<LocalSession[]> {
    return parse<LocalSession[]>(await getNative().dirtySessions());
  },

  async markClean(id: string, serverId: string): Promise<void> {
    await getNative().markClean(id, serverId);
  },

  async delete(id: string): Promise<boolean> {
    return parse<boolean>(await getNative().deleteSession(id));
  },

  async clear(): Promise<void> {
    await getNative().clearAll();
  },
};
