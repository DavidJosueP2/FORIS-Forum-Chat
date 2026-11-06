// Archivos SVG propios: no convertirlos a data: URLs, que la CSP de Foris rechaza.
import welcome from '@/assets/characters/welcome.svg?no-inline'
import happy from '@/assets/characters/happy.svg?no-inline'
import curious from '@/assets/characters/curious.svg?no-inline'
import calm from '@/assets/characters/calm.svg?no-inline'
import inspired from '@/assets/characters/inspired.svg?no-inline'
import surprised from '@/assets/characters/surprised.svg?no-inline'
import shy from '@/assets/characters/shy.svg?no-inline'
import sleepy from '@/assets/characters/sleepy.svg?no-inline'
import thoughtful from '@/assets/characters/thoughtful.svg?no-inline'

import mimoBrand from '@/assets/characters/scenes/mimo-brand.svg?no-inline'
import mimoLogin from '@/assets/characters/scenes/mimo-login.svg?no-inline'
import mimoChat from '@/assets/characters/scenes/mimo-chat.svg?no-inline'
import lupaForumSearch from '@/assets/characters/scenes/lupa-forum-search.svg?no-inline'
import lupaCommunitySearch from '@/assets/characters/scenes/lupa-community-search.svg?no-inline'
import nubeInbox from '@/assets/characters/scenes/nube-inbox.svg?no-inline'
import nubeProfilePosts from '@/assets/characters/scenes/nube-profile-posts.svg?no-inline'
import nubeProfileCommunities from '@/assets/characters/scenes/nube-profile-communities.svg?no-inline'
import nubeCommunityList from '@/assets/characters/scenes/nube-community-list.svg?no-inline'
import chispaCommunityStart from '@/assets/characters/scenes/chispa-community-start.svg?no-inline'
import chispaForumStart from '@/assets/characters/scenes/chispa-forum-start.svg?no-inline'
import chispaCommunityDiscovery from '@/assets/characters/scenes/chispa-community-discovery.svg?no-inline'
import pipaFirstComment from '@/assets/characters/scenes/pipa-first-comment.svg?no-inline'
import ohInvitation from '@/assets/characters/scenes/oh-invitation.svg?no-inline'
import lentoFollowing from '@/assets/characters/scenes/lento-following.svg?no-inline'
import hiloEditorHelp from '@/assets/characters/scenes/hilo-editor-help.svg?no-inline'
import brioProfileSaved from '@/assets/characters/scenes/brio-profile-saved.svg?no-inline'

import mimoCanvas from '@/assets/characters/scenes/mimo-canvas.svg?no-inline'
import brioCanvas from '@/assets/characters/scenes/brio-canvas.svg?no-inline'
import chispaCanvas from '@/assets/characters/scenes/chispa-canvas.svg?no-inline'

export const forisCharacters = {
  welcome: { src: welcome, name: 'Mimo', feeling: 'Bienvenida' },
  happy: { src: happy, name: 'Brío', feeling: 'Alegría' },
  curious: { src: curious, name: 'Lupa', feeling: 'Curiosidad' },
  calm: { src: calm, name: 'Nube', feeling: 'Calma' },
  inspired: { src: inspired, name: 'Chispa', feeling: 'Inspiración' },
  surprised: { src: surprised, name: 'Oh', feeling: 'Sorpresa' },
  shy: { src: shy, name: 'Pipa', feeling: 'Timidez' },
  sleepy: { src: sleepy, name: 'Lento', feeling: 'Sueño' },
  thoughtful: { src: thoughtful, name: 'Hilo', feeling: 'Reflexión' },
} as const

export type ForisMood = keyof typeof forisCharacters

const avatarMoods: readonly ForisMood[] = ['welcome', 'happy', 'curious', 'calm', 'inspired', 'surprised', 'shy', 'sleepy', 'thoughtful']

/** Mezcla estable para elegir variantes visuales por identidad. */
function characterHash(identity: string): number {
  let hash = 2166136261
  for (let index = 0; index < identity.length; index++) hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619)
  return hash >>> 0
}

export function avatarMood(identity: string): ForisMood {
  return avatarMoods[characterHash(identity) % avatarMoods.length] ?? 'welcome'
}

/** Posturas de los mismos personajes, específicas de cada contexto de la interfaz. */
export const forisScenes = {
  canvasWelcome: { src: mimoCanvas, mood: 'welcome', gesture: 'greet' },
  canvasHappy: { src: brioCanvas, mood: 'happy', gesture: 'nod' },
  canvasInspired: { src: chispaCanvas, mood: 'inspired', gesture: 'spark' },
  brand: { src: mimoBrand, mood: 'welcome', gesture: 'none' },
  login: { src: mimoLogin, mood: 'welcome', gesture: 'greet' },
  chat: { src: mimoChat, mood: 'welcome', gesture: 'peek' },
  forumSearch: { src: lupaForumSearch, mood: 'curious', gesture: 'peek' },
  communitySearch: { src: lupaCommunitySearch, mood: 'curious', gesture: 'nod' },
  inbox: { src: nubeInbox, mood: 'calm', gesture: 'settle' },
  profilePosts: { src: nubeProfilePosts, mood: 'calm', gesture: 'settle' },
  profileCommunities: { src: nubeProfileCommunities, mood: 'calm', gesture: 'nod' },
  communityList: { src: nubeCommunityList, mood: 'calm', gesture: 'settle' },
  communityStart: { src: chispaCommunityStart, mood: 'inspired', gesture: 'spark' },
  forumStart: { src: chispaForumStart, mood: 'inspired', gesture: 'spark' },
  communityDiscovery: { src: chispaCommunityDiscovery, mood: 'inspired', gesture: 'nod' },
  firstComment: { src: pipaFirstComment, mood: 'shy', gesture: 'peek' },
  invitation: { src: ohInvitation, mood: 'surprised', gesture: 'nod' },
  following: { src: lentoFollowing, mood: 'sleepy', gesture: 'settle' },
  editorHelp: { src: hiloEditorHelp, mood: 'thoughtful', gesture: 'nod' },
  profileSaved: { src: brioProfileSaved, mood: 'happy', gesture: 'greet' },
} as const satisfies Record<string, { src: string; mood: ForisMood; gesture: 'none' | 'greet' | 'peek' | 'settle' | 'spark' | 'nod' }>

export type ForisScene = keyof typeof forisScenes

const positiveScenes = ['canvasWelcome', 'canvasHappy', 'canvasInspired'] as const

/** Se elige al abrir el borrador y el consumidor conserva la postura mientras se escribe. */
export function canvasCompanion(identity: string): typeof positiveScenes[number] {
  return positiveScenes[characterHash(identity) % positiveScenes.length] ?? 'canvasWelcome'
}
