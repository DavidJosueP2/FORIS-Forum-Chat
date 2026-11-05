import type { ReactNode } from 'react'
import type { Community } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useResource } from '@/features/forum/hooks/use-forum'
import { ForumError, ForumLoading } from '@/features/forum/components/forum-states'

export function CommunityWritingGate({ communityId, children }: { communityId: string; children: ReactNode }) {
  const community = useResource<Community>('communities/' + communityId)
  if (community.loading) return <ForumLoading label="Comprobando tu comunidad…" />
  if (community.error) return <ForumError message={community.error} retry={community.retry} />
  if (!community.data?.membership) return <section className="forum-join"><h2>Forma parte de esta conversación</h2><p>Únete a {community.data?.name ?? 'la comunidad'} para publicar y responder. Puedes seguir leyendo sin unirte.</p><Button asChild className="h-11 mt-5 px-6"><Link to={'/comunidades/' + communityId}>Ir a la comunidad</Link></Button></section>
  return <><p className="forum-hint mb-6">Participas en <Link to={'/comunidades/' + communityId}>{community.data.name}</Link>.</p>{children}</>
}
