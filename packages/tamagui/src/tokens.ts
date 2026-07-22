// Audio Scope View - Tamagui Design Tokens
// Pure neutral palette: white, gray, black only
// Browser-native color-scheme for automatic light/dark adaptation

export const tokens = {
  // Neutral grayscale palette
  color: {
    // Canvas/CanvasText are browser-native and adapt to light/dark automatically
    // We'll define neutral grays for UI elements that need explicit colors

    // Light mode neutrals (will be overridden in dark theme)
    white: "#ffffff",
    black: "#000000",

    // Gray scale - neutral grays
    gray1: "#ffffff",
    gray2: "#f5f5f5",
    gray3: "#e5e5e5",
    gray4: "#d5d5d5",
    gray5: "#c5c5c5",
    gray6: "#a5a5a5",
    gray7: "#858585",
    gray8: "#666666",
    gray9: "#525252",
    gray10: "#404040",
    gray11: "#333333",
    gray12: "#1a1a1a",
    gray13: "#0a0a0a",

    // Semantic aliases (neutral only)
    background: "Canvas",
    foreground: "CanvasText",
    card: "Canvas",
    cardForeground: "CanvasText",
    popover: "Canvas",
    popoverForeground: "CanvasText",

    // Primary = foreground (text) on background
    primary: "CanvasText",
    primaryForeground: "Canvas",

    // Accent - subtle gray mix
    accent: "color-mix(in oklab, CanvasText 10%, Canvas)",
    accentForeground: "CanvasText",

    // Secondary - slightly more visible
    secondary: "color-mix(in oklab, CanvasText 8%, Canvas)",
    secondaryForeground: "CanvasText",

    // Muted - very subtle
    muted: "color-mix(in oklab, CanvasText 6%, Canvas)",
    mutedForeground: "color-mix(in oklab, CanvasText 55%, Canvas)",

    // Destructive = same as primary (text on background)
    destructive: "CanvasText",
    destructiveForeground: "Canvas",

    // Borders and inputs
    border: "color-mix(in oklab, CanvasText 15%, transparent)",
    input: "color-mix(in oklab, CanvasText 20%, transparent)",
    ring: "CanvasText",

    // Neutral for prominent actions (avoids pure white/black flip in dark)
    neutral: "color-mix(in oklab, CanvasText 32%, Canvas)",
    neutralStrong: "color-mix(in oklab, CanvasText 45%, Canvas)",
    neutralForeground: "CanvasText",

    // Scope/waveform
    scopeBackground: "Canvas",
    scopeTrace: "#3b82f6",
    scopeGrid: "color-mix(in oklab, CanvasText 15%, transparent)",

    // Waveform trace colors (blue, red, teal)
    traceBlue: "#3b82f6",
    traceRed: "#ef4444",
    traceTeal: "#14b8a6",
  },

  // Spacing
  space: {
    zero: 0,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  // Border Radius
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    "2xl": 24,
    full: 9999,
  },

  // Font Sizes
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    "2xl": 20,
    "3xl": 24,
    "4xl": 32,
    "5xl": 40,
  },

  // Line Heights
  lineHeight: {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
    "2xl": 28,
    "3xl": 32,
    "4xl": 40,
    "5xl": 48,
  },

  // Font Weights
  fontWeight: {
    light: "300" as const,
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },

  // Letter Spacing
  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
  },

  // Sizes
  size: {
    height: {
      sm: 32,
      md: 40,
      lg: 48,
    },
    width: {
      sm: 32,
      md: 40,
      lg: 48,
    },
  },

  // Z-Index
  zIndex: {
    hidden: -1,
    base: 0,
    raised: 1,
    overlay: 10,
    modal: 20,
    popover: 30,
    toast: 40,
    tooltip: 50,
  },
} as const;

export type Tokens = typeof tokens;
