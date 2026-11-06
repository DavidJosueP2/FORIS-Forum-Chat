import { useId } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/use-theme'

const modes = [
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Sistema (predeterminado)', icon: Monitor },
] as const

export function ThemeMenuOptions({ disabled = false }: { disabled?: boolean }) {
  const { theme, setTheme } = useTheme()
  const labelId = useId()
  return <div className="flex items-center justify-between gap-3 px-3 py-1">
    <span id={labelId} className="text-sm">Tema</span>
    <DropdownMenuRadioGroup value={theme} aria-labelledby={labelId}
      className="flex shrink-0 items-center rounded-full bg-popover p-1 text-popover-foreground dark:bg-secondary dark:text-secondary-foreground"
      onValueChange={value => {
        if (value === 'system' || value === 'light' || value === 'dark') setTheme(value)
      }}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        event.stopPropagation()
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not([data-disabled])'))
        if (!items.length) return
        const current = items.findIndex(item => item === document.activeElement)
        const next = items[(current + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]
        next?.focus()
        next?.click()
      }}>
      {modes.map(({ value, label, icon: Icon }) => <DropdownMenuRadioItem key={value}
        value={value} disabled={disabled} aria-label={label} title={label}
        onSelect={event => event.preventDefault()}
        className="size-11 justify-center rounded-full p-0 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:focus:bg-primary data-[state=checked]:focus:text-primary-foreground data-[state=checked]:focus:**:text-primary-foreground [&>[data-slot=dropdown-menu-radio-item-indicator]]:hidden">
        <Icon aria-hidden="true" />
      </DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup>
  </div>
}
