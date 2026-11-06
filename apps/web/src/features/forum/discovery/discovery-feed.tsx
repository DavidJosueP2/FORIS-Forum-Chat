import { useEffect, useId, useRef, useState } from 'react'
import type { ForumPostSummary, MediaImage } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Copy, Images, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { IdentityImage } from '@/features/media/components/identity-image'
import { PrivateImage } from '@/features/media/components/private-image'
import { ForumEmpty, ForumError, ForumLoading, ForumTime } from '../components/forum-states'
import { useForumPage } from '../hooks/use-forum'
import { categoryLink, tagLink } from './discovery-query'

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
function CopyPostLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const fieldId = useId()
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function copy() {
    if (busy) return
    setBusy(true)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Manual copy required')
      await navigator.clipboard.writeText(new URL('/publicaciones/' + id, window.location.origin).href)
      if (alive.current) { setCopied(true); setManual(false) }
    } catch { if (alive.current) setManual(true) }
    finally { if (alive.current) setBusy(false) }
  }
  return <Popover open={manual} onOpenChange={setManual}><PopoverAnchor asChild><Button ref={button} type="button" variant="ghost" className="discovery-post-action h-11" disabled={busy} onClick={() => void copy()} aria-label={copied ? 'Enlace copiado' : 'Copiar enlace de la publicación'} title="Copiar enlace">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</span></Button></PopoverAnchor>
    <PopoverContent className="discovery-copy-panel" aria-label="Copiar enlace de la publicación" align="end" onCloseAutoFocus={event => { event.preventDefault(); button.current?.focus() }}><label htmlFor={fieldId}>Copia el enlace de esta publicación</label><input id={fieldId} readOnly value={new URL('/publicaciones/' + id, window.location.origin).href} onFocus={event => event.currentTarget.select()} /></PopoverContent>
  </Popover>
}
function FeedPost({ post }: { post: ForumPostSummary }) {
  const path = '/publicaciones/' + post.id
  return <article className="discovery-post" aria-labelledby={'discovery-post-' + post.id}>
    <header className="discovery-post-meta"><Link to={'/?autor=' + encodeURIComponent(post.author.id)} className="discovery-post-author" aria-label={'Ver publicaciones de ' + post.author.displayName}><IdentityImage mediaId={post.author.avatarId} name={post.author.displayName} className="discovery-author-avatar" /><span>{post.author.displayName}</span></Link>
      {post.community && <span className="discovery-post-community">en <Link to={'/comunidades/' + post.community.id}>{post.community.name}</Link></span>}<ForumTime value={post.createdAt} />
    </header>
    <h3 id={'discovery-post-' + post.id} className="discovery-post-title"><Link to={path}>{post.title}</Link></h3>
    {post.excerpt && <p className="discovery-post-excerpt">{post.excerpt}</p>}
    {post.images[0] && <div className="discovery-post-visual"><FeedImage image={post.images[0]} title={post.title} />{post.images.length > 1 && <Link to={path} className="discovery-image-more"><Images aria-hidden="true" />Ver {post.images.length} imágenes</Link>}</div>}
    <div className="discovery-post-taxonomy">{post.category && <Link to={categoryLink(post.category.id)} className="discovery-post-category">{post.category.name}</Link>}{post.tags.map(tag => <Link to={tagLink(tag.id)} className="discovery-post-tag" key={tag.id}>{tag.name}</Link>)}</div>
    <footer className="discovery-post-actions"><Link to={path + (post.replyCount ? '#respuestas' : '#responder')} className="discovery-post-action"><MessageCircle aria-hidden="true" />{post.replyCount ? post.replyCount + (post.replyCount === 1 ? ' respuesta' : ' respuestas') : 'Responder'}</Link><CopyPostLink id={post.id} /><Link to={path} className="discovery-read-post">Leer publicación<ArrowRight aria-hidden="true" /></Link></footer>
  </article>
}
export function DiscoveryFeed({ path, filtered, onClear }: { path: string; filtered: boolean; onClear: () => void }) {
  const page = useForumPage<ForumPostSummary>(path)
  if (page.loading && !page.ready) return <ForumLoading label="Cargando publicaciones…" />
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length) return <ForumEmpty title={filtered ? 'No encontramos publicaciones con estos filtros' : 'Todavía no hay publicaciones'}><p>{filtered ? 'Prueba otra temática, quita una etiqueta o cambia la búsqueda.' : 'Comparte una idea, una pregunta o algo que estés creando.'}</p>{filtered ? <Button type="button" variant="secondary" className="h-11 mt-5" onClick={onClear}>Quitar filtros</Button> : <Button asChild variant="secondary" className="h-11 mt-5"><Link to="/publicar">Crear publicación</Link></Button>}</ForumEmpty>
  return <><p className="sr-only" role="status">Publicaciones cargadas. {filtered ? 'Se aplicaron los filtros seleccionados.' : 'Más recientes primero.'}</p><ol className="discovery-feed-list" aria-label="Publicaciones">{page.items.map(post => <li key={post.id}><FeedPost post={post} /></li>)}</ol>
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}{page.hasMore ? <Button type="button" variant="secondary" className="discovery-feed-more h-11" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más publicaciones'}</Button> : <p className="discovery-feed-end">Eso es todo por ahora.</p>}
  </>
}
