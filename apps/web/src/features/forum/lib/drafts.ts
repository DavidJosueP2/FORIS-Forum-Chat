export interface ForumDraft { title: string; body: string; topicId: string; requestId: string }
export function newDraft(topicId = ''): ForumDraft { return { title: '', body: '', topicId, requestId: crypto.randomUUID() } }
export function readDraft(key: string, topicId = ''): ForumDraft {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (value && typeof value === 'object' && 'title' in value && typeof value.title === 'string' && value.title.length <= 160
      && 'body' in value && typeof value.body === 'string' && value.body.length <= 10000
      && 'topicId' in value && typeof value.topicId === 'string' && value.topicId.length <= 32
      && 'requestId' in value && typeof value.requestId === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(value.requestId)) return value as ForumDraft
  } catch { /* Un borrador inválido no impide publicar. */ }
  return newDraft(topicId)
}
export function saveDraft(key: string, value: ForumDraft): boolean {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}
export function clearDraft(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* El envío ya fue confirmado. */ }
}
