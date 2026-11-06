import type { JSONContent } from '@tiptap/core'
import type { ForumContentNode, ForumDocument, ForumPost } from '@messages/contracts'

export const emptyDocument = (): ForumDocument => ({ version: 1, content: [{ type: 'paragraph' }] })
export function legacyDocument(body: string, mediaIds: string[] = []): ForumDocument {
  return { version: 1, content: [...body.split('\n').map(text => ({ type: 'paragraph' as const, ...(text ? { content: [{ type: 'text' as const, text }] } : {}) })),
    ...mediaIds.map(mediaId => ({ type: 'mediaImage' as const, attrs: { mediaId, alt: '', caption: '' } }))] }
}
export function documentFromPost(post: ForumPost): ForumDocument {
  const available = new Set(post.images.map(image => image.id))
  const original = post.content ?? legacyDocument(post.body, [...available])
  function keep(node: ForumContentNode): ForumContentNode[] {
    if (node.type === 'mediaImage' && !available.has(String(node.attrs?.mediaId))) return []
    if (!node.content) return [node]
    const content = node.content.flatMap(keep)
    if (!content.length && ['tableCell', 'tableHeader', 'blockquote'].includes(node.type)) content.push({ type: 'paragraph' })
    return [{ ...node, content }]
  }
  const content = original.content.flatMap(keep)
  return content.length ? { version: 1, content } : emptyDocument()
}
export function editorDocument(value: JSONContent): ForumDocument {
  return { version: 1, content: (value.content ?? []) as ForumContentNode[] }
}
export function documentImages(document: ForumDocument): string[] {
  const images: string[] = []
  function visit(node: ForumContentNode) {
    if (node.type === 'mediaImage' && typeof node.attrs?.mediaId === 'string') images.push(node.attrs.mediaId)
    node.content?.forEach(visit)
  }
  document.content.forEach(visit)
  return images
}
export function documentText(document: ForumDocument): string {
  function text(node: ForumContentNode): string {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'mediaImage') return String(node.attrs?.caption ?? '')
    const separator = ['paragraph', 'heading', 'codeBlock'].includes(node.type) ? '' : node.type === 'tableRow' ? '\t' : '\n'
    return (node.content ?? []).map(text).join(separator)
  }
  return document.content.map(text).join('\n').trim()
}
export function safeLink(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && value.length <= 2048 ? url.href : null } catch { return null }
}
/** El servidor sigue siendo la autoridad; esto protege la restauración de datos locales dañados. */
export function restorableDocument(value: unknown): value is ForumDocument {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('content' in value) || !Array.isArray(value.content)) return false
  let count = 0
  const allowed = new Set(['paragraph', 'heading', 'text', 'hardBreak', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'horizontalRule', 'table', 'tableRow', 'tableCell', 'tableHeader', 'mediaImage'])
  function visit(node: unknown, depth: number): boolean {
    if (++count > 5000 || depth > 25 || !node || typeof node !== 'object' || !('type' in node) || typeof node.type !== 'string' || !allowed.has(node.type)) return false
    if ('text' in node && typeof node.text !== 'string') return false
    if ('attrs' in node && (!node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs))) return false
    if ('marks' in node && (!Array.isArray(node.marks) || node.marks.some(mark => !mark || typeof mark.type !== 'string' || !['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'subscript', 'superscript', 'link'].includes(mark.type)))) return false
    return !('content' in node) || (Array.isArray(node.content) && node.content.every(child => visit(child, depth + 1)))
  }
  return value.content.every(node => visit(node, 0))
}
