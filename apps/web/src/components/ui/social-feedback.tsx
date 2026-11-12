import type { ReactNode } from 'react'
import './social-feedback.css'

export function SocialFeedback({ pulse, celebrate = false, children }: { pulse: number; celebrate?: boolean; children: ReactNode }) {
  return <span key={pulse} className="social-feedback" data-pulse={pulse > 0} data-celebrate={celebrate} aria-hidden="true">{children}</span>
}
