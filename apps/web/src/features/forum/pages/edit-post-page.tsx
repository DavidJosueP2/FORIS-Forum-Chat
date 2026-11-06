import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ForumPost } from '@messages/contracts'
import { useAuth } from '@/features/account/hooks/use-auth'
import { CommunityWritingGate } from '@/features/communities/components/community-writing-gate'
import { ForumEmpty, ForumError, ForumLoading, ParticipationGate } from '../components/forum-states'
import { useResource } from '../hooks/use-forum'

const PostCanvas = lazy(() => import('../editor/post-canvas'))
function EditablePost({ id, userId }: { id: string; userId: string }) {
  const post = useResource<ForumPost>('posts/' + id)
  if (post.loading) return <ForumLoading label="Abriendo tu publicación…" />
  if (post.error) return <ForumError message={post.error} retry={post.retry} />
  if (!post.data) return null
  if (post.data.author.id !== userId) return <ForumEmpty title="Esta publicación pertenece a otra persona"><p>Solo su autor puede editarla.</p><Link to={'/publicaciones/' + id}>Volver a la publicación</Link></ForumEmpty>
  const canvas = <Suspense fallback={<ForumLoading label="Preparando el lienzo…" />}><PostCanvas key={id + '.' + userId} userId={userId} initialTopic="" initialCommunity={post.data.community?.id ?? null} post={post.data} /></Suspense>
  return post.data.community ? <CommunityWritingGate communityId={post.data.community.id} compact>{canvas}</CommunityWritingGate> : canvas
}
export function EditPostPage() {
  const { postId = '' } = useParams()
  const auth = useAuth()
  const valid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(postId)
  const next = '/publicaciones/' + postId + '/editar'
  return <main id="forum-content" className="forum-main canvas-main" tabIndex={-1}>{valid ? <ParticipationGate next={next}>{auth.session.user && <EditablePost key={postId + auth.session.user.id} id={postId} userId={auth.session.user.id} />}</ParticipationGate> : <ForumEmpty title="Esta publicación no existe"><Link to="/">Volver a Foros</Link></ForumEmpty>}</main>
}
