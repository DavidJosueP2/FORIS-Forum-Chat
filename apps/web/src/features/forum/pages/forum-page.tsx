import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, MessageSquare, Plus, Search } from 'lucide-react'
import type { ForumPostSummary, ForumTopic } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ForumShell } from '../components/forum-shell'
import { ForumEmpty, ForumError, ForumLoading, ForumTime } from '../components/forum-states'
import { useForumPage, useResource } from '../hooks/use-forum'
import { PrivateImage } from '@/features/media/components/private-image'

export function PostList({ path, filtered, createTo = '/publicar', emptyTitle }: { path: string; filtered: boolean; createTo?: string; emptyTitle?: string }) {
  const page = useForumPage<ForumPostSummary>(path)
  if (page.loading && !page.ready) return <ForumLoading />
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length) return <ForumEmpty title={emptyTitle ?? (filtered ? 'Todavía no hay publicaciones aquí' : 'Una buena idea puede empezar contigo')}>
    <p>{filtered ? 'Prueba otro tópico o una búsqueda diferente.' : 'Comparte una pregunta, algo que aprendiste o una idea que quieras conversar.'}</p>
    <Button asChild variant="secondary" className="h-11 mt-5 px-6"><Link to={filtered ? '/' : createTo}>{filtered ? 'Ver todos los foros' : 'Crear la primera publicación'}</Link></Button>
  </ForumEmpty>
  return <>
    <ol className="forum-post-list" aria-label="Publicaciones más recientes">
      {page.items.map(post => <li key={post.id}><article className="forum-post-row">
        <div className="forum-meta"><Link to={'/?topico=' + post.topic.id} className="forum-topic-label">{post.topic.name}</Link>{post.community && <Link to={'/comunidades/' + post.community.id}>{post.community.name}</Link>}<span>{post.author.displayName}</span><ForumTime value={post.createdAt} /></div>
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
function ForumIndex() {
  const [params, setParams] = useSearchParams()
  const topic = params.get('topico') ?? ''
  const search = params.get('q') ?? ''
  const author = params.get('autor') ?? ''
  const [draftSearch, setDraftSearch] = useState(search)
  const topics = useResource<ForumTopic[]>('topics')
  const filters = new URLSearchParams()
  if (topic) filters.set('topic', topic)
  if (search) filters.set('search', search)
  if (author) filters.set('author', author)
  const path = 'posts?' + filters.toString()
  const selectedTopic = topics.data?.find(item => item.id === topic)
  function filterTopic(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('topico', value); else next.delete('topico')
    setParams(next)
  }
  return <ForumShell><main id="forum-content" className="forum-main" tabIndex={-1}>
    <header className="forum-intro">
      <div><h1>Las ideas se encuentran aquí.</h1><p>Preguntas que abren caminos. Historias que merecen una respuesta.</p></div>
      <Button asChild className="h-12 px-6"><Link to={'/publicar' + (topic ? '?topico=' + encodeURIComponent(topic) : '')}><Plus aria-hidden="true" />Nueva publicación</Link></Button>
    </header>
    <form className="forum-search" role="search" onSubmit={event => {
      event.preventDefault()
      const next = new URLSearchParams(params)
      if (draftSearch.trim()) next.set('q', draftSearch.trim()); else next.delete('q')
      setParams(next)
    }}>
      <label htmlFor="forum-search">Busca una idea o una pregunta</label>
      <div><Input id="forum-search" type="search" name="q" maxLength={120} value={draftSearch} onChange={event => setDraftSearch(event.target.value)} placeholder="¿Qué te gustaría leer?" /><Button type="submit" variant="secondary" className="h-12 px-5"><Search aria-hidden="true" />Buscar</Button></div>
    </form>
    <nav className="forum-topics" aria-label="Filtrar publicaciones por tópico">
      <Button variant={topic ? 'ghost' : 'secondary'} className="h-11 px-5" aria-pressed={!topic} onClick={() => filterTopic('')}>Todos</Button>
      {topics.data?.map(item => <Button key={item.id} variant={topic === item.id ? 'secondary' : 'ghost'} className="h-11 px-5" aria-pressed={topic === item.id} onClick={() => filterTopic(item.id)}>{item.name}</Button>)}
    </nav>
    {topics.loading && <ForumLoading label="Cargando tópicos…" />}
    {topics.error && <ForumError message={topics.error} retry={topics.retry} />}
    <section aria-labelledby="publications-heading">
      <div className="forum-list-heading"><div><h2 id="publications-heading">{search ? 'Resultados de la búsqueda' : author ? 'Publicaciones de este perfil' : selectedTopic?.name ?? 'Foros recientes'}</h2>{selectedTopic && <p>{selectedTopic.description}</p>}</div><span>Más recientes primero</span></div>
      {(search || author) && <p className="forum-active-filter">{search && <span>Buscando «{search}»</span>}<Link to={topic ? '/?topico=' + encodeURIComponent(topic) : '/'}>Quitar filtros</Link></p>}
      <PostList key={path} path={path} filtered={Boolean(topic || search || author)} />
    </section>
    <footer className="forum-footer"><p>El foro guarda las ideas. El chat abre la conversación.</p><Link to="/chat">Entrar al chat global <ArrowUpRight aria-hidden="true" /></Link></footer>
  </main></ForumShell>
}
export function ForumPage() {
  const [params] = useSearchParams()
  return <ForumIndex key={params.toString()} />
}
