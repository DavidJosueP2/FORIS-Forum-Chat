import { useEffect, useRef, useState } from 'react'
import type { ForumPage } from '@messages/contracts'
import { accountError, accountRequest } from '@/features/account/api/account-api'

export function useResource<T>(path: string | null, scope = '') {
  const identity = path === null ? null : path + '\0' + scope
  const [state, setState] = useState<{ identity: string | null; data: T | null; error: string | null; loading: boolean }>({ identity, data: null, error: null, loading: Boolean(path) })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    void accountRequest<T>(path, 'GET', undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ identity, data, error: null, loading: false }) })
      .catch(cause => { if (!controller.signal.aborted) setState({ identity, data: null, error: accountError(cause), loading: false }) })
    return () => controller.abort()
  }, [path, identity, attempt])
  const current = path !== null && state.identity === identity
  return { data: current ? state.data : null, error: current ? state.error : null, loading: path !== null && (!current || state.loading), setData: (data: T | ((previous: T | null) => T | null)) => setState(previous => ({ identity, data: typeof data === 'function' ? (data as (previous: T | null) => T | null)(previous.identity === identity ? previous.data : null) : data, error: null, loading: false })), retry: () => {
    setState(previous => ({ identity, data: previous.identity === identity ? previous.data : null, error: null, loading: Boolean(path) }))
    setAttempt(current => current + 1)
  } }
}

/** El consumidor se monta con key=path: una consulta nueva no hereda la página anterior. */
export function useForumPage<T extends { id: string }>(path: string, incoming: T[] = []) {
  const initial = useResource<ForumPage<T>>(path)
  const [more, setMore] = useState<T[]>([])
  const [cursor, setCursor] = useState<{ hasMore: boolean; nextCursor: string | null } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [added, setAdded] = useState<T[]>([])
  const [changed, setChanged] = useState<Record<string, T>>({})
  const guard = useRef(false)
  const alive = useRef(true)
  const moreRequest = useRef<AbortController | null>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false; moreRequest.current?.abort() } }, [])
  const pagination = cursor ?? initial.data
  const items = [...incoming, ...added, ...(initial.data?.items ?? []), ...more].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).map(item => changed[item.id] ?? item)
  async function loadMore() {
    if (guard.current || !pagination?.hasMore || !pagination.nextCursor) return
    guard.current = true
    setLoadingMore(true)
    setMoreError(null)
    const controller = new AbortController()
    moreRequest.current = controller
    try {
      const page = await accountRequest<ForumPage<T>>(path + (path.includes('?') ? '&' : '?') + 'before=' + encodeURIComponent(pagination.nextCursor), 'GET', undefined, controller.signal)
      if (!alive.current) return
      setMore(current => [...current, ...page.items])
      setCursor(page)
    } catch (cause) { if (alive.current) setMoreError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setLoadingMore(false) }
  }
  return { items, ready: initial.data !== null, loading: initial.loading, error: initial.error, retry: initial.retry,
    hasMore: pagination?.hasMore ?? false, loadingMore, moreError, loadMore,
    prepend: (item: T) => setAdded(current => [item, ...current]),
    update: (item: T) => setChanged(current => ({ ...current, [item.id]: item })) }
}
