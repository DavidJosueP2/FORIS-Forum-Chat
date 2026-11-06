import type { ReactNode } from 'react'
import { DiscoveryContext, useDiscoveryState } from './use-discovery'

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const discovery = useDiscoveryState()
  return <DiscoveryContext.Provider value={discovery}>{children}</DiscoveryContext.Provider>
}
