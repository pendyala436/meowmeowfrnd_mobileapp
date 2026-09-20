import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  ReactNode,
} from "react";
import {
  THEMES,
  ThemeId,
  DEFAULT_THEME_ID,
  normalizeThemeId,
  getThemeChromeHex,
  themeTokenToHex,
} from "./themeRegistry";

export type { ThemeId, ThemeDefinition, ThemePreview } from "./themeRegistry";
export { THEMES, DEFAULT_THEME_ID } from "./themeRegistry";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  themeId: ThemeId;
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  setTheme: (themeId: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  themes: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_THEME = "app-theme";
const STORAGE_KEY_MODE = "app-theme-mode";

export function normalizeThemeMode(stored: string | null): ThemeMode {
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export function resolveThemeMode(mode: ThemeMode): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDocument(themeId: ThemeId, resolvedMode: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolvedMode === "dark");
  root.setAttribute("data-theme", themeId);
  root.style.colorScheme = resolvedMode;

  // Prefer live --background after CSS applies; fall back to theme preview primary.
  // This drives Android status/nav bars + browser chrome via <meta name="theme-color">.
  let themeColor = getThemeChromeHex(themeId, resolvedMode === "dark");
  try {
    const bgToken = getComputedStyle(root).getPropertyValue("--background").trim();
    if (bgToken) {
      themeColor = themeTokenToHex(bgToken, themeColor);
    }
  } catch {
    // keep preview-based fallback
  }

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", themeColor);
  });
  document.querySelectorAll('meta[name="msapplication-TileColor"]').forEach((meta) => {
    meta.setAttribute("content", themeColor);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const getStoredValue = <T extends string>(key: string, fallback: T): T => {
    if (typeof window === "undefined") return fallback;
    try {
      return (localStorage.getItem(key) as T) || fallback;
    } catch {
      return fallback;
    }
  };

  const persistValue = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures in restricted browsers/webviews
    }
  };

  const [themeId, setThemeId] = useState<ThemeId>(() =>
    normalizeThemeId(getStoredValue(STORAGE_KEY_THEME, DEFAULT_THEME_ID)),
  );
  const [mode, setModeState] = useState<ThemeMode>(() =>
    normalizeThemeMode(getStoredValue(STORAGE_KEY_MODE, "system")),
  );
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() =>
    resolveThemeMode(normalizeThemeMode(getStoredValue(STORAGE_KEY_MODE, "system"))),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateResolvedMode = () => {
      setResolvedMode(resolveThemeMode(mode));
    };

    const addMediaListener = () => {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updateResolvedMode);
      } else {
        mediaQuery.addListener?.(updateResolvedMode);
      }
    };

    const removeMediaListener = () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateResolvedMode);
      } else {
        mediaQuery.removeListener?.(updateResolvedMode);
      }
    };

    updateResolvedMode();
    addMediaListener();
    return () => removeMediaListener();
  }, [mode]);

  useLayoutEffect(() => {
    applyThemeToDocument(themeId, resolvedMode);
  }, [themeId, resolvedMode]);

  useEffect(() => {
    persistValue(STORAGE_KEY_THEME, themeId);
  }, [themeId]);

  useEffect(() => {
    persistValue(STORAGE_KEY_MODE, mode);
  }, [mode]);

  const setTheme = (newThemeId: ThemeId) => {
    setThemeId(newThemeId);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  return (
    <ThemeContext.Provider
      value={{ themeId, mode, resolvedMode, setTheme, setMode, themes: THEMES }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useAppTheme must be used within a ThemeProvider");
  }
  return context;
}
