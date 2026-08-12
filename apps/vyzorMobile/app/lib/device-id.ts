// device-id.ts — per-device anonymous identity for the mobile app (RN analog
// of api-client/src/config.ts getDeviceId, which is browser-bound: localStorage
// + window). On RN the id is persisted via AsyncStorage instead.
//
// This is NOT user-facing auth — there is no signup/login. Each device
// generates a stable random id once and persists it so all data (sessions,
// recordings, preferences) created from that device is scoped to it and never
// returned to a different device. The id is sent on every GraphQL/WebSocket
// request via the X-Device-Id header (see apollo-client.ts).
import { Platform } from "react-native";
import { AsyncStorage } from "./async-storage";

const DEVICE_ID_STORAGE_KEY = "asv:device-id";
export const DEVICE_ID_HEADER_NAME = "X-Device-Id";

function generateDeviceId(): string {
  // RN's global crypto may be absent on older targets; fall back to a
  // timestamp + Math.random id.
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let cachedDeviceId: string | undefined;
let initPromise: Promise<string | undefined> | undefined;

/**
 * Returns the stable device id for this device, creating and persisting it on
 * first use. Because AsyncStorage is async, the FIRST call may resolve before
 * the id is read — callers that need the value synchronously (e.g. the Apollo
 * link headers) should await ensureDeviceId() at app boot, then read
 * getDeviceId() which returns the cached value.
 */
export function getDeviceId(): string | undefined {
  return cachedDeviceId;
}

/**
 * Kick off (or reuse) the async load of the device id. Resolves to the id once
 * it has been read (or generated + persisted). Safe to call repeatedly; only
 * the first call actually does I/O.
 */
export function ensureDeviceId(): Promise<string | undefined> {
  if (cachedDeviceId) return Promise.resolve(cachedDeviceId);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (stored) {
        cachedDeviceId = stored;
        return stored;
      }
      const id = generateDeviceId();
      await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
      cachedDeviceId = id;
      return id;
    } catch {
      // AsyncStorage unavailable — keep an in-memory id so requests still carry one.
      if (!cachedDeviceId) cachedDeviceId = generateDeviceId();
      return cachedDeviceId;
    }
  })();
  return initPromise;
}

// Unused on RN but kept for API parity with the web getDeviceId.
export function _platform(): string {
  return Platform.OS;
}
