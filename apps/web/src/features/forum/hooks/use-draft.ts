import { useEffect, useRef, useState } from 'react'
import { clearDraft, newDraft, readDraft, saveDraft, type ForumDraft } from '../lib/drafts'

export function useDraft(key: string, topicId = '') {
  const [draft, setDraft] = useState(() => readDraft(key, topicId))
  const [stored, setStored] = useState(true)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function change(values: Partial<Pick<ForumDraft, 'title' | 'body' | 'topicId' | 'mediaIds'>>) {
    const next = { ...draft, ...values, requestId: crypto.randomUUID() }
    setDraft(next)
    setStored(saveDraft(key, next))
  }
  function clear() {
    clearDraft(key)
    setDraft(newDraft(topicId))
    setStored(true)
  }
  return { draft, stored, change, clear, alive }
}
