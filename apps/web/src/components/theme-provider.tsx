import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  THEME_STORAGE_KEY, ThemeContext, parseTheme, readStoredTheme, readSystemTheme,
} from "@/lib/theme"
import type { Theme } from "@/lib/theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState(readSystemTheme)
  const resolvedTheme = theme === "system" ? systemTheme : theme

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", resolvedTheme === "dark")
    root.classList.toggle("light", resolvedTheme === "light")
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light")
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setThemeState(parseTheme(event.newValue))
    }
    query.addEventListener("change", onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      query.removeEventListener("change", onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value)
    } catch {
      // La preferencia sigue funcionando si el navegador bloquea el almacenamiento.
    }
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
