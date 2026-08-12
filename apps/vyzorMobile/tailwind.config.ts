import type { Config } from "tailwindcss";
import { preset } from "@audio-scope-view/tailwind/preset";

// Mobile shares the web app's Tailwind design tokens via the
// @audio-scope-view/tailwind preset package. NativeWind v4 (Tailwind v3
// engine) consumes this config; `nativewind/metro` compiles it to RN styles.
export default {
  presets: [preset],
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
