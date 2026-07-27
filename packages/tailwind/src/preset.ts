import type { Config } from "tailwindcss";

export const preset = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Backgrounds - Dark theme
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-hover": "var(--bg-hover)",
        "bg-active": "var(--bg-active)",

        // Text
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",

        // Accents
        "accent-primary": "var(--accent-primary)",
        "accent-hover": "var(--accent-hover)",
        "accent-muted": "var(--accent-muted)",
        "accent-rose": "var(--accent-rose)",
        "accent-rose-hover": "var(--accent-rose-hover)",

        // Semantic
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: "var(--destructive)",

        // Waveform colors
        "waveform-cyan": "#06b6d4",
        "waveform-blue": "#3b82f6",
        "waveform-purple": "#8b5cf6",
        "waveform-green": "#22c55e",
        "waveform-orange": "#f97316",
        "waveform-red": "#ef4444",
      },
      borderColor: {
        subtle: "var(--border-subtle)",
        DEFAULT: "var(--border-default)",
        hover: "var(--border-hover)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      spacing: {
        "sidebar": "var(--sidebar-width)",
      },
    },
  },
  plugins: [],
} satisfies Config;
