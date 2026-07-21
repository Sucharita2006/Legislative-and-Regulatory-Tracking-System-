"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "openpaws-theme";

/**
 * Inline script injected into <head> so the correct theme is applied before
 * first paint — this prevents a flash of the wrong theme on load.
 *
 * Resolution order (matches the rest of this module):
 *   1. A previously saved choice in localStorage
 *   2. The OS preference on first visit (prefers-color-scheme: dark)
 *   3. Light, as the default
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var e=document.documentElement;e.classList.toggle("dark",t==="dark");e.style.colorScheme=t;}catch(_){}})();`;

function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage may be unavailable (private mode, etc.) */
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start as "light" to match the server render, then sync to the real value
  // on mount. The no-flash script has already set the <html> class, so the
  // visible theme is correct from the first paint regardless.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(resolveInitialTheme());
  }, []);

  const applyTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures */
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
