import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'
import type { MediaMetadata } from '@messages/contracts'
import { GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrivateImage } from '@/features/media/components/private-image'
import { useResource } from '../hooks/use-forum'

export function MediaNodeView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const id = String(node.attrs.mediaId)
  const metadata = useResource<MediaMetadata>('media/' + id)
  return <NodeViewWrapper className="canvas-image-node" contentEditable={false}>
    <figure>
      {metadata.data?.image ? <PrivateImage image={metadata.data.image} alt={String(node.attrs.alt ?? '')} /> : <p className={metadata.error ? 'forum-error' : 'forum-hint'}>{metadata.error ?? 'Preparando imagen…'}</p>}
      {metadata.error && <Button type="button" variant="ghost" onClick={metadata.retry}>Volver a cargar</Button>}
      <div className="canvas-image-actions"><span data-drag-handle title="Arrastrar imagen" aria-hidden="true"><GripVertical /></span>
        <details><summary>Descripción y pie de imagen</summary><label>Descripción para quien no puede verla<input type="text" value={String(node.attrs.alt ?? '')} disabled={!editor.isEditable} onChange={event => { if (editor.isEditable) updateAttributes({ alt: event.target.value }) }} /></label><label>Pie de imagen<input type="text" value={String(node.attrs.caption ?? '')} disabled={!editor.isEditable} onChange={event => { if (editor.isEditable) updateAttributes({ caption: event.target.value }) }} /></label>
          {String(node.attrs.alt ?? '').length > 300 && <p className="forum-error" role="alert">Acorta la descripción a 300 caracteres.</p>}
          {String(node.attrs.caption ?? '').length > 500 && <p className="forum-error" role="alert">Acorta el pie de imagen a 500 caracteres.</p>}
        </details>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" title="Quitar del lienzo" aria-label="Quitar imagen del lienzo" disabled={!editor.isEditable} onClick={() => { if (editor.isEditable) deleteNode() }}><Trash2 aria-hidden="true" /></Button>
      </div>
      {node.attrs.caption && <figcaption>{String(node.attrs.caption)}</figcaption>}
    </figure>
  </NodeViewWrapper>
}
