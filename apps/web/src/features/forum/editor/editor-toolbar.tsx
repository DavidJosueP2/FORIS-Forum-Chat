import { useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CheckSquare, ChevronDown, Code, CodeXml, Heading2, Heading3, Highlighter, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Pilcrow, Quote, Redo2, RemoveFormatting, Strikethrough, Subscript, Superscript, Table2, Underline, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ForisCharacter } from '@/components/brand/foris-character'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { safeLink } from './document'

function Tool({ label, icon: Icon, active, disabled, action }: { label: string; icon: LucideIcon; active?: boolean; disabled?: boolean; action: () => void }) {
  return <Button type="button" variant="ghost" size="icon" className="canvas-tool" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={action}><Icon aria-hidden="true" /></Button>
}
function LinkTool({ editor }: { editor: Editor }) {
  const active = useEditorState({ editor, selector: ({ editor: current }) => current.isActive('link') })
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  function apply() {
    const href = safeLink(url)
    if (!href) { setError('Escribe una dirección completa que empiece con https:// o http://.'); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run(); setOpen(false)
  }
  return <Popover open={open} onOpenChange={value => { setOpen(value); setError(''); if (value) setUrl(String(editor.getAttributes('link').href ?? '')) }}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="canvas-tool" title="Añadir o editar enlace" aria-label="Añadir o editar enlace" aria-pressed={active} disabled={!editor.isEditable}><Link2 aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent className="canvas-popover" align="start"><div className="canvas-link-heading"><label htmlFor="canvas-link">Dirección del enlace</label><ForisCharacter scene="editorHelp" width={48} height={48} /></div><input id="canvas-link" type="url" placeholder="https://" value={url} onChange={event => setUrl(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); apply() } }} />
      {error && <p className="forum-error" role="alert">{error}</p>}<div className="canvas-inline-actions"><Button type="button" className="h-11" onClick={apply}>Aplicar enlace</Button><Button type="button" variant="ghost" className="h-11" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setOpen(false) }}>Quitar enlace</Button></div>
    </PopoverContent>
  </Popover>
}
export function EditorToolbar({ editor, onImages, imagesDisabled }: { editor: Editor; onImages: (files: File[]) => void; imagesDisabled: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'), strike: current.isActive('strike'),
    bulletList: current.isActive('bulletList'), orderedList: current.isActive('orderedList'), taskList: current.isActive('taskList'), blockquote: current.isActive('blockquote'),
    codeBlock: current.isActive('codeBlock'), table: current.isActive('table'), undo: current.can().undo(), redo: current.can().redo(),
    heading: current.isActive('heading', { level: 2 }) ? 2 : current.isActive('heading', { level: 3 }) ? 3 : 0,
    highlight: current.isActive('highlight'), code: current.isActive('code'), subscript: current.isActive('subscript'), superscript: current.isActive('superscript'),
    align: String(current.getAttributes('paragraph').textAlign ?? current.getAttributes('heading').textAlign ?? 'left'), editable: current.isEditable,
  }) })
  const chain = () => editor.chain().focus()
  const tableActions: [string, () => void, boolean][] = [
    ['Insertar tabla', () => { chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }, !state.table],
    ['Añadir fila arriba', () => { chain().addRowBefore().run() }, state.table], ['Añadir fila abajo', () => { chain().addRowAfter().run() }, state.table],
    ['Añadir columna antes', () => { chain().addColumnBefore().run() }, state.table], ['Añadir columna después', () => { chain().addColumnAfter().run() }, state.table],
    ['Combinar celdas', () => { chain().mergeCells().run() }, editor.can().mergeCells()], ['Separar celda', () => { chain().splitCell().run() }, editor.can().splitCell()],
    ['Alternar encabezado', () => { chain().toggleHeaderRow().run() }, state.table], ['Eliminar fila', () => { chain().deleteRow().run() }, state.table],
    ['Eliminar columna', () => { chain().deleteColumn().run() }, state.table], ['Eliminar tabla', () => { chain().deleteTable().run() }, state.table],
  ]
  return <div className="canvas-toolbar" role="group" aria-label="Herramientas de escritura">
    <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="canvas-text-tool" disabled={!state.editable}>{state.heading ? 'Encabezado ' + state.heading : 'Texto'}<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent className="canvas-menu" align="start">
      <DropdownMenuItem onSelect={() => { chain().setParagraph().run() }}><Pilcrow />Texto normal</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => { chain().toggleHeading({ level: 2 }).run() }}><Heading2 />Encabezado</DropdownMenuItem><DropdownMenuItem onSelect={() => { chain().toggleHeading({ level: 3 }).run() }}><Heading3 />Subencabezado</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    <Tool label="Negrita (Ctrl/⌘ + B)" icon={Bold} active={state.bold} disabled={!state.editable} action={() => { chain().toggleBold().run() }} />
    <Tool label="Cursiva (Ctrl/⌘ + I)" icon={Italic} active={state.italic} disabled={!state.editable} action={() => { chain().toggleItalic().run() }} />
    <Tool label="Subrayado (Ctrl/⌘ + U)" icon={Underline} active={state.underline} disabled={!state.editable} action={() => { chain().toggleUnderline().run() }} />
    <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="canvas-text-tool" disabled={!state.editable}>Formato<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent className="canvas-menu" align="start">
      {([['Tachado', Strikethrough, state.strike, () => chain().toggleStrike().run()], ['Resaltado', Highlighter, state.highlight, () => chain().toggleHighlight().run()], ['Código en línea', Code, state.code, () => chain().toggleCode().run()], ['Subíndice', Subscript, state.subscript, () => chain().toggleSubscript().run()], ['Superíndice', Superscript, state.superscript, () => chain().toggleSuperscript().run()]] as [string, LucideIcon, boolean, () => boolean][]).map(([label, Icon, active, action]) => <DropdownMenuItem key={label} data-active={active} onSelect={() => { action() }}><Icon />{label}</DropdownMenuItem>)}
      <DropdownMenuItem onSelect={() => { chain().unsetAllMarks().clearNodes().run() }}><RemoveFormatting />Limpiar formato</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    <span className="canvas-toolbar-space" />
    <Tool label="Deshacer (Ctrl/⌘ + Z)" icon={Undo2} disabled={!state.undo || !state.editable} action={() => { chain().undo().run() }} /><Tool label="Rehacer (Ctrl/⌘ + Shift + Z)" icon={Redo2} disabled={!state.redo || !state.editable} action={() => { chain().redo().run() }} />
    <div className="canvas-toolbar-row">
      <Tool label="Insertar imágenes" icon={ImagePlus} disabled={imagesDisabled || !state.editable} action={() => input.current?.click()} />
      <input ref={input} className="sr-only" type="file" tabIndex={-1} multiple accept="image/jpeg,image/png,image/webp" aria-label="Elegir imágenes para el lienzo" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; onImages(files) }} />
      <LinkTool editor={editor} />
      <Tool label="Lista con viñetas" icon={List} active={state.bulletList} disabled={!state.editable} action={() => { chain().toggleBulletList().run() }} /><Tool label="Lista numerada" icon={ListOrdered} active={state.orderedList} disabled={!state.editable} action={() => { chain().toggleOrderedList().run() }} />
      <Tool label="Lista de tareas" icon={CheckSquare} active={state.taskList} disabled={!state.editable} action={() => { chain().toggleTaskList().run() }} />
      <Tool label="Cita" icon={Quote} active={state.blockquote} disabled={!state.editable} action={() => { chain().toggleBlockquote().run() }} /><Tool label="Bloque de código" icon={CodeXml} active={state.codeBlock} disabled={!state.editable} action={() => { chain().toggleCodeBlock().run() }} />
      <Tool label="Separador" icon={Minus} disabled={!state.editable} action={() => { chain().setHorizontalRule().run() }} />
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="canvas-tool" title="Tabla" aria-label="Insertar o editar tabla" aria-pressed={state.table} disabled={!state.editable}><Table2 aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent className="canvas-menu" align="start">{tableActions.map(([label, action, enabled]) => <DropdownMenuItem key={label} disabled={!enabled || !state.editable} onSelect={action}>{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="canvas-tool" title="Alineación" aria-label="Alineación del texto" disabled={!state.editable}><AlignLeft aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent className="canvas-menu" align="start">{([['left', 'Alinear a la izquierda', AlignLeft], ['center', 'Centrar', AlignCenter], ['right', 'Alinear a la derecha', AlignRight], ['justify', 'Justificar', AlignJustify]] as [string, string, LucideIcon][]).map(([align, label, Icon]) => <DropdownMenuItem key={align} data-active={state.align === align} onSelect={() => { chain().setTextAlign(align).run() }}><Icon />{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
    </div>
  </div>
}
