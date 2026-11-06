import { useEffect, useRef, useState } from 'react'
import type { ForumDocument, ForumPost } from '@messages/contracts'
import { emptyDocument, legacyDocument, documentFromPost, restorableDocument } from './document'

export interface CanvasDraft {
  title: string; content: ForumDocument; categoryId: string | null; legacyTopicId: string;
  tags: string[]; communityId: string | null; requestId: string; revision?: number;
}
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu
function fromPost(post: ForumPost): CanvasDraft {
  return { title: post.title, content: documentFromPost(post), categoryId: post.category?.id ?? null, legacyTopicId: '',
    tags: post.tags.map(tag => tag.name), communityId: post.community?.id ?? null, requestId: crypto.randomUUID(), revision: post.revision }
}
function restore(key: string, userId: string, communityId: string | null, topicId: string, post?: ForumPost): CanvasDraft {
  const blank: CanvasDraft = post ? fromPost(post) : { title: '', content: emptyDocument(), categoryId: null, legacyTopicId: topicId, tags: [], communityId, requestId: crypto.randomUUID() }
  try {
    const raw = sessionStorage.getItem(key)
    if (raw && raw.length <= 1000000) {
      const value = JSON.parse(raw) as CanvasDraft
      if (value && typeof value.title === 'string' && value.title.length <= 10000 && restorableDocument(value.content)
        && (value.categoryId === null || uuid.test(value.categoryId)) && typeof value.legacyTopicId === 'string'
        && Array.isArray(value.tags) && value.tags.length <= 32 && value.tags.every(tag => typeof tag === 'string' && tag.length <= 128)
        && (value.communityId === null || /^[1-9]\d{0,18}$/u.test(value.communityId)) && uuid.test(value.requestId)
        && (!post || (Number.isSafeInteger(value.revision) && value.revision! > 0 && value.communityId === (post.community?.id ?? null)))) return value
    }
    if (post) return blank
    const legacy = JSON.parse(sessionStorage.getItem('foris.forum.post.' + userId + (communityId ? '.community.' + communityId : '')) ?? 'null') as Record<string, unknown> | null
    if (legacy && typeof legacy.title === 'string' && typeof legacy.body === 'string' && legacy.body.length <= 10000) {
      const ids = Array.isArray(legacy.mediaIds) ? legacy.mediaIds.filter((id): id is string => typeof id === 'string' && uuid.test(id)) : []
      return { ...blank, title: legacy.title, content: legacyDocument(legacy.body, ids), legacyTopicId: typeof legacy.topicId === 'string' ? legacy.topicId : topicId }
    }
  } catch { /* El almacenamiento local no impide abrir un lienzo nuevo. */ }
  return blank
}
export function useCanvasDraft(userId: string, initialCommunity: string | null, initialTopic: string, post?: ForumPost) {
  const key = post ? 'foris.forum.edit.v1.' + userId + '.' + post.id : 'foris.forum.canvas.v1.' + userId + '.' + (initialCommunity ?? 'general')
  const [draft, setDraft] = useState(() => restore(key, userId, initialCommunity, initialTopic, post))
  const [storage, setStorage] = useState<'saved' | 'saving' | 'unavailable'>('saved')
  const latest = useRef(draft)
  const confirmed = useRef(false)
  const alive = useRef(true)
  function change(values: Partial<CanvasDraft>) {
    const next = { ...latest.current, ...values, requestId: crypto.randomUUID() }
    latest.current = next
    setDraft(next)
    setStorage('saving')
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (confirmed.current) return
      try { sessionStorage.setItem(key, JSON.stringify(latest.current)); setStorage('saved') } catch { setStorage('unavailable') }
    }, 400)
    return () => clearTimeout(timer)
  }, [draft, key])
  useEffect(() => {
    alive.current = true
    function flush() {
      if (!confirmed.current) { try { sessionStorage.setItem(key, JSON.stringify(latest.current)) } catch { /* Se comunicó mediante el estado del borrador. */ } }
    }
    window.addEventListener('pagehide', flush)
    return () => { alive.current = false; window.removeEventListener('pagehide', flush); flush() }
  }, [key])
  function clear() {
    confirmed.current = true
    try {
      sessionStorage.removeItem(key)
      if (!post) sessionStorage.removeItem('foris.forum.post.' + userId + (initialCommunity ? '.community.' + initialCommunity : ''))
    } catch { /* El servidor ya confirmó la publicación. */ }
  }
  function replacePublished(current: ForumPost) {
    const next = fromPost(current)
    latest.current = next; setDraft(next); setStorage('saving')
    return next
  }
  return { draft, latest, storage, change, clear, alive, replacePublished }
}
