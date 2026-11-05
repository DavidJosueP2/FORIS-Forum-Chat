import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  creating?: boolean
  confirm?: boolean
  disabled?: boolean
}
export function PasswordField({ label, value, onChange, creating = false, confirm = false, disabled = false }: PasswordFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <Input id={id} name={confirm ? 'confirm-password' : creating ? 'new-password' : 'password'}
          type={visible ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'}
          value={value} onChange={event => onChange(event.target.value)} required minLength={creating ? 15 : 1} maxLength={128}
          disabled={disabled} aria-describedby={creating && !confirm ? id + '-hint' : undefined} />
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11"
          disabled={disabled} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}
          onClick={() => setVisible(current => !current)}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      {creating && !confirm && <p id={id + '-hint'} className="account-hint">Entre 15 y 128 caracteres. Puedes usar una frase.</p>}
    </div>
  )
}
