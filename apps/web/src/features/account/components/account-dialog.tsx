import { UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export function AccountDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="account-trigger h-11 px-4" aria-label="Tu cuenta">
          <UserRound aria-hidden="true" />
          <span>Tu cuenta</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="foris-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl leading-snug">Tu lugar en Foris</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            Las cuentas llegarán pronto. Podrás crear tu perfil o entrar con Google.
            Mientras tanto, la conversación está abierta para ti.
          </DialogDescription>
        </DialogHeader>
        <div className="account-options">
          <Button disabled className="h-12 w-full" aria-describedby="account-availability">
            Continuar con Google
          </Button>
          <p id="account-availability" className="text-center text-sm text-muted-foreground">
            Registro e inicio de sesión disponibles próximamente.
          </p>
        </div>
        <DialogClose asChild>
          <Button variant="secondary" className="h-11 w-full">Seguir como invitado</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
