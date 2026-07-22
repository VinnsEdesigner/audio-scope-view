import { createTamagui, createTokens, createTheme, createFont } from "tamagui";
import { tokens } from "./tokens";

// Create tamagui tokens from our design tokens
const tamaguiTokens = createTokens({
  color: {
    // Base neutrals
    white: tokens.color.white,
    black: tokens.color.black,
    gray1: tokens.color.gray1,
    gray2: tokens.color.gray2,
    gray3: tokens.color.gray3,
    gray4: tokens.color.gray4,
    gray5: tokens.color.gray5,
    gray6: tokens.color.gray6,
    gray7: tokens.color.gray7,
    gray8: tokens.color.gray8,
    gray9: tokens.color.gray9,
    gray10: tokens.color.gray10,
    gray11: tokens.color.gray11,
    gray12: tokens.color.gray12,
    gray13: tokens.color.gray13,

    // Semantic aliases
    background: tokens.color.background,
    foreground: tokens.color.foreground,
    card: tokens.color.card,
    cardForeground: tokens.color.cardForeground,
    popover: tokens.color.popover,
    popoverForeground: tokens.color.popoverForeground,
    primary: tokens.color.primary,
    primaryForeground: tokens.color.primaryForeground,
    accent: tokens.color.accent,
    accentForeground: tokens.color.accentForeground,
    secondary: tokens.color.secondary,
    secondaryForeground: tokens.color.secondaryForeground,
    muted: tokens.color.muted,
    mutedForeground: tokens.color.mutedForeground,
    destructive: tokens.color.destructive,
    destructiveForeground: tokens.color.destructiveForeground,
    border: tokens.color.border,
    input: tokens.color.input,
    ring: tokens.color.ring,

    // Neutral actions
    neutral: tokens.color.neutral,
    neutralStrong: tokens.color.neutralStrong,
    neutralForeground: tokens.color.neutralForeground,

    // Waveform/scope
    scopeBackground: tokens.color.scopeBackground,
    scopeTrace: tokens.color.scopeTrace,
    scopeGrid: tokens.color.scopeGrid,

    // Waveform trace colors (blue, red, teal)
    traceBlue: tokens.color.traceBlue,
    traceRed: tokens.color.traceRed,
    traceTeal: tokens.color.traceTeal,
  },
  space: {
    zero: tokens.space.zero,
    xs: tokens.space.xs,
    sm: tokens.space.sm,
    md: tokens.space.md,
    true: tokens.space.md,
    lg: tokens.space.lg,
    xl: tokens.space.xl,
    xxl: tokens.space.xxl,
    xxxl: tokens.space.xxxl,
  },
  size: {
    zero: tokens.size.zero,
    xs: tokens.size.xs,
    sm: tokens.size.sm,
    md: tokens.size.md,
    true: tokens.size.md,
    lg: tokens.size.lg,
    xl: tokens.size.xl,
    xxl: tokens.size.xxl,
  },
  radius: {
    none: tokens.radius.none,
    sm: tokens.radius.sm,
    md: tokens.radius.md,
    lg: tokens.radius.lg,
    xl: tokens.radius.xl,
    "2xl": tokens.radius["2xl"],
    full: tokens.radius.full,
  },
  fontSize: {
    xs: tokens.fontSize.xs,
    sm: tokens.fontSize.sm,
    md: tokens.fontSize.md,
    lg: tokens.fontSize.lg,
    xl: tokens.fontSize.xl,
    "2xl": tokens.fontSize["2xl"],
    "3xl": tokens.fontSize["3xl"],
    "4xl": tokens.fontSize["4xl"],
    "5xl": tokens.fontSize["5xl"],
  },
  lineHeight: {
    xs: tokens.lineHeight.xs,
    sm: tokens.lineHeight.sm,
    md: tokens.lineHeight.md,
    lg: tokens.lineHeight.lg,
    xl: tokens.lineHeight.xl,
    "2xl": tokens.lineHeight["2xl"],
    "3xl": tokens.lineHeight["3xl"],
    "4xl": tokens.lineHeight["4xl"],
    "5xl": tokens.lineHeight["5xl"],
  },
  fontWeight: {
    light: tokens.fontWeight.light,
    normal: tokens.fontWeight.normal,
    medium: tokens.fontWeight.medium,
    semibold: tokens.fontWeight.semibold,
    bold: tokens.fontWeight.bold,
  },
});

const bodyFont = createFont({
  family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  size: {
    xs: 10, sm: 12, md: 14, true: 14, lg: 16, xl: 18,
    "2xl": 20, "3xl": 24, "4xl": 32, "5xl": 40,
  },
  lineHeight: {
    xs: 14, sm: 16, md: 20, true: 20, lg: 24, xl: 28,
    "2xl": 28, "3xl": 32, "4xl": 40, "5xl": 48,
  },
  weight: { normal: "400", medium: "500", semibold: "600", bold: "700", true: "400" },
  letterSpacing: { normal: 0, true: 0 },
});

