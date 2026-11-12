import { publicProfileLink } from '@/features/account/lib/public-profile'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ForumPostSummary, ForumVotes, MediaImage } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { ArrowRight, Images, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/account/hooks/use-auth'
import { loginLink } from '@/features/account/lib/return-target'
import { IdentityImage } from '@/features/media/components/identity-image'
import { ForisCharacter } from '@/components/brand/foris-character'
import { PrivateImage } from '@/features/media/components/private-image'
import { ForumEmpty, ForumError, ForumLoading, ForumTime } from '../components/forum-states'
import { useForumPage } from '../hooks/use-forum'
import { PostTaxonomy } from './post-taxonomy'
import { FollowButton } from '../following/follow-button'
import { ShareLink, VoteButtons } from '../reading/reading-actions'

function FeedImage({ image, title }: { image: MediaImage; title: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (visible || !container.current) return
    if (!('IntersectionObserver' in window)) { const frame = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(frame) }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() } }, { rootMargin: '400px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [visible])
  const ratio = Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0 ? image.width + ' / ' + image.height : '16 / 10'
  return <div ref={container} className="discovery-feed-image" style={{ aspectRatio: ratio }}>{visible ? <PrivateImage image={image} alt={'Imagen de la publicación «' + title + '»'} /> : <div className="discovery-image-placeholder" aria-hidden="true" />}</div>
}
function FeedPost({ post, onVote }: { post: ForumPostSummary; onVote: (votes: ForumVotes) => void }) {
  const auth = useAuth()
  const path = '/publicaciones/' + post.id
  const userId = auth.session.user?.id ?? null
  const participation = {
    userId,
    pending: auth.status === 'loading',
    href: !userId ? loginLink(path) : post.community && post.canVote === false ? '/comunidades/' + post.community.id : null,
  }
  return <article className="discovery-post" aria-labelledby={'discovery-post-' + post.id}>
    <header className="discovery-post-meta"><Link to={publicProfileLink(post.author.id)} className="discovery-post-author" aria-label={'Ver perfil de ' + post.author.displayName}><IdentityImage fallbackKey={'user:' + post.author.id} mediaId={post.author.avatarId} name={post.author.displayName} className="discovery-author-avatar" /><span>{post.author.displayName}</span></Link>
      <ForumTime value={post.createdAt} />{post.community && <span className="discovery-post-community">en <Link to={'/comunidades/' + post.community.id}>{post.community.name}</Link></span>}<FollowButton id={post.author.id} name={post.author.displayName} initial={post.author.isFollowing} compact />
    </header>
    <PostTaxonomy category={post.category} tags={post.tags} />
    <h3 id={'discovery-post-' + post.id} className="discovery-post-title"><Link to={path}>{post.title}</Link></h3>
    {post.excerpt && <p className="discovery-post-excerpt">{post.excerpt}</p>}
    {post.images[0] && <div className="discovery-post-visual"><FeedImage image={post.images[0]} title={post.title} />{post.images.length > 1 && <Link to={path} className="discovery-image-more"><Images aria-hidden="true" />Ver {post.images.length} imágenes</Link>}</div>}
    <footer className="discovery-post-actions">
      {post.votes && <VoteButtons votes={post.votes} path={'posts/' + post.id} participation={participation} onChange={onVote} />}
      <Link to={path + (post.replyCount ? '#respuestas' : '#responder')} className="discovery-post-action"><MessageCircle aria-hidden="true" />{post.replyCount ? post.replyCount + (post.replyCount === 1 ? ' respuesta' : ' respuestas') : 'Responder'}</Link>
      <ShareLink path={path} title={post.title} className="discovery-post-action" fallback="channels" />
      <Link to={path} className="discovery-read-post">Leer publicación<ArrowRight aria-hidden="true" /></Link>
    </footer>
  </article>
}
export function DiscoveryFeed({ path, filtered, onClear, following = false, discoverHref = '/', emptyState }: { path: string; filtered: boolean; onClear: () => void; following?: boolean; discoverHref?: string; emptyState?: ReactNode }) {
  const page = useForumPage<ForumPostSummary>(path)
  if (page.loading && !page.ready) return <ForumLoading label="Cargando publicaciones…" />
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length && emptyState) return emptyState
  if (!page.items.length && following && !filtered) return <div className="discovery-follow-empty has-character"><ForisCharacter scene="following" width={80} height={80} /><div><h2>Aún no hay publicaciones aquí</h2><p>Sigue autores o únete a comunidades para encontrar sus próximas publicaciones aquí.</p><Button asChild variant="secondary" className="h-11"><Link to={discoverHref}>Explorar Para ti</Link></Button><Button asChild variant="ghost" className="h-11"><Link to="/comunidades">Buscar comunidades</Link></Button></div></div>
  if (!page.items.length) return <ForumEmpty scene={filtered ? 'forumSearch' : 'forumStart'} placement={filtered ? 'beside' : 'above'} title={filtered ? 'No encontramos publicaciones con estos filtros' : 'Todavía no hay publicaciones'}><p>{filtered ? 'Prueba otra temática, quita una etiqueta o cambia la búsqueda.' : 'Comparte una idea, una pregunta o algo que estés creando.'}</p>{filtered ? <Button type="button" variant="secondary" className="h-11 mt-5" onClick={onClear}>Quitar filtros</Button> : <Button asChild variant="secondary" className="h-11 mt-5"><Link to="/publicar">Crear publicación</Link></Button>}</ForumEmpty>
  return <><p className="sr-only" role="status">Publicaciones cargadas. {filtered ? 'Se aplicaron los filtros seleccionados.' : 'Más recientes primero.'}</p><ol className="discovery-feed-list" aria-label="Publicaciones">{page.items.map(post => <li key={post.id}><FeedPost post={post} onVote={votes => page.update({ ...post, votes })} /></li>)}</ol>
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}{page.hasMore && <Button type="button" variant="secondary" className="discovery-feed-more h-11" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más publicaciones'}</Button>}
  </>
}
