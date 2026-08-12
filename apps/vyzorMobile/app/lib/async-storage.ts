// AsyncStorage shim — Zustand persist needs a storage adapter. RN 0.76
// removed the built-in AsyncStorage from core; @react-native-async-storage
// is the standard package. If it isn't installed (dev without native deps),
// fall back to an in-memory map so the store never crashes.
import { Platform } from "react-native";

type Storage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

const memory = new Map<string, string>();
const inMemory: Storage = {
  getItem: async (k) => memory.get(k) ?? null,
  setItem: async (k, v) => void memory.set(k, v),
  removeItem: async (k) => void memory.delete(k),
};

let impl: Storage = inMemory;

if (Platform.OS !== "web") {
  try {
    // Lazy require so the import doesn't break Metro when the package is
    // absent during early dev.
    const mod = require("@react-native-async-storage/async-storage");
    if (mod?.default) {
      impl = {
        getItem: (k) => mod.default.getItem(k),
        setItem: (k, v) => mod.default.setItem(k, v),
        removeItem: (k) => mod.default.removeItem(k),
      };
    }
  } catch {
    // keep inMemory
  }
}

export const AsyncStorage: Storage = impl;
