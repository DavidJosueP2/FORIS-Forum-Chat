import type { ForumAttributes, ForumContentMark, ForumContentNode, ForumDocument, ForumMarkType, ForumNodeType } from '@messages/contracts';
import { inputRecord, invalidInput, requestId } from '../../common/validation/input.js';

const BLOCKS: ForumNodeType[] = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'taskList', 'horizontalRule', 'table', 'mediaImage'];
const MARKS: ForumMarkType[] = ['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'subscript', 'superscript', 'link'];
const ALIGNMENTS = ['left', 'center', 'right', 'justify'];
function invalid(): never { return invalidInput('El documento contiene un formato no válido. Quita ese bloque o revisa su contenido.'); }

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => {
    const point = character.codePointAt(0)!;
    return (point < 32 && point !== 9 && point !== 10 && point !== 13) || point === 127;
  })) invalid();
  return value.replaceAll('\r\n', '\n').normalize('NFC');
}
function integer(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) invalid();
  return value;
}
function link(value: unknown): string {
  const href = text(value, 2048);
  try {
    const url = new URL(href);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) invalid();
    return url.href;
  } catch { return invalid(); }
}
function marks(value: unknown): ForumContentMark[] {
  if (!Array.isArray(value) || value.length > MARKS.length) invalid();
  const seen = new Set<string>();
  return value.map(item => {
    const fields = inputRecord(item, ['type', 'attrs']);
    if (!MARKS.includes(fields.type as ForumMarkType) || seen.has(String(fields.type))) invalid();
    const type = fields.type as ForumMarkType;
    seen.add(type);
    if (type === 'link') {
      const attrs = inputRecord(fields.attrs, ['href', 'target', 'rel', 'class']);
      // target y rel proceden de la política de lectura, nunca del autor.
      return { type, attrs: { href: link(attrs.href) } };
    }
    if (fields.attrs !== undefined && Object.keys(inputRecord(fields.attrs, type === 'highlight' ? ['color'] : [])).some(key => key !== 'color' || (fields.attrs as Record<string, unknown>)[key] !== null)) invalid();
    return { type };
  }).sort((a, b) => MARKS.indexOf(a.type) - MARKS.indexOf(b.type));
}
function attributes(type: ForumNodeType, value: unknown): ForumAttributes | undefined {
  const allowed: Partial<Record<ForumNodeType, string[]>> = {
    paragraph: ['textAlign'], heading: ['level', 'textAlign'], codeBlock: ['language'], orderedList: ['start', 'type'],
    taskItem: ['checked'], tableCell: ['colspan', 'rowspan', 'colwidth', 'align'], tableHeader: ['colspan', 'rowspan', 'colwidth', 'align'], mediaImage: ['mediaId', 'alt', 'caption'],
  };
  const fields = inputRecord(value ?? {}, allowed[type] ?? []);
  const result: ForumAttributes = {};
  if (type === 'paragraph' || type === 'heading') {
    const alignment = fields.textAlign ?? 'left';
    if (!ALIGNMENTS.includes(alignment as string)) invalid();
    result.textAlign = alignment as string;
  }
  if (type === 'heading') result.level = integer(fields.level, 2, 3);
  if (type === 'codeBlock' && fields.language !== undefined && fields.language !== null) {
    const language = text(fields.language, 32);
    if (!/^[\w+#.-]*$/u.test(language)) invalid();
    if (language) result.language = language;
  }
  if (type === 'orderedList') {
    result.start = integer(fields.start ?? 1, 1, 9999);
    if (fields.type !== undefined && fields.type !== null && fields.type !== '1') invalid();
  }
  if (type === 'taskItem') {
    if (typeof fields.checked !== 'boolean') invalid();
    result.checked = fields.checked;
  }
  if (type === 'tableCell' || type === 'tableHeader') {
    result.colspan = integer(fields.colspan ?? 1, 1, 12);
    result.rowspan = integer(fields.rowspan ?? 1, 1, 20);
    if (fields.colwidth !== undefined && fields.colwidth !== null) invalid();
    if (fields.align !== undefined && fields.align !== null) {
      if (!['left', 'center', 'right'].includes(fields.align as string)) invalid();
      result.align = fields.align as string;
    }
  }
  if (type === 'mediaImage') {
    result.mediaId = requestId(fields.mediaId);
    result.alt = text(fields.alt ?? '', 300);
    result.caption = text(fields.caption ?? '', 500);
  }
  return Object.keys(result).length ? result : undefined;
}
function childrenFor(type: ForumNodeType): ForumNodeType[] {
  if (type === 'paragraph' || type === 'heading') return ['text', 'hardBreak'];
  if (type === 'codeBlock') return ['text'];
  if (type === 'bulletList' || type === 'orderedList') return ['listItem'];
  if (type === 'taskList') return ['taskItem'];
  if (type === 'table') return ['tableRow'];
  if (type === 'tableRow') return ['tableCell', 'tableHeader'];
  if (['blockquote', 'listItem', 'taskItem', 'tableCell', 'tableHeader'].includes(type)) return BLOCKS;
  return [];
}
function validateTable(rows: ForumContentNode[]): void {
  if (!rows.length || rows.length > 20) invalidInput('Una tabla admite hasta veinte filas y doce columnas.');
  const grid: boolean[][] = rows.map(() => []);
  for (const [rowIndex, row] of rows.entries()) {
    let column = 0;
    for (const cell of row.content ?? []) {
      while (grid[rowIndex]![column]) column++;
      const colspan = Number(cell.attrs?.colspan ?? 1);
      const rowspan = Number(cell.attrs?.rowspan ?? 1);
      if (column + colspan > 12 || rowIndex + rowspan > rows.length) invalid();
      for (let y = rowIndex; y < rowIndex + rowspan; y++) {
        for (let x = column; x < column + colspan; x++) {
          if (grid[y]![x]) invalid();
          grid[y]![x] = true;
        }
      }
      column += colspan;
    }
  }
  const width = grid[0]!.length;
  if (!width || grid.some(row => row.length !== width || Array.from({ length: width }, (_, index) => row[index]).some(cell => !cell))) invalid();
}
function plainText(node: ForumContentNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'mediaImage') return String(node.attrs?.caption ?? '');
  const separator = node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock' ? '' : node.type === 'tableRow' ? '\t' : '\n';
  return (node.content ?? []).map(plainText).join(separator);
}
export function postDocument(value: unknown): { document: ForumDocument; body: string; mediaIds: string[] } {
  const root = inputRecord(value, ['version', 'content']);
  if (root.version !== 1 || !Array.isArray(root.content) || !root.content.length) invalid();
  if (JSON.stringify(value).length > 250000) invalidInput('El documento es demasiado grande. Reduce la cantidad de bloques.');
  let count = 0;
  const mediaIds: string[] = [];
  function node(raw: unknown, allowed: ForumNodeType[], depth: number): ForumContentNode {
    if (++count > 3000 || depth > 20) invalidInput('La publicación tiene demasiados bloques o niveles anidados.');
    const item = inputRecord(raw, ['type', 'attrs', 'text', 'content', 'marks']);
    if (!allowed.includes(item.type as ForumNodeType)) invalid();
    const type = item.type as ForumNodeType;
    const result: ForumContentNode = { type };
    const attrs = attributes(type, item.attrs);
    if (attrs) result.attrs = attrs;
    if (type === 'text') {
      result.text = text(item.text, 10000);
      if (!result.text || item.content !== undefined || item.attrs !== undefined) invalid();
    } else if (item.text !== undefined) invalid();
    if (item.marks !== undefined) {
      if (type !== 'text' && type !== 'hardBreak') invalid();
      const selected = marks(item.marks);
      if (selected.length) result.marks = selected;
    }
    const allowedChildren = childrenFor(type);
    if (item.content !== undefined) {
      if (!allowedChildren.length || !Array.isArray(item.content)) invalid();
      result.content = item.content.map(child => node(child, allowedChildren, depth + 1));
    }
    if (['blockquote', 'bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem', 'table', 'tableRow', 'tableCell', 'tableHeader'].includes(type) && !result.content?.length) invalid();
    if ((type === 'listItem' || type === 'taskItem') && result.content?.[0]?.type !== 'paragraph') invalid();
    if (type === 'codeBlock' && result.content?.some(child => child.marks?.length)) invalid();
    if (type === 'table') validateTable(result.content!);
    if (type === 'mediaImage') {
      const id = String(result.attrs!.mediaId);
      if (mediaIds.includes(id)) invalidInput('La misma imagen aparece más de una vez. Conserva una sola copia.');
      mediaIds.push(id);
    }
    return result;
  }
  const content = root.content.map(child => node(child, BLOCKS, 0));
  const body = content.map(plainText).join('\n').trim();
  if (!body && !mediaIds.length) invalidInput('Escribe algo o añade una imagen antes de publicar.');
  if (body.length > 10000) invalidInput('Tu publicación supera los 10000 caracteres. Acórtala antes de publicar.');
  return { document: { version: 1, content }, body, mediaIds };
}
