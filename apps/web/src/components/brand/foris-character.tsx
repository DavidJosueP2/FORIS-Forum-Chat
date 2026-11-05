import type { ComponentProps } from 'react'

import { forisCharacters, type ForisMood } from '@/lib/foris-characters'
import { cn } from '@/lib/utils'

type ForisCharacterProps = Omit<ComponentProps<'img'>, 'src' | 'srcSet' | 'children'> & {
  mood: ForisMood
}

/** Sin alt, el personaje es decorativo. Si aporta información, describe su contexto. */
export function ForisCharacter({
  mood,
  alt = '',
  width = 160,
  height = 160,
  className,
  ...props
}: ForisCharacterProps) {
  return (
    <img
      {...props}
      src={forisCharacters[mood].src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={width}
      height={height}
      decoding="async"
      draggable={false}
      data-mood={mood}
      className={cn('block h-auto max-w-full shrink-0', className)}
    />
  )
}
