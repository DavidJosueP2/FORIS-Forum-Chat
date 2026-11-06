import { Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { MediaNodeView } from './media-node-view'
import { safeLink } from './document'

const alignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => ['left', 'center', 'right', 'justify'].includes(element.style.textAlign) ? element.style.textAlign : element.getAttribute('data-align'),
  renderHTML: (attributes: Record<string, unknown>) => ({ 'data-align': String(attributes.textAlign ?? attributes.align ?? 'left') }),
}
const Alignment = TextAlign.extend({
  addGlobalAttributes() { return [{ types: this.options.types, attributes: { textAlign: { ...alignAttribute, default: 'left' } } }] },
}).configure({ types: ['heading', 'paragraph'], defaultAlignment: 'left' })
const Cell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), colwidth: { default: null, parseHTML: () => null }, align: alignAttribute } } })
const Header = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), colwidth: { default: null, parseHTML: () => null }, align: alignAttribute } } })
const Media = Node.create({
  name: 'mediaImage', group: 'block', atom: true, draggable: true,
  addAttributes() { return { mediaId: { default: null }, alt: { default: '' }, caption: { default: '' } } },
  parseHTML() { return [{ tag: 'figure[data-foris-media]', getAttrs: element => ({ mediaId: element.getAttribute('data-foris-media'), alt: element.getAttribute('data-alt') ?? '', caption: element.getAttribute('data-caption') ?? '' }) }] },
  renderHTML({ node }) { return ['figure', { 'data-foris-media': node.attrs.mediaId, 'data-alt': node.attrs.alt, 'data-caption': node.attrs.caption }, ['figcaption', node.attrs.caption || 'Imagen de Foris']] },
  addNodeView() { return ReactNodeViewRenderer(MediaNodeView) },
})
const Tasks = TaskItem.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('li')
      const label = document.createElement('label')
      label.contentEditable = 'false'
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'; checkbox.setAttribute('aria-label', 'Marcar tarea como completada')
      label.append(checkbox)
      const contentDOM = document.createElement('div')
      dom.append(label, contentDOM)
      const sync = (current: ProseMirrorNode) => { dom.dataset.type = 'taskItem'; dom.dataset.checked = String(current.attrs.checked); checkbox.checked = current.attrs.checked; checkbox.disabled = !editor.isEditable }
      sync(node)
      checkbox.addEventListener('change', () => {
        const pos = getPos()
        if (!editor.isEditable || typeof pos !== 'number') return
        editor.commands.command(({ tr }) => { const current = tr.doc.nodeAt(pos); if (!current) return false; tr.setNodeMarkup(pos, undefined, { ...current.attrs, checked: checkbox.checked }); return true })
      })
      return { dom, contentDOM, update(current: ProseMirrorNode) { if (current.type !== node.type) return false; sync(current); return true } }
    }
  },
}).configure({ nested: true })

export function canvasExtensions() {
  return [StarterKit.configure({ heading: { levels: [2, 3] }, dropcursor: false,
    link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https', protocols: ['http', 'https'], isAllowedUri: url => safeLink(url) !== null, HTMLAttributes: { rel: 'noopener noreferrer nofollow ugc', target: '_blank' } } }),
  Placeholder.configure({ placeholder: 'Empieza aquí. Una idea, una imagen, algo que quieras compartir…' }), Highlight, Subscript, Superscript, Alignment,
  TaskList, Tasks, Table.extend({ renderHTML() { return ['div', { class: 'document-table' }, ['table', {}, ['tbody', 0]]] }, addNodeView() { return null } }).configure({ resizable: false }), Cell, Header, TableRow, Media]
}
