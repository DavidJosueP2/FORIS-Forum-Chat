import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/account/hooks/use-auth'
import { CommunityWritingGate } from '@/features/communities/components/community-writing-gate'
import { validCommunityId } from '@/features/communities/lib/notifications'
import { ForumShell } from '../components/forum-shell'
import { ForumLoading, ParticipationGate } from '../components/forum-states'

const PostCanvas = lazy(() => import('../editor/post-canvas'))

export function CreatePostPage() {
  const [params] = useSearchParams()
  const topicId = params.get('topico') ?? ''
  const communityId = params.get('comunidad') ?? ''
  const auth = useAuth()
  const target = new URLSearchParams()
  if (topicId) target.set('topico', topicId)
  if (communityId) target.set('comunidad', communityId)
  const next = '/publicar' + (target.size ? '?' + target.toString() : '')
  const canvas = auth.session.user && <Suspense fallback={<ForumLoading label="Preparando tu lienzo…" />}><PostCanvas key={auth.session.user.id + '.' + communityId} userId={auth.session.user.id} initialTopic={topicId} initialCommunity={communityId || null} /></Suspense>
  return <ForumShell><main id="forum-content" className="forum-main canvas-main" tabIndex={-1}>
    <ParticipationGate next={next}>{communityId ? validCommunityId(communityId)
      ? <CommunityWritingGate key={auth.session.user?.id ?? 'guest'} communityId={communityId} compact>{canvas}</CommunityWritingGate>
      : <p className="forum-error" role="alert">La comunidad indicada no es válida. Vuelve al foro e inténtalo de nuevo.</p> : canvas}</ParticipationGate>
  </main></ForumShell>
}
