import type { ReactNode } from 'react'
import { ForumShell } from '@/features/forum/components/forum-shell'
import '../account.css'

export function AccountShell({ children }: { children: ReactNode }) {
  return <ForumShell contentId="account-content">{children}</ForumShell>
}
