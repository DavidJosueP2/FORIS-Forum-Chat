import { publicProfileLink } from '@/features/account/lib/public-profile'
import type { Community, ForumAuthorProfile, ForumPage, ForumPost } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { LockKeyhole, UsersRound } from 'lucide-react'
import { useAuth } from '@/features/account/hooks/use-auth'
import { IdentityImage } from '@/features/media/components/identity-image'
import { useResource } from '../hooks/use-forum'
import { categoryLink, tagLink } from '../discovery/discovery-query'
import './content-layout.css'

export function CommunityContext({ community }: { community: Community }) {
  return <section className="context-section"><h2>{community.visibility === 'private' ? 'Tu comunidad' : 'Comunidad'}</h2><Link to={'/comunidades/' + community.id} className="context-identity"><IdentityImage fallbackKey={'community:' + community.id} mediaId={community.imageId} name={community.name} className="context-avatar" /><strong>{community.name}</strong>{community.visibility === 'private' && <LockKeyhole aria-label="Privada" />}</Link><p className="context-description">{community.description}</p><p className="context-count"><UsersRound aria-hidden="true" />{community.memberCount} {community.memberCount === 1 ? 'miembro' : 'miembros'}</p></section>
}
export function HomeContext() {
  const auth = useAuth()
  const communities = useResource<ForumPage<Community>>('communities?limit=4', (auth.session.user?.id ?? 'guest') + auth.status)
  return <aside className="context-rail" aria-label="Comunidades para explorar"><section className="context-section"><h2>Comunidades para explorar</h2>
    {communities.loading && !communities.data ? <p className="context-note" role="status">Cargando comunidades…</p> : communities.error ? <p className="context-note">Las comunidades no están disponibles. <button type="button" className="context-retry" onClick={communities.retry}>Reintentar</button></p> : communities.data?.items.length ? <ul className="context-communities">{communities.data.items.map(item => <li key={item.id}><Link to={'/comunidades/' + item.id} className="context-identity"><IdentityImage fallbackKey={'community:' + item.id} mediaId={item.imageId} name={item.name} className="context-avatar" /><span><strong>{item.name}</strong><small>{item.memberCount} {item.memberCount === 1 ? 'miembro' : 'miembros'}</small></span></Link></li>)}</ul> : <p className="context-note">Todavía no hay comunidades.</p>}
    <Link className="context-link" to="/comunidades">Explorar comunidades</Link><Link className="context-link" to="/comunidades/crear">Crear una comunidad</Link>
  </section></aside>
}
export function PostContext({ post, community }: { post: ForumPost; community: Community | null }) {
  const auth = useAuth()
  const author = useResource<ForumAuthorProfile>('authors/' + post.author.id, (auth.session.user?.id ?? 'guest') + auth.status)
  return <aside className="context-rail" aria-label="Sobre el autor y la publicación"><section className="context-section"><h2>Sobre el autor</h2><Link to={publicProfileLink(post.author.id)} className="context-identity"><IdentityImage fallbackKey={'user:' + post.author.id} mediaId={post.author.avatarId} name={post.author.displayName} className="context-avatar" /><strong>{post.author.displayName}</strong></Link>{author.data?.bio && <p className="context-description">{author.data.bio}</p>}<Link className="context-link" to={publicProfileLink(post.author.id)}>Ver perfil</Link></section>
    {community && <CommunityContext community={community} />}
    {(post.category || post.tags.length > 0) && <section className="context-section"><h2>En esta publicación</h2><div className="context-taxonomy">{post.category && <Link to={categoryLink(post.category.id)}>{post.category.name}</Link>}{post.tags.map(tag => <Link to={tagLink(tag.id)} key={tag.id}>{tag.name}</Link>)}</div></section>}
  </aside>
}
