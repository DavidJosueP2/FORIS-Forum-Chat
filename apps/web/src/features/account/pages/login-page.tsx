import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { AuthSession, OtpChallenge } from '@messages/contracts'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ForisCharacter } from '@/components/brand/foris-character'
import { AccountShell } from '../components/account-shell'
import { PasswordField } from '../components/password-field'
import { OtpForm } from '../components/otp-form'
import { useAuth } from '../hooks/use-auth'
import { accountError, accountRequest, startGoogle } from '../api/account-api'
import { readPendingOtp, savePendingOtp, type PendingOtp } from '../lib/pending-otp'
import { returnTarget } from '../lib/return-target'

const googleErrors: Record<string, string> = {
  GOOGLE_CANCELLED: 'No se completó el acceso con Google. Puedes volver a intentarlo.',
  GOOGLE_FLOW_EXPIRED: 'La solicitud de Google caducó. Empieza de nuevo.',
  GOOGLE_ACCOUNT_EXISTS: 'Ya existe una cuenta con ese correo. Entra con tu contraseña y vincula Google desde tu perfil.',
  GOOGLE_IN_USE: 'Esa cuenta de Google ya está vinculada a otro perfil.',
  GOOGLE_IDENTITY_MISMATCH: 'Elige la cuenta de Google que está vinculada a tu perfil.',
  GOOGLE_FAILED: 'No pudimos completar el acceso con Google. Inténtalo de nuevo.',
  SESSION_REQUIRED: 'Tu sesión terminó. Vuelve a entrar.',
  GOOGLE_ALREADY_LINKED: 'Tu perfil ya tiene una cuenta de Google vinculada.',
}
export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const next = returnTarget(params.get('next'))
  const mode = params.get('mode') === 'register' ? 'register' : params.get('mode') === 'recover' ? 'recover' : 'login'
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(readPendingOtp)
  const pendingRef = useRef(pending)
  const [busy, setBusy] = useState(false)
  const guard = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function remember(value: PendingOtp | null) {
    pendingRef.current = value
    setPending(value)
    savePendingOtp(value)
  }
  function changeMode(value: 'login' | 'register' | 'recover') {
    if (guard.current) return
    remember(null)
    setError(null)
    setNotice(null)
    setPassword('')
    setConfirmation('')
    setParams(value === 'login' ? { next } : { mode: value, next })
  }
  async function submit() {
    if (guard.current) return
    guard.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'register') {
        if (password !== confirmation) throw new Error('Las contraseñas no coinciden.')
        const challenge = await accountRequest<OtpChallenge>('auth/register', 'POST', { email, password, displayName })
        remember({ kind: 'verify', email, challenge, returnTo: next })
      } else if (mode === 'recover') {
        const challenge = await accountRequest<OtpChallenge>('auth/password/forgot', 'POST', { email })
        remember({ kind: 'reset', email, challenge, returnTo: next })
      } else {
        const result = await accountRequest<{ session?: AuthSession; challenge?: OtpChallenge }>('auth/login', 'POST', { email, password })
        if (result.session) {
          auth.applySession(result.session)
          savePendingOtp(null)
          navigate(next, { replace: true })
        } else if (result.challenge) remember({ kind: 'verify', email, challenge: result.challenge, returnTo: next })
        else throw new Error('No pudimos abrir tu cuenta. Inténtalo de nuevo.')
      }
      setPassword('')
      setConfirmation('')
    } catch (cause) { setError(accountError(cause)) }
    finally { guard.current = false; setBusy(false) }
  }
  const unavailable = auth.status === 'loading' || !auth.options.enabled
  const mailUnavailable = mode !== 'login' && !auth.options.emailDelivery
  const providerError = params.get('error')
  return (
    <AccountShell>
      <main id="account-content" className="login-layout" tabIndex={-1}>
        <aside className="auth-story">
          <ForisCharacter mood="welcome" width={128} height={128} />
          <h2>Aquí hay lugar<br />para tu voz.</h2>
          <p>Una cuenta para publicar y responder con tu propio perfil. Como invitado puedes leer el foro y conversar en el chat global.</p>
          <Button asChild variant="secondary" className="h-12 px-6"><Link to="/">Explorar foros</Link></Button>
        </aside>
        <section className="auth-main" aria-labelledby="access-title">
          <div className="auth-form-column">
            {!pending && (
              <div className="auth-mode-switch" role="group" aria-label="Forma de acceso">
                <Button variant={mode === 'login' ? 'default' : 'ghost'} className="h-11 px-6" disabled={busy} aria-pressed={mode === 'login'} onClick={() => changeMode('login')}>Entrar</Button>
                <Button variant={mode === 'register' ? 'default' : 'ghost'} className="h-11 px-6" disabled={busy} aria-pressed={mode === 'register'} onClick={() => changeMode('register')}>Crear cuenta</Button>
              </div>
            )}
            <h1 id="access-title">
              {pending ? pending.kind === 'verify' ? 'Confirma tu correo' : 'Una contraseña nueva'
                : mode === 'register' ? 'Encuentra tu lugar' : mode === 'recover' ? 'Recupera tu acceso' : 'Qué bueno verte'}
            </h1>
            <p className="auth-description">
              {pending ? 'Si la solicitud corresponde, recibirás un código en ' + pending.email + '.'
                : mode === 'register' ? 'Elige cómo quieres entrar a Foris.'
                  : mode === 'recover' ? 'Te enviaremos un código para crear una nueva contraseña.'
                    : 'Entra con Google o con tu correo y contraseña.'}
            </p>
            {auth.session.user && !pending && <p className="account-notice">Ya tienes una sesión abierta. <Link to="/profile">Ir a tu perfil</Link></p>}
            {providerError && googleErrors[providerError] && <p className="account-error" role="alert">{googleErrors[providerError]}</p>}
            {notice && <p className="account-notice" role="status">{notice}</p>}
            {auth.status === 'error' && (
              <div className="account-status" role="alert"><p>{auth.error}</p><Button variant="secondary" className="h-11" onClick={() => void auth.refresh()}>Volver a conectar</Button></div>
            )}
            {pending ? (
              <>
                <OtpForm key={pending.challenge.challengeId + pending.challenge.resendAt}
                  challenge={pending.challenge}
                  onResent={challenge => {
                    const current = pendingRef.current
                    if (current?.challenge.challengeId === challenge.challengeId) remember({ ...current, challenge })
                  }}
                  submitLabel={pending.kind === 'verify' ? 'Verificar y entrar' : 'Guardar contraseña'}
                  onConfirm={async code => {
                    setBusy(true)
                    guard.current = true
                    try {
                      if (pending.kind === 'verify') {
                        const session = await accountRequest<AuthSession>('auth/verify-email', 'POST', { challengeId: pending.challenge.challengeId, code })
                        auth.applySession(session)
                        remember(null)
                        navigate(returnTarget(pending.returnTo ?? next), { replace: true })
                      } else {
                        if (password !== confirmation) throw new Error('Las contraseñas no coinciden.')
                        await accountRequest('auth/password/reset', 'POST', { challengeId: pending.challenge.challengeId, code, newPassword: password })
                        await auth.refresh()
                        remember(null)
                        setPassword('')
                        setConfirmation('')
                        setParams({ next: returnTarget(pending.returnTo ?? next) })
                        setNotice('Tu contraseña se actualizó. Ya puedes entrar con ella.')
                      }
                    } finally { setBusy(false); guard.current = false }
                  }}>
                  {pending.kind === 'reset' && <>
                    <PasswordField label="Nueva contraseña" creating value={password} onChange={setPassword} />
                    <PasswordField label="Repite la contraseña" creating confirm value={confirmation} onChange={setConfirmation} />
                  </>}
                </OtpForm>
                <Button type="button" variant="ghost" className="mt-3 h-11 w-full" disabled={busy} onClick={() => changeMode(mode)}>Usar otro correo</Button>
                <p className="account-hint">Si ya tienes una cuenta, vuelve a entrar. Nunca compartas un código que no hayas solicitado.</p>
              </>
            ) : (
              <>
                {mode !== 'recover' && <>
                  <Button variant="secondary" className="google-access h-12 w-full" disabled={busy || !auth.options.google}
                    onClick={() => {
                      if (guard.current) return
                      guard.current = true
                      setBusy(true)
                      setError(null)
                      void startGoogle('login', undefined, next).catch(cause => { setError(accountError(cause)); setBusy(false); guard.current = false })
                    }}>Continuar con Google</Button>
                  {!auth.options.google && auth.status === 'ready' && <p className="account-hint">Google no está disponible en este momento.</p>}
                  <p className="auth-alternative">O usa tu correo</p>
                </>}
                <form className="account-form" onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={busy}>
                  <fieldset className="account-fieldset" disabled={busy || unavailable || mailUnavailable}>
                    {mode === 'register' && <div className="account-field"><label htmlFor="signup-name">Nombre visible</label><Input id="signup-name" name="nickname" autoComplete="nickname" required maxLength={32} value={displayName} onChange={event => setDisplayName(event.target.value)} /></div>}
                    <div className="account-field"><label htmlFor="access-email">Correo electrónico</label><Input id="access-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
                    {mode !== 'recover' && <PasswordField label="Contraseña" creating={mode === 'register'} value={password} onChange={setPassword} />}
                    {mode === 'register' && <PasswordField label="Repite la contraseña" creating confirm value={confirmation} onChange={setConfirmation} />}
                    {error && <p className="account-error" role="alert">{error}</p>}
                    <Button type="submit" className="h-12 w-full">{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{mode === 'register' ? 'Crear cuenta' : mode === 'recover' ? 'Recibir código' : 'Entrar a Foris'}</Button>
                  </fieldset>
                </form>
                {error && busy && <p className="account-error" role="alert">{error}</p>}
                {(unavailable || mailUnavailable) && auth.status === 'ready' && <p className="account-hint">El acceso o el envío de códigos no está disponible ahora. Puedes continuar como invitado.</p>}
                {mode === 'register' && <p className="account-hint">Con contraseña, confirmas tu correo mediante un código. Google ya verifica tu correo.</p>}
                <Button variant="ghost" className="mt-3 h-11 w-full" disabled={busy} onClick={() => changeMode(mode === 'recover' ? 'login' : 'recover')}>
                  {mode === 'recover' ? 'Volver a entrar' : 'Olvidé mi contraseña'}
                </Button>
              </>
            )}
            <Link to="/" className="auth-guest-link">Volver a los foros</Link>
          </div>
        </section>
      </main>
    </AccountShell>
  )
}
