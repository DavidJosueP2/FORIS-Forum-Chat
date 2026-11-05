import type { ReactNode } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from '@/features/account/components/auth-provider'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={350} skipDelayDuration={150}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster closeButton position="bottom-right" containerAriaLabel="Notificaciones" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
