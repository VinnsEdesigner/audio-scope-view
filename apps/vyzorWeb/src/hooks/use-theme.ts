/**
 * useTheme - Hook to get current theme (light/dark)
 * Uses Tamagui's built-in theme or falls back to CSS media query
 */

import { useTheme as useTamaguiTheme } from "tamagui";

export function useTheme(): "light" | "dark" {
  const tamaguiTheme = useTamaguiTheme();

  // Check if dark theme is active via Tamagui
  if (tamaguiTheme && "name" in tamaguiTheme) {
    const themeName = tamaguiTheme.name;
    if (themeName === "dark") {
      return "dark";
    }
    if (themeName === "light") {
      return "light";
    }
  }

  // Fallback to CSS media query
  if (globalThis.window !== undefined) {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return "light";
}
