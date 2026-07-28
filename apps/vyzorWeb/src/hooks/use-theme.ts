/**
 * useTheme - Hook to get current resolved theme (light/dark)
 * Uses CSS custom properties and media query for theme detection
 */

import { useSyncExternalStore } from "react";

export function useTheme(): "light" | "dark" {
  // Subscribe to both CSS media query changes and data-theme attribute changes
  const subscribe = (callback: () => void) => {
    // Listen to CSS media query changes
    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", callback);

    // Listen to data-theme attribute changes on document
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      mediaQuery.removeEventListener("change", callback);
      observer.disconnect();
    };
  };

  const getSnapshot = () => {
    // Priority: data-theme attribute > system preference
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "dark" || theme === "light") {
      return theme;
    }
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => "light");
}
