import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteFocus() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>('main')
      const target = hash ? document.getElementById(hash.slice(1)) : null
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
