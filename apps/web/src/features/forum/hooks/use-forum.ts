import { useEffect, useRef, useState } from 'react'
import type { ForumPage } from '@messages/contracts'
import { accountError, accountRequest } from '@/features/account/api/account-api'

export function useResource<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void accountRequest<T>(path, 'GET', undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ data, error: null, loading: false }) })
      .catch(cause => { if (!controller.signal.aborted) setState(current => ({ ...current, error: accountError(cause), loading: false })) })
    return () => controller.abort()
  }, [path, attempt])
  return { ...state, setData: (data: T) => setState({ data, error: null, loading: false }), retry: () => {
    setState(current => ({ ...current, error: null, loading: true }))
    setAttempt(current => current + 1)
  } }
}

/** El consumidor se monta con key=path: una consulta nueva no hereda la página anterior. */
export function useForumPage<T extends { id: string }>(path: string) {
  const initial = useResource<ForumPage<T>>(path)
  const [more, setMore] = useState<T[]>([])
  const [cursor, setCursor] = useState<{ hasMore: boolean; nextCursor: string | null } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [added, setAdded] = useState<T[]>([])
  const guard = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const pagination = cursor ?? initial.data
  const items = [...added, ...(initial.data?.items ?? []), ...more].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
  async function loadMore() {
    if (guard.current || !pagination?.hasMore || !pagination.nextCursor) return
    guard.current = true
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await accountRequest<ForumPage<T>>(path + (path.includes('?') ? '&' : '?') + 'before=' + pagination.nextCursor)
      if (!alive.current) return
      setMore(current => [...current, ...page.items])
      setCursor(page)
    } catch (cause) { if (alive.current) setMoreError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setLoadingMore(false) }
  }
  return { items, ready: initial.data !== null, loading: initial.loading, error: initial.error, retry: initial.retry,
    hasMore: pagination?.hasMore ?? false, loadingMore, moreError, loadMore,
    prepend: (item: T) => setAdded(current => [item, ...current]) }
}
