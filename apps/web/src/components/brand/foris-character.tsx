import type { ComponentProps } from 'react'

import { forisCharacters, forisScenes, type ForisMood, type ForisScene } from '@/lib/foris-characters'
import { cn } from '@/lib/utils'
import './foris-character.css'

type ForisCharacterProps = Omit<ComponentProps<'img'>, 'src' | 'srcSet' | 'children'> & (
  { mood: ForisMood; scene?: never } | { scene: ForisScene; mood?: never }
)

/** Sin alt, el personaje es decorativo. Si aporta información, describe su contexto. */
export function ForisCharacter({
  mood,
  scene,
  alt = '',
  width = 160,
  height = 160,
  className,
  ...props
}: ForisCharacterProps) {
  const character = scene ? forisScenes[scene] : forisCharacters[mood ?? 'welcome']
  return (
    <img
      {...props}
      src={character.src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={width}
      height={height}
      decoding="async"
      draggable={false}
      data-mood={scene ? forisScenes[scene].mood : mood}
      data-scene={scene}
      data-gesture={scene ? forisScenes[scene].gesture : undefined}
      className={cn('foris-character block h-auto max-w-full shrink-0', className)}
    />
  )
}
