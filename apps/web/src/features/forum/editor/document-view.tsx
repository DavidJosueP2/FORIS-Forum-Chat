import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ForumContentNode, ForumDocument, MediaImage, MediaMetadata } from '@messages/contracts'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { PrivateImage } from '@/features/media/components/private-image'
import { useResource } from '../hooks/use-forum'
import { safeLink } from './document'
import './document.css'

function DraftImage({ id, alt }: { id: string; alt: string }) {
  const image = useResource<MediaMetadata>('media/' + id)
  if (image.data?.image) return <PrivateImage image={image.data.image} alt={alt} />
  return <p className={image.error ? 'forum-error' : 'forum-hint'}>{image.error ?? 'Cargando imagen…'}</p>
}
export function DocumentView({ document, images = [], preview = false, canDelete = false }: {
  document: ForumDocument; images?: MediaImage[]; preview?: boolean; canDelete?: boolean
}) {
  const [removed, setRemoved] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function remove(id: string) {
    if (guard.current) return
    guard.current = true; setBusy(id); setError(null)
    try {
      await accountRequest('media/' + id, 'DELETE', {})
      if (alive.current) setRemoved(current => [...current, id])
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(null) }
  }
  function render(node: ForumContentNode, key: string): ReactNode {
    const children = node.content?.map((child, index) => render(child, key + '.' + index))
    const alignment = ['left', 'center', 'right', 'justify'].includes(String(node.attrs?.textAlign)) ? String(node.attrs?.textAlign) : undefined
    switch (node.type) {
      case 'text': {
        let result: ReactNode = node.text ?? ''
        for (const mark of node.marks ?? []) {
          switch (mark.type) {
            case 'bold': result = <strong>{result}</strong>; break
            case 'italic': result = <em>{result}</em>; break
            case 'underline': result = <u>{result}</u>; break
            case 'strike': result = <s>{result}</s>; break
            case 'code': result = <code>{result}</code>; break
            case 'highlight': result = <mark>{result}</mark>; break
            case 'subscript': result = <sub>{result}</sub>; break
            case 'superscript': result = <sup>{result}</sup>; break
            case 'link': {
              const href = safeLink(String(mark.attrs?.href ?? ''))
              if (href) result = <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" referrerPolicy="no-referrer">{result}</a>
              break
            }
          }
        }
        return <span key={key}>{result}</span>
      }
      case 'hardBreak': return <br key={key} />
      case 'paragraph': return <p key={key} data-align={alignment}>{children?.length ? children : <br />}</p>
      case 'heading': return node.attrs?.level === 3 ? <h3 key={key} data-align={alignment}>{children}</h3> : <h2 key={key} data-align={alignment}>{children}</h2>
      case 'blockquote': return <blockquote key={key}>{children}</blockquote>
      case 'codeBlock': return <pre key={key}><code>{children}</code></pre>
      case 'bulletList': return <ul key={key}>{children}</ul>
      case 'orderedList': return <ol key={key} start={Number(node.attrs?.start ?? 1)}>{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'taskList': return <ul key={key} data-type="taskList">{children}</ul>
      case 'taskItem': return <li key={key} data-type="taskItem" data-checked={Boolean(node.attrs?.checked)}><input type="checkbox" checked={Boolean(node.attrs?.checked)} disabled aria-label={node.attrs?.checked ? 'Tarea completada' : 'Tarea pendiente'} /><div>{children}</div></li>
      case 'horizontalRule': return <hr key={key} />
      case 'table': return <div className="document-table" key={key} tabIndex={0} role="region" aria-label="Tabla de la publicación"><table><tbody>{children}</tbody></table></div>
      case 'tableRow': return <tr key={key}>{children}</tr>
      case 'tableCell': return <td key={key} colSpan={Number(node.attrs?.colspan ?? 1)} rowSpan={Number(node.attrs?.rowspan ?? 1)} data-align={String(node.attrs?.align ?? '')}>{children}</td>
      case 'tableHeader': return <th key={key} colSpan={Number(node.attrs?.colspan ?? 1)} rowSpan={Number(node.attrs?.rowspan ?? 1)} data-align={String(node.attrs?.align ?? '')}>{children}</th>
      case 'mediaImage': {
        const id = String(node.attrs?.mediaId ?? '')
        const image = images.find(item => item.id === id)
        const caption = String(node.attrs?.caption ?? '')
        const unavailable = removed.includes(id) || (!image && !preview)
        return <figure key={key} className="document-image">{unavailable ? <p className="forum-hint">Esta imagen se retiró de la publicación.</p>
          : image ? <PrivateImage image={image} alt={String(node.attrs?.alt ?? '')} /> : <DraftImage id={id} alt={String(node.attrs?.alt ?? '')} />}
          {caption && <figcaption>{caption}</figcaption>}
          {canDelete && !unavailable && <Button type="button" variant="ghost" className="h-11" disabled={busy !== null} onClick={() => void remove(id)}><Trash2 aria-hidden="true" />{busy === id ? 'Retirando…' : 'Retirar imagen'}</Button>}
        </figure>
      }
    }
  }
  return <div className="foris-document">{document.content.map((node, index) => render(node, String(index)))}{error && <p className="forum-error" role="alert">{error}</p>}</div>
}
