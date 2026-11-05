import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ThemeMenuOptions } from '@/components/theme-menu-options'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle() {
  const { theme } = useTheme()
  const label = 'Elegir tema. Actual: ' + (theme === 'system' ? 'sistema' : theme === 'dark' ? 'oscuro' : 'claro')
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={label} title="Elegir tema">
          {theme === 'system' ? <Monitor aria-hidden="true" /> : theme === 'dark' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-64 max-w-[calc(100vw-1.5rem)] bg-secondary p-2 text-secondary-foreground dark:bg-popover dark:text-popover-foreground">
        <ThemeMenuOptions />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
