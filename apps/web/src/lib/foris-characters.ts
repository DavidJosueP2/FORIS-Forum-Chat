import welcome from '@/assets/characters/welcome.svg'
import happy from '@/assets/characters/happy.svg'
import curious from '@/assets/characters/curious.svg'
import calm from '@/assets/characters/calm.svg'
import inspired from '@/assets/characters/inspired.svg'
import surprised from '@/assets/characters/surprised.svg'
import shy from '@/assets/characters/shy.svg'
import sleepy from '@/assets/characters/sleepy.svg'
import thoughtful from '@/assets/characters/thoughtful.svg'

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
