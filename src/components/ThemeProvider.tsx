import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

type Theme = "dark";
type ResolvedTheme = "dark";

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: ResolvedTheme;
}>({ theme: "dark", resolvedTheme: "dark" });

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  const value = useMemo(() => ({ theme: "dark" as const, resolvedTheme: "dark" as const }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
