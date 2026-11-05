import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const label = resolvedTheme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'
  return (
    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={label} title={label}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}
