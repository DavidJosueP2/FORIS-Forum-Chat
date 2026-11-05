import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import type { OtpChallenge } from '@messages/contracts'
import { LoaderCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { accountRequest, accountError } from '../api/account-api'

interface OtpFormProps {
  challenge: OtpChallenge
  onResent: (challenge: OtpChallenge) => void
  onConfirm: (code: string) => Promise<void>
  children?: ReactNode
  submitLabel?: string
  inputRef?: Ref<HTMLInputElement>
}
export function OtpForm({ challenge, onResent, onConfirm, children, submitLabel = 'Confirmar código', inputRef }: OtpFormProps) {
  const id = useId()
  const [code, setCode] = useState('')
  const [now, setNow] = useState(Date.now)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now) / 1000))
  const remaining = Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1000))
  return (
    <form className="account-form" onSubmit={event => {
      event.preventDefault()
      if (guard.current) return
      guard.current = true
      setBusy(true)
      setError(null)
      void onConfirm(code).catch(cause => setError(accountError(cause))).finally(() => {
        guard.current = false
        setBusy(false)
      })
    }} aria-busy={busy}>
      <div className="account-field">
        <label htmlFor={id}>Código de seis dígitos</label>
        <Input ref={inputRef} id={id} name="otp" className="otp-code" inputMode="numeric" autoComplete="one-time-code"
          value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }}
          pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} aria-describedby={id + '-help'} />
        <p id={id + '-help'} className="account-hint">
          {remaining ? 'Caduca en ' + Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0') : 'El plazo del código terminó. Solicita uno nuevo.'}
        </p>
      </div>
      <fieldset disabled={busy} className="account-fieldset">{children}</fieldset>
      {error && <p className="account-error" role="alert">{error}</p>}
      <Button type="submit" className="h-12 w-full" disabled={busy || code.length !== 6}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{submitLabel}
      </Button>
      <Button type="button" variant="ghost" className="h-11 w-full" disabled={busy || seconds > 0}
        onClick={() => {
          if (guard.current) return
          guard.current = true
          setBusy(true)
          setError(null)
          void accountRequest<OtpChallenge>('auth/otp/resend', 'POST', { challengeId: challenge.challengeId })
            .then(value => { setCode(''); setNow(Date.now()); onResent(value) })
            .catch(cause => setError(accountError(cause)))
            .finally(() => { guard.current = false; setBusy(false) })
        }}>
        {seconds > 0 ? 'Puedes reenviar en ' + seconds + ' s' : 'Enviar otro código'}
      </Button>
    </form>
  )
}
