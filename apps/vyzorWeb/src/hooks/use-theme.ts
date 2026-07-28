import { useSyncExternalStore } from "react";

/* eslint-disable unicorn/consistent-function-scoping */
export function useTheme(): "light" | "dark" {
  const subscribe = (callback: () => void) => {
    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", callback);

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
    const theme = document.documentElement.dataset.theme;
    if (theme === "dark" || theme === "light") {
      return theme;
    }
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => "light");
}
