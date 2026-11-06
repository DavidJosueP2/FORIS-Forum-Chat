import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteFocus() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>('main')
      const target = hash ? document.getElementById(hash.slice(1)) : null
      if (pathname.startsWith('/personas/') && !hash && document.activeElement instanceof HTMLElement && document.activeElement.closest('[data-profile-navigation]')) return
      if (pathname === '/' && !hash) {
        // Conservar la edición del buscador y las selecciones consecutivas de filtros.
        // Los enlaces de publicaciones desmontan su destino anterior: en ese caso,
        // llevar el foco a los resultados nuevos, en vez de dejarlo en body.
        const dialog = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')
        if (dialog) return
        const active = document.activeElement
        if (active instanceof HTMLElement && active.closest('[data-discovery-control]')) { window.scrollTo({ top: 0, left: 0 }); return }
        const results = document.getElementById('discovery-heading')
        if (results) { results.focus({ preventScroll: true }); window.scrollTo({ top: 0, left: 0 }); return }
      }
      if (target) {
        target.focus({ preventScroll: true })
        target.scrollIntoView()
      } else {
        main?.focus({ preventScroll: true })
        window.scrollTo({ top: 0, left: 0 })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, search, hash])
  return null
}
