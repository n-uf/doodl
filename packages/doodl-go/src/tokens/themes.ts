/**
 * Theme tokens for Doodl Go UI
 */

export interface ThemeTokens {
  // Backgrounds
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  surfaceActive: string;
  input: string;
  // Text
  text: string;
  textMuted: string;
  textDim: string;
  textDimmer: string;
  // Borders
  border: string;
  borderHover: string;
  // Accent
  accent: string;
  // Grid
  gridColor: string;
  // Selection
  selection: string;
}

export const themes = {
  dark: {
    bg: "bg-zinc-950",
    text: "text-zinc-100",
    textMuted: "text-zinc-400",
    textDim: "text-zinc-500",
    textDimmer: "text-zinc-600",
    border: "border-zinc-800",
    borderHover: "hover:border-zinc-600",
    surface: "bg-zinc-900",
    surfaceAlt: "bg-zinc-950/50",
    surfaceHover: "hover:bg-zinc-800",
    surfaceActive: "bg-zinc-800",
    input: "bg-black",
    accent: "amber",
    gridColor: "#fff",
    selection: "selection:bg-amber-400 selection:text-black",
  },
  light: {
    bg: "bg-stone-100",
    text: "text-stone-900",
    textMuted: "text-stone-600",
    textDim: "text-stone-500",
    textDimmer: "text-stone-400",
    border: "border-stone-300",
    borderHover: "hover:border-stone-400",
    surface: "bg-white",
    surfaceAlt: "bg-stone-50",
    surfaceHover: "hover:bg-stone-100",
    surfaceActive: "bg-stone-200",
    input: "bg-stone-50",
    accent: "orange",
    gridColor: "#000",
    selection: "selection:bg-orange-400 selection:text-white",
  },
} as const;

export type Theme = keyof typeof themes;

/**
 * Get accent color classes based on theme
 */
export function getAccentClasses(theme: Theme): {
  bg: string;
  border: string;
  text: string;
  textAlt: string;
} {
  const isDark = theme === "dark";
  return {
    bg: isDark ? "bg-amber-400" : "bg-orange-500",
    border: isDark ? "border-amber-400" : "border-orange-500",
    text: isDark ? "text-amber-400" : "text-orange-600",
    textAlt: isDark ? "text-amber-500" : "text-orange-500",
  };
}