const monoFont = createFont({
  family: "ui-monospace, SFMono-Regular, Menlo, monospace",
  size: {
    xs: 10, sm: 12, md: 14, true: 14, lg: 16, xl: 18,
    "2xl": 20, "3xl": 24, "4xl": 32, "5xl": 40,
  },
  lineHeight: {
    xs: 14, sm: 16, md: 20, true: 20, lg: 24, xl: 28,
    "2xl": 28, "3xl": 32, "4xl": 40, "5xl": 48,
  },
  weight: { normal: "400", medium: "500", true: "400" },
  letterSpacing: { normal: 0, true: 0 },
});

// Light theme - uses browser Canvas/CanvasText natively
export const lightTheme = createTheme({
  // Background
  background: tokens.color.background,
  backgroundHover: "color-mix(in oklab, CanvasText 5%, Canvas)",
  backgroundPress: "color-mix(in oklab, CanvasText 10%, Canvas)",
  backgroundElevated: tokens.color.card,

  // Foreground
  color: tokens.color.foreground,
  colorHover: tokens.color.foreground,
  colorPress: tokens.color.foreground,

  // Borders
  borderColor: tokens.color.border,
  borderColorHover: "color-mix(in oklab, CanvasText 25%, transparent)",

  // Semantic
  primary: tokens.color.primary,
  primaryForeground: tokens.color.primaryForeground,
  secondary: tokens.color.secondary,
  secondaryForeground: tokens.color.secondaryForeground,
  muted: tokens.color.muted,
  mutedForeground: tokens.color.mutedForeground,
  accent: tokens.color.accent,
  accentForeground: tokens.color.accentForeground,
  destructive: tokens.color.destructive,
  destructiveForeground: tokens.color.destructiveForeground,

  // Neutral actions
  neutral: tokens.color.neutral,
  neutralStrong: tokens.color.neutralStrong,
  neutralForeground: tokens.color.neutralForeground,

  // Scope/waveform
  scopeBackground: tokens.color.scopeBackground,
  scopeTrace: tokens.color.scopeTrace,
  scopeGrid: tokens.color.scopeGrid,

  // Waveform trace colors (blue, red, teal)
  traceBlue: tokens.color.traceBlue,
  traceRed: tokens.color.traceRed,
  traceTeal: tokens.color.traceTeal,
});

// Dark theme - proper dark mode using oklch for perceptual uniformity
export const darkTheme = createTheme({
  // Dark background - CanvasText becomes white, Canvas becomes black in dark mode
  background: "#000000",
  backgroundHover: "oklch(0.15 0 0)",
  backgroundPress: "oklch(0.2 0 0)",
  backgroundElevated: "oklch(0.15 0 0)",

  // Foreground
  color: "#ffffff",
  colorHover: "oklch(0.95 0 0)",
  colorPress: "oklch(0.90 0 0)",

  // Borders - subtle in dark
  borderColor: "oklch(0.25 0 0)",
  borderColorHover: "oklch(0.35 0 0)",

  // Semantic - inverted for dark mode
  primary: "#ffffff",
  primaryForeground: "#000000",
  secondary: "oklch(0.25 0 0)",
  secondaryForeground: "#ffffff",
  muted: "oklch(0.2 0 0)",
  mutedForeground: "oklch(0.65 0 0)",
  accent: "oklch(0.25 0 0)",
  accentForeground: "#ffffff",
  destructive: "#ffffff",
  destructiveForeground: "#000000",

  // Neutral actions - avoid pure white/black flip
  neutral: "oklch(0.45 0 0)",
  neutralStrong: "oklch(0.55 0 0)",
  neutralForeground: "#ffffff",

  // Scope/waveform - blue trace
  scopeBackground: "#000000",
  scopeTrace: "#60a5fa",
  scopeGrid: "oklch(0.25 0 0)",

  // Waveform trace colors (blue, red, teal)
  traceBlue: tokens.color.traceBlue,
  traceRed: tokens.color.traceRed,
  traceTeal: tokens.color.traceTeal,
});

// Create Tamagui config
export const tamaguiConfig = createTamagui({
  tokens: tamaguiTokens,
  fonts: {
    body: bodyFont,
    heading: bodyFont,
    mono: monoFont,
  },
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  defaultTheme: "light",
  shouldAddDebugAndAccessibilityIndicators: false,
});

export type TamaguiConfig = typeof tamaguiConfig;
