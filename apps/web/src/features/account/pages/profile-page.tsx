import { useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import type { AccountUser, AuthSession, OtpChallenge } from '@messages/contracts'
import { LogOut, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AccountShell } from '../components/account-shell'
import { PasswordField } from '../components/password-field'
import { OtpForm } from '../components/otp-form'
import { useAuth } from '../hooks/use-auth'
import { accountError, accountRequest, startGoogle } from '../api/account-api'
import { ProfilePhoto } from '../components/profile-photo'
import { IdentityImage } from '@/features/media/components/identity-image'

function GoogleConfirmation() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return <>
    <Button variant="secondary" className="h-11" disabled={busy} onClick={() => {
      setBusy(true)
      void startGoogle('reauth').catch(cause => { setError(accountError(cause)); setBusy(false) })
    }}>Confirmar identidad con Google</Button>
    {error && <p className="account-error" role="alert">{error}</p>}
  </>
}
function PersonalDetails({ user }: { user: AccountUser }) {
  const auth = useAuth()
  const [name, setName] = useState(user.displayName)
  const [givenName, setGivenName] = useState(user.givenName)
  const [familyName, setFamilyName] = useState(user.familyName)
  const [bio, setBio] = useState(user.bio)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  return (
    <section className="profile-section" aria-labelledby="details-heading">
      <div className="profile-section-description"><h2 id="details-heading">Tus datos</h2><p>Así te presentas en Foris. Tu correo se mantiene privado.</p></div>
      <form className="account-form" onSubmit={event => {
        event.preventDefault()
        if (busy) return
        setBusy(true); setError(null); setSuccess(false)
        void accountRequest<AccountUser>('account/profile', 'PATCH', { displayName: name, givenName, familyName, bio })
          .then(updated => { auth.updateUser(updated); setSuccess(true) })
          .catch(cause => setError(accountError(cause))).finally(() => setBusy(false))
      }} aria-busy={busy}>
        <fieldset className="account-fieldset" disabled={busy}>
          <div className="account-field"><label htmlFor="profile-name">Nombre visible</label><Input id="profile-name" name="nickname" autoComplete="nickname" required maxLength={32} value={name} onChange={event => { setName(event.target.value); setSuccess(false) }} /></div>
          <div className="profile-name-fields">
            <div className="account-field"><label htmlFor="given-name">Nombres</label><Input id="given-name" autoComplete="given-name" maxLength={80} value={givenName} onChange={event => { setGivenName(event.target.value); setSuccess(false) }} /></div>
            <div className="account-field"><label htmlFor="family-name">Apellidos</label><Input id="family-name" autoComplete="family-name" maxLength={80} value={familyName} onChange={event => { setFamilyName(event.target.value); setSuccess(false) }} /></div>
          </div>
          <div className="account-field"><label htmlFor="profile-bio">Algo sobre ti</label><Textarea id="profile-bio" rows={3} maxLength={280} value={bio} onChange={event => { setBio(event.target.value); setSuccess(false) }} /><p className="account-hint">Hasta 280 caracteres. Tu presentación se guarda en tu perfil.</p></div>
          {error && <p className="account-error" role="alert">{error}</p>}
          {success && <p className="account-success" role="status">Tus datos se actualizaron.</p>}
          <Button type="submit" className="h-11 justify-self-start px-6">Guardar cambios</Button>
        </fieldset>
      </form>
    </section>
  )
}
interface PasswordSettingsProps {
  user: AccountUser
  creationRequest: number
  onCreatePassword: () => void
}
function PasswordSettings({ user, creationRequest, onCreatePassword }: PasswordSettingsProps) {
  const auth = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const otpRef = useRef<HTMLInputElement>(null)
  const creationOpen = creationRequest > 0

  useLayoutEffect(() => {
    if (user.hasPassword || !creationOpen) return
    sectionRef.current?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
    const input = challenge ? otpRef.current : passwordRef.current
    input?.focus({ preventScroll: true })
  }, [creationRequest, creationOpen, user.hasPassword, challenge])

  const passwordFields = <>
    <PasswordField inputRef={passwordRef} label="Nueva contraseña" creating value={newPassword} onChange={setNewPassword} />
    <PasswordField label="Repite la contraseña" creating confirm value={confirmation} onChange={setConfirmation} />
  </>
  return (
    <section ref={sectionRef} id="password" className="profile-section" aria-labelledby="password-heading">
      <div className="profile-section-description"><h2 id="password-heading">{user.hasPassword ? 'Contraseña' : 'Crea una contraseña'}</h2><p>{user.hasPassword ? 'Confirma tu identidad y usa un código para cambiarla.' : 'Añade otra forma de entrar además de Google. Confirmaremos el cambio por correo.'}</p></div>
      <div className="profile-section-content">
        {!user.hasPassword && !creationOpen ? (
          <Button type="button" className="h-11 justify-self-start px-6" onClick={onCreatePassword}>Crear contraseña</Button>
        ) : challenge ? (
          <OtpForm key={challenge.challengeId + challenge.resendAt} challenge={challenge} inputRef={otpRef}
            onResent={value => setChallenge(current => current?.challengeId === value.challengeId ? value : current)}
            submitLabel="Guardar contraseña" onConfirm={async code => {
              setBusy(true)
              try {
                if (newPassword !== confirmation) throw new Error('Las contraseñas no coinciden.')
                const session = await accountRequest<AuthSession>('account/password/confirm', 'POST', { challengeId: challenge.challengeId, code, newPassword })
                auth.applySession(session)
                setChallenge(null); setCurrentPassword(''); setNewPassword(''); setConfirmation('')
                setSuccess(user.hasPassword
                  ? 'Contraseña actualizada. Las demás sesiones se cerraron.'
                  : 'Contraseña creada. Ya puedes entrar con tu correo y contraseña; Google sigue vinculado.')
              } finally { setBusy(false) }
            }}>
            {passwordFields}
          </OtpForm>
        ) : (
          <form className="account-form" onSubmit={event => {
            event.preventDefault()
            if (busy) return
            setError(null); setSuccess(null)
            if (!user.hasPassword && newPassword !== confirmation) {
              setError('Las contraseñas no coinciden.')
              return
            }
            setBusy(true)
            void accountRequest<OtpChallenge>('account/password/request', 'POST', { currentPassword: user.hasPassword ? currentPassword : undefined })
              .then(value => { setChallenge(value); setCurrentPassword('') })
              .catch(cause => setError(accountError(cause))).finally(() => setBusy(false))
          }}>
            <fieldset className="account-fieldset" disabled={busy}>
              {user.hasPassword && <PasswordField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} />}
              {!user.hasPassword && passwordFields}
              {!user.hasPassword && <p className="account-hint">Si tu acceso con Google no es reciente, confirma tu identidad antes de pedir el código.</p>}
              {error && <p className="account-error" role="alert">{error}</p>}
              <Button type="submit" className="h-11 justify-self-start px-6" disabled={!auth.options.emailDelivery}>
                {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {busy ? 'Solicitando código' : user.hasPassword ? 'Recibir código' : 'Recibir código y continuar'}
              </Button>
            </fieldset>
          </form>
        )}
        {challenge && <Button variant="ghost" className="h-11" disabled={busy} onClick={() => { setChallenge(null); setError(null) }}>{user.hasPassword ? 'Volver al cambio de contraseña' : 'Editar contraseña'}</Button>}
        {!user.hasPassword && creationOpen && !challenge && <GoogleConfirmation />}
        {!auth.options.emailDelivery && <p className="account-hint">El envío de códigos no está disponible ahora.</p>}
        {challenge && <p className="account-hint">Confirma el código que recibirás en {user.email} para guardar tu contraseña.</p>}
        {success && <p className="account-success" role="status">{success}</p>}
      </div>
    </section>
  )
}
function EmailSettings({ user }: { user: AccountUser }) {
  const auth = useAuth()
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  return (
    <section className="profile-section" aria-labelledby="email-heading">
      <div className="profile-section-description"><h2 id="email-heading">Tu correo</h2><p>Para cambiarlo, confirma tu identidad y verifica el correo nuevo con un código.</p><p className="verified-email">Correo verificado</p></div>
      <div className="profile-section-content">
        {challenge ? <OtpForm key={challenge.challengeId + challenge.resendAt} challenge={challenge}
          onResent={value => setChallenge(current => current?.challengeId === value.challengeId ? value : current)}
          submitLabel="Confirmar nuevo correo" onConfirm={async code => {
            setBusy(true)
            try {
              const session = await accountRequest<AuthSession>('account/email/confirm', 'POST', { challengeId: challenge.challengeId, code })
              auth.applySession(session)
              setEmail(session.user?.email ?? email); setChallenge(null); setCurrentPassword(''); setSuccess(true)
            } finally { setBusy(false) }
          }} /> : (
          <form className="account-form" onSubmit={event => {
            event.preventDefault()
            if (busy) return
            setBusy(true); setError(null); setSuccess(false)
            void accountRequest<OtpChallenge>('account/email/request', 'POST', { email, currentPassword: user.hasPassword ? currentPassword : undefined })
              .then(value => { setChallenge(value); setCurrentPassword('') })
              .catch(cause => setError(accountError(cause))).finally(() => setBusy(false))
          }}>
            <fieldset className="account-fieldset" disabled={busy || !auth.options.emailDelivery}>
              <div className="account-field"><label htmlFor="profile-email">Correo electrónico</label><Input id="profile-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setSuccess(false) }} /></div>
              {user.hasPassword && <PasswordField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} />}
              {error && <p className="account-error" role="alert">{error}</p>}
              <Button type="submit" className="h-11 justify-self-start px-6" disabled={email.trim().toLowerCase() === user.email}>Verificar nuevo correo</Button>
            </fieldset>
          </form>
        )}
        {challenge && <Button variant="ghost" className="h-11" disabled={busy} onClick={() => { setChallenge(null); setError(null) }}>Usar otro correo</Button>}
        {!user.hasPassword && <GoogleConfirmation />}
        {challenge && <p className="account-hint">Revisa el correo nuevo que indicaste. Tu dirección actual no cambia hasta confirmar el código.</p>}
        {!auth.options.emailDelivery && <p className="account-hint">El envío de códigos no está disponible ahora.</p>}
        {success && <p className="account-success" role="status">Correo actualizado y verificado. Las demás sesiones se cerraron.</p>}
      </div>
    </section>
  )
}
function GoogleSettings({ user, onCreatePassword }: { user: AccountUser; onCreatePassword: () => void }) {
  const auth = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  return (
    <section className="profile-section" aria-labelledby="google-heading">
      <div className="profile-section-description"><h2 id="google-heading">Google y tu cuenta</h2><p>{user.google ? user.hasPassword ? 'Puedes entrar con Google o con tu contraseña.' : 'Google es tu forma actual de entrar. Puedes añadir una contraseña como alternativa.' : 'Vincula Google a este mismo perfil, sin crear otra cuenta.'}</p></div>
      <form className="account-form" onSubmit={event => {
        event.preventDefault()
        if (busy) return
        setBusy(true); setError(null); setSuccess(false)
        if (user.google) {
          void accountRequest<AuthSession>('account/google/unlink', 'POST', { currentPassword })
            .then(session => { auth.applySession(session); setCurrentPassword(''); setSuccess(true) })
            .catch(cause => setError(accountError(cause))).finally(() => setBusy(false))
        } else {
          void startGoogle('link', currentPassword).catch(cause => { setError(accountError(cause)); setBusy(false) })
        }
      }}>
        {user.google && <p className="google-linked-email"><strong>Google vinculado</strong><span>{user.google.email}</span></p>}
        <fieldset className="account-fieldset" disabled={busy || (Boolean(user.google) && !user.hasPassword)}>
          {user.hasPassword && <PasswordField label="Confirma tu contraseña" value={currentPassword} onChange={setCurrentPassword} />}
          {error && <p className="account-error" role="alert">{error}</p>}
          <Button type="submit" variant="secondary" className="h-11 justify-self-start px-6" disabled={!user.google && !auth.options.google}>
            {user.google ? 'Desvincular Google' : 'Vincular Google'}
          </Button>
        </fieldset>
        {user.google && !user.hasPassword && <p className="account-hint">Antes de desvincular Google, <Button type="button" variant="link" className="inline h-auto whitespace-normal p-0 align-baseline text-xs font-normal underline underline-offset-3" onClick={onCreatePassword}>crea una contraseña</Button> para conservar el acceso.</p>}
        {!user.google && !auth.options.google && <p className="account-hint">Google no está disponible ahora.</p>}
        {success && <p className="account-success" role="status">Google se desvinculó de tu perfil.</p>}
      </form>
    </section>
  )
}
export function ProfilePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [passwordCreationRequest, setPasswordCreationRequest] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (auth.status === 'loading') return <AccountShell><main id="account-content" className="account-loading" role="status"><LoaderCircle className="animate-spin" aria-hidden="true" /><p>Cargando tu perfil</p></main></AccountShell>
  if (!auth.session.user) {
    if (auth.status === 'error') return <AccountShell><main id="account-content" className="account-loading"><p role="alert">{auth.error}</p><Button className="h-11" onClick={() => void auth.refresh()}>Volver a conectar</Button></main></AccountShell>
    return <Navigate to="/login?error=SESSION_REQUIRED" replace />
  }
  const user = auth.session.user
  const createPassword = () => setPasswordCreationRequest(current => current + 1)
  return (
    <AccountShell>
      <main id="account-content" className="profile-main" tabIndex={-1}>
        <header className="profile-heading">
          <IdentityImage mediaId={user.avatarId} name={user.displayName} className="profile-avatar" />
          <div><h1>Tu perfil</h1><p>Hola, {user.displayName}. Este es tu lugar en Foris.</p></div>
        </header>
        {params.get('notice') === 'google_linked' && <p className="account-notice" role="status">Google ya está vinculado a tu cuenta.</p>}
        {params.get('notice') === 'reauthenticated' && <p className="account-notice" role="status">Identidad confirmada. Ya puedes continuar con el cambio.</p>}
        {auth.error && <p className="account-error" role="alert">{auth.error}</p>}
        <ProfilePhoto key={'photo-' + user.id} user={user} />
        <PersonalDetails key={user.id} user={user} />
        <EmailSettings key={'email-' + user.id} user={user} />
        <PasswordSettings key={'password-' + user.id} user={user} creationRequest={passwordCreationRequest} onCreatePassword={createPassword} />
        <GoogleSettings key={'google-' + user.id} user={user} onCreatePassword={createPassword} />
        <footer className="profile-footer">
          <Link to="/" className="auth-guest-link">Volver a los foros</Link>
          <Link to="/comunidades?vista=mias" className="auth-guest-link">Mis comunidades</Link>
          <Link to={'/?autor=' + user.id} className="auth-guest-link">Mis publicaciones</Link>
          <Button variant="secondary" className="h-11 px-6" disabled={busy} onClick={() => {
            if (busy) return
            setBusy(true); setError(null)
            void auth.logout().then(() => navigate('/', { replace: true })).catch(cause => setError(accountError(cause))).finally(() => setBusy(false))
          }}><LogOut aria-hidden="true" />Cerrar sesión</Button>
          {error && <p className="account-error" role="alert">{error}</p>}
        </footer>
      </main>
    </AccountShell>
  )
}
