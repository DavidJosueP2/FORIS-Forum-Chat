import { publicProfileLink } from '@/features/account/lib/public-profile'
import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, MoreHorizontal, PencilLine } from 'lucide-react'
import type { Community, ForumPost } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/account/hooks/use-auth'
import { loginLink } from '@/features/account/lib/return-target'
import { IdentityImage } from '@/features/media/components/identity-image'
import { PostImages } from '@/features/media/components/post-images'
import { ForumEmpty, ForumError, ForumLoading, ForumTime } from '../components/forum-states'
import { useResource } from '../hooks/use-forum'
import { DocumentView } from '../editor/document-view'
import { PostContext } from '../components/context-rail'
import { FollowButton } from '../following/follow-button'
import { Discussion } from '../reading/discussion'
import { ShareLink, VoteButtons } from '../reading/reading-actions'
import '../reading/reading.css'

function PostContent({ id }: { id: string }) {
  const auth = useAuth()
  const post = useResource<ForumPost>('posts/' + id)
  const community = useResource<Community>(post.data?.community ? 'communities/' + post.data.community.id : null)
  const { hash, search } = useLocation()
  const requested = new URLSearchParams(search).get('comentario')
  const target = requested && /^[1-9]\d{0,18}$/u.test(requested) ? requested : null
  const loaded = post.data !== null
  const participationReady = !post.data?.community || !community.loading
  useEffect(() => {
    if (!loaded || !participationReady || (hash !== '#responder' && hash !== '#respuestas')) return
    const element = document.getElementById(hash.slice(1))
    element?.scrollIntoView({ block: 'start' })
    if (hash === '#responder') (element?.querySelector('textarea') ?? element)?.focus({ preventScroll: true })
  }, [loaded, hash, participationReady])
  if (post.loading && !post.data) return <ForumLoading label="Cargando publicación…" />
  if (post.error) return <ForumError message={post.error} retry={post.retry} />
  if (!post.data) return null
  const item = post.data
  const next = '/publicaciones/' + item.id + '#responder'
  const participation = {
    userId: auth.session.user?.id ?? null,
    pending: auth.status === 'loading' || Boolean(item.community && community.loading),
    href: !auth.session.user ? loginLink(next) : item.community && !community.data?.membership ? '/comunidades/' + item.community.id : null,
  }
  return <div className="content-columns"><div className="content-primary">
    <article className="reading-publication">
      <header className="reading-post-header"><div className="reading-post-meta">
        <Button asChild variant="ghost" className="reading-icon"><Link to="/" aria-label="Volver a Foros" title="Volver a Foros"><ArrowLeft aria-hidden="true" /></Link></Button>
        <Link to={publicProfileLink(item.author.id)} className="reading-post-author"><IdentityImage fallbackKey={'user:' + item.author.id} mediaId={item.author.avatarId} name={item.author.displayName} className="reading-avatar" /><span>{item.author.displayName}</span></Link>
        {item.community && <Link to={'/comunidades/' + item.community.id} className="reading-community">{item.community.name}</Link>}<ForumTime value={item.createdAt} /><FollowButton id={item.author.id} name={item.author.displayName} initial={item.author.isFollowing} compact />
        {item.updatedAt && <span title={new Date(item.updatedAt).toLocaleString('es-EC')}>editado</span>}
        {auth.session.user?.id === item.author.id && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="reading-icon reading-post-menu" aria-label="Opciones de la publicación"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="reading-menu"><DropdownMenuItem asChild><Link to={'/publicaciones/' + item.id + '/editar'}><PencilLine aria-hidden="true" />Editar publicación</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
      </div><h1>{item.title}</h1></header>
      <div className="reading-post-body">{item.content ? <DocumentView document={item.content} images={item.images} /> : <><p className="forum-prose">{item.body}</p><PostImages images={item.images} /></>}</div>
      {(item.category || item.tags.length > 0) && <div className="reading-taxonomy">{item.category && <Link to={'/?categoria=' + item.category.id} className="reading-category">{item.category.name}</Link>}{item.tags.map(tag => <Link key={tag.id} to={'/?etiqueta=' + tag.id} className="reading-tag">{tag.name}</Link>)}</div>}
      <footer className="reading-post-actions"><VoteButtons votes={item.votes} path={'posts/' + item.id} participation={participation} onChange={votes => post.setData(current => current ? { ...current, votes } : current)} /><Button asChild variant="ghost" className="reading-action"><Link to={next} aria-label={item.replyCount + ' comentarios. Añadir comentario'}><MessageCircle aria-hidden="true" />{item.replyCount}</Link></Button><ShareLink path={'/publicaciones/' + item.id} title={item.title} /></footer>
    </article>
    {community.error && <p className="forum-error reading-inline-error" role="alert">{community.error} <button type="button" className="reading-retry" onClick={community.retry}>Reintentar</button></p>}
    <Discussion post={item} participation={participation} target={target} onCount={replyCount => post.setData(current => current ? { ...current, replyCount } : current)} />
  </div><PostContext post={item} community={community.data} /></div>
}
export function PostPage() {
  const auth = useAuth()
  const { postId = '' } = useParams()
  const valid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(postId)
  return <main id="forum-content" className="forum-main post-reading content-layout" tabIndex={-1}>
    {valid ? <PostContent key={postId + (auth.session.user?.id ?? 'guest') + auth.status} id={postId} /> : <ForumEmpty title="Esta publicación no existe"><p>Vuelve al foro para encontrar otra conversación.</p><Link to="/">Ver publicaciones</Link></ForumEmpty>}
  </main>
}
