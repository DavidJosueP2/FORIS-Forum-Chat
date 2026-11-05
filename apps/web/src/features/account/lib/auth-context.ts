import { createContext } from 'react'
import type { AccountUser, AuthOptions, AuthSession } from '@messages/contracts'

export const emptySession: AuthSession = { user: null, expiresAt: null, authenticatedAt: null }
export interface AuthState {
  session: AuthSession
  options: AuthOptions
  status: 'loading' | 'ready' | 'error'
  error: string | null
  refresh: () => Promise<void>
  applySession: (session: AuthSession) => void
  updateUser: (user: AccountUser) => void
  logout: () => Promise<void>
}
export const AuthContext = createContext<AuthState | undefined>(undefined)
