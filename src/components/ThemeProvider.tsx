import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", resolvedTheme: "light", setTheme: () => undefined });

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = window.localStorage.getItem("dataplug-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme);
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.style.colorScheme = resolved;
      setResolvedTheme(resolved);
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme: (nextTheme: Theme) => {
      window.localStorage.setItem("dataplug-theme", nextTheme);
      setThemeState(nextTheme);
    },
  }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
  const label = theme === "system" ? "System theme" : theme === "dark" ? "Dark theme" : "Light theme";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="fixed bottom-24 right-4 z-[45] flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-md backdrop-blur transition hover:border-primary hover:text-primary md:bottom-5 md:right-5"
      aria-label={`${label}. Switch to ${nextTheme} theme`}
      title={`${label} · switch to ${nextTheme}`}
    >
      {theme === "system" ? <Monitor className="h-3.5 w-3.5" aria-hidden="true" /> : theme === "dark" ? <Moon className="h-3.5 w-3.5" aria-hidden="true" /> : <Sun className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}
