import { useId, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MAX_AUTHOR_LENGTH, type GuestProfile } from '../lib/guest-session'

export function CommunityNotes() {
  return (
    <ul className="community-notes">
      <li>
        <h3>Una conversación abierta</h3>
        <p>Cualquiera puede leer y participar. Lo que compartes aquí es público.</p>
      </li>
      <li>
        <h3>El respeto va primero</h3>
        <p>Escucha otras ideas y conversa sin ataques personales.</p>
      </li>
      <li>
        <h3>Cuida lo que compartes</h3>
        <p>Evita publicar datos personales tuyos o de otras personas.</p>
      </li>
    </ul>
  )
}

export function RoomInfoDialog({ compact = false }: { compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={compact ? 'h-11 w-11 p-0' : 'sidebar-info h-11'}
          aria-label="Información de General"
        >
          <Info aria-hidden="true" />
          {!compact && <span>Sobre este espacio</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="foris-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">Así conversamos en General</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            Un espacio compartido para preguntar, encontrar otras ideas y decir hola.
            Los nombres de invitado no son identidades verificadas.
          </DialogDescription>
        </DialogHeader>
        <CommunityNotes />
      </DialogContent>
    </Dialog>
  )
}

interface GuestNameDialogProps {
  profile: GuestProfile
  onNameChange: (name: string) => void
}

export function GuestNameDialog({ profile, onNameChange }: GuestNameDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        setOpen(value)
        if (value) {
          setName(profile.name === 'Invitado' ? '' : profile.name)
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="guest-name-trigger h-11"
          aria-label={'Cambiar nombre de invitado: ' + profile.name}
        >
          <span>{profile.name}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="foris-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">¿Cómo te llamamos?</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            Elige un nombre para esta conversación. Seguirás participando como invitado.
          </DialogDescription>
        </DialogHeader>
        <form
          className="guest-name-form"
          onSubmit={event => {
            event.preventDefault()
            const normalized = name.trim() || 'Invitado'
            if ([...normalized].some(character => {
              const point = character.codePointAt(0) ?? 0
              return point < 32 || point === 127
            })) {
              setError('Usa un nombre sin saltos de línea ni caracteres de control.')
              return
            }
            onNameChange(normalized)
            setOpen(false)
          }}
        >
          <label htmlFor={id} className="text-sm font-medium">Nombre visible</label>
          <Input
            id={id}
            value={name}
            onChange={event => { setName(event.target.value); setError(null) }}
            maxLength={MAX_AUTHOR_LENGTH}
            placeholder="Invitado"
            autoComplete="nickname"
            className="h-12 text-base"
            aria-invalid={Boolean(error)}
            aria-describedby={id + '-help'}
          />
          <p id={id + '-help'} className="text-sm text-muted-foreground">
            {error ?? 'No es una cuenta ni un nombre verificado. Deja el campo vacío para usar Invitado.'}
          </p>
          <Button type="submit" className="mt-2 h-11">Guardar nombre</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
