import { cn } from '@/lib/utils'
import { ForisCharacter } from './foris-character'
import './foris-family.css'

const family = ['thoughtful', 'surprised', 'sleepy', 'inspired', 'happy', 'curious', 'shy', 'calm', 'welcome'] as const

/** La familia acompaña el acceso; nombres y estados reales siguen en el formulario. */
export function ForisFamily({ className }: { className?: string }) {
  return <div className={cn('foris-family', className)} aria-hidden="true">
    {family.map(mood => mood === 'welcome'
      ? <ForisCharacter key={mood} scene="login" width={160} height={160} className="foris-family-member" />
      : <ForisCharacter key={mood} mood={mood} width={160} height={160} className="foris-family-member" />)}
  </div>
}
