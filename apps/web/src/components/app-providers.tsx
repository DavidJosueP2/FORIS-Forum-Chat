import type { ReactNode } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={350} skipDelayDuration={150}>
        {children}
        <Toaster closeButton position="bottom-right" containerAriaLabel="Notificaciones" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
