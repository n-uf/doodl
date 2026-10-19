"use client";

import { useCallback, useState } from "react";
import { getAccentClasses, themes, type Theme } from "../tokens/themes";

export interface UseThemeReturn {
  theme: Theme;
  tokens: (typeof themes)[Theme];
  accent: ReturnType<typeof getAccentClasses>;
  isDark: boolean;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export function useTheme(initialTheme: Theme = "dark"): UseThemeReturn {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return {
    theme,
    tokens: themes[theme],
    accent: getAccentClasses(theme),
    isDark: theme === "dark",
    toggle,
    setTheme,
  };
}
