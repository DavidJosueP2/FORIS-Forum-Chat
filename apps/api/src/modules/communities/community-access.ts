/** Solo alias internos constantes; el usuario siempre se pasa como parámetro SQL. */
export function readableCommunity(alias: 'c' | 'read_community', viewer: string): string {
  return `(${alias}.visibility='public' OR EXISTS(SELECT 1 FROM community_memberships read_membership
    WHERE read_membership.community_id=${alias}.id AND read_membership.user_id=${viewer}::uuid))`;
}
export function readablePost(viewer: string): string {
  return `(p.community_id IS NULL OR EXISTS(SELECT 1 FROM communities read_community WHERE read_community.id=p.community_id AND ${readableCommunity('read_community', viewer)}))`;
}
/** Un perfil público no amplía su contenido cuando quien lo visita pertenece a una comunidad privada. */
export function publicPost(): string {
  return `(p.community_id IS NULL OR EXISTS(SELECT 1 FROM communities public_community WHERE public_community.id=p.community_id AND public_community.visibility='public'))`;
}
