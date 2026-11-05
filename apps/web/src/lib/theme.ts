import { createContext } from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = Exclude<Theme, "system">

export interface ThemeState {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const THEME_STORAGE_KEY = "messages.theme"
export const ThemeContext = createContext<ThemeState | undefined>(undefined)

export function parseTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system"
}

export function readStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return "system"
  }
}

export function readSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}
