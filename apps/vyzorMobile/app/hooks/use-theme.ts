// use-theme.ts — RN port of the web hook. The web version subscribes to
// matchMedia + observes document.documentElement.dataset.theme; RN has neither,
// so this uses the Appearance API + a subscription to the ui-store theme
// preference (which persists via AsyncStorage). "system" resolves through
// Appearance.
import { useEffect, useSyncExternalStore } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { useUIStore } from "../store";

function subscribe(callback: () => void): () => void {
  const sub = Appearance.addChangeListener(callback);
  // Re-resolve when the user's persisted theme preference changes.
  const unsubStore = useUIStore.subscribe(callback);
  return () => {
    sub.remove();
    unsubStore();
  };
}

function getSnapshot(): "light" | "dark" {
  const pref = useUIStore.getState().theme;
  if (pref === "dark" || pref === "light") return pref;
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme(): "light" | "dark" {
  // Keep the store's theme field in sync with the resolved value so other
  // consumers reading useUIStore().theme stay accurate on RN.
  const resolved = useSyncExternalStore(subscribe, getSnapshot, () => "light" as const);
  useEffect(() => {
    const current = useUIStore.getState().theme;
    if (current !== "system" && current !== resolved) {
      useUIStore.getState().setTheme(resolved);
    }
  }, [resolved]);
  return resolved;
}
