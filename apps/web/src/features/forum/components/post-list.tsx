import { Link } from 'react-router-dom'
import { ArrowUpRight, MessageSquare } from 'lucide-react'
import type { ForumPostSummary } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { PrivateImage } from '@/features/media/components/private-image'
import { ForumEmpty, ForumError, ForumLoading, ForumTime } from './forum-states'
import { useForumPage } from '../hooks/use-forum'
import { publicProfileLink } from '@/features/account/lib/public-profile'

export function PostList({ path, filtered, createTo = '/publicar', emptyTitle }: { path: string; filtered: boolean; createTo?: string; emptyTitle?: string }) {
  const page = useForumPage<ForumPostSummary>(path)
  if (page.loading && !page.ready) return <ForumLoading />
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length) return <ForumEmpty scene={filtered ? 'forumSearch' : 'communityStart'} title={emptyTitle ?? (filtered ? 'Sin resultados' : 'Aún no hay publicaciones')}>
    {filtered && <p>Prueba otra búsqueda.</p>}
    <Button asChild variant="secondary" className="h-11 mt-5 px-6"><Link to={filtered ? '/' : createTo}>{filtered ? 'Ver todos los foros' : 'Crear publicación'}</Link></Button>
  </ForumEmpty>
  return <>
    <ol className="forum-post-list" aria-label="Publicaciones más recientes">
      {page.items.map(post => <li key={post.id}><article className="forum-post-row">
        <div className="forum-meta"><Link to={'/?topico=' + post.topic.id} className="forum-topic-label">{post.topic.name}</Link>{post.community && <Link to={'/comunidades/' + post.community.id}>{post.community.name}</Link>}<Link to={publicProfileLink(post.author.id)} aria-label={'Ver perfil de ' + post.author.displayName}>{post.author.displayName}</Link><ForumTime value={post.createdAt} /></div>
        <h2><Link to={'/publicaciones/' + post.id}>{post.title}<ArrowUpRight aria-hidden="true" /></Link></h2>
        <p className="forum-excerpt">{post.excerpt}</p>
        {post.images[0] && <PrivateImage image={post.images[0]} thumbnail />}
        {post.images.length > 1 && <p className="forum-hint">{post.images.length} imágenes en esta publicación</p>}
        <Link to={'/publicaciones/' + post.id + '#respuestas'} className="forum-response-link"><MessageSquare aria-hidden="true" />{post.replyCount} {post.replyCount === 1 ? 'respuesta' : 'respuestas'}</Link>
      </article></li>)}
    </ol>
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}
    {page.hasMore && <Button variant="secondary" className="h-11 px-6 forum-more" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más publicaciones'}</Button>}
  </>
}
