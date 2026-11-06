import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AccountUser, AuthOptions, AuthSession } from '@messages/contracts'
import { AuthContext, emptySession } from '../lib/auth-context'
import { accountError, accountRequest, AUTH_EVENT, SESSION_SIGNAL } from '../api/account-api'

function notifyOtherTabs() {
  try { localStorage.setItem(SESSION_SIGNAL, crypto.randomUUID()) } catch { /* Sin tokens ni contraseñas en el almacenamiento. */ }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>(emptySession)
  const [options, setOptions] = useState<AuthOptions>({ enabled: false, google: false, emailDelivery: false })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)

  const refresh = useCallback(() => {
    const current = ++sequence.current
    return Promise.all([
        accountRequest<AuthSession>('auth/session'), accountRequest<AuthOptions>('auth/options'),
      ]).then(([nextSession, nextOptions]) => {
      if (current !== sequence.current) return
      setSession(nextSession)
      setOptions(nextOptions)
      setStatus('ready')
      setError(null)
    }).catch(cause => {
      if (current !== sequence.current) return
      setError(accountError(cause))
      setStatus('error')
    })
  }, [])

  const invalidateRequests = useCallback(() => { sequence.current++ }, [])

  useEffect(() => {
    void refresh()
    const onChange = () => { void refresh() }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const onStorage = (event: StorageEvent) => { if (event.key === SESSION_SIGNAL) void refresh() }
    window.addEventListener('focus', onChange)
    window.addEventListener('online', onChange)
    window.addEventListener(AUTH_EVENT, onChange)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      invalidateRequests()
      window.removeEventListener('focus', onChange)
      window.removeEventListener('online', onChange)
      window.removeEventListener(AUTH_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, invalidateRequests])

  const applySession = useCallback((value: AuthSession) => {
    sequence.current++
    setSession(value)
    setStatus('ready')
    setError(null)
    notifyOtherTabs()
  }, [])
  const updateUser = useCallback((user: AccountUser) => {
    sequence.current++
    setSession(current => current.user?.id === user.id ? {
      ...current,
      user: {
        ...current.user,
        displayName: user.displayName,
        givenName: user.givenName,
        familyName: user.familyName,
        bio: user.bio,
      },
    } : current)
    notifyOtherTabs()
  }, [])
  const updateAvatar = useCallback((userId: string, avatarId: string | null) => {
    sequence.current++
    setSession(current => current.user?.id === userId ? { ...current, user: { ...current.user, avatarId } } : current)
    notifyOtherTabs()
  }, [])
  const logout = useCallback(async () => {
    await accountRequest('auth/logout', 'POST', {})
    applySession(emptySession)
  }, [applySession])
  const value = useMemo(() => ({
    session, options, status, error, refresh, applySession, updateUser, updateAvatar, logout,
  }), [session, options, status, error, refresh, applySession, updateUser, updateAvatar, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
