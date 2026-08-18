// className merge utility — mirrors @audio-scope-view/ui-radix's cn() so
// mobile components use the same className composition as the web (clsx +
// tailwind-merge against the shared Tailwind preset).
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
