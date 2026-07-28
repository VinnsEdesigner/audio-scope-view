import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
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
}

function getSnapshot() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "dark" || theme === "light") {
    return theme;
  }
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, getSnapshot, () => "light");
}
