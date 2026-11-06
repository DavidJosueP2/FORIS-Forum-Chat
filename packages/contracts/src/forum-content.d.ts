export type ForumNodeType = 'paragraph' | 'heading' | 'text' | 'hardBreak' | 'blockquote' | 'codeBlock'
  | 'bulletList' | 'orderedList' | 'listItem' | 'taskList' | 'taskItem' | 'horizontalRule'
  | 'table' | 'tableRow' | 'tableCell' | 'tableHeader' | 'mediaImage';
export type ForumMarkType = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'highlight' | 'subscript' | 'superscript' | 'link';
export type ForumAttributes = Record<string, string | number | boolean | null | number[]>;
export interface ForumContentMark { type: ForumMarkType; attrs?: ForumAttributes }
export interface ForumContentNode {
  type: ForumNodeType; text?: string; attrs?: ForumAttributes; marks?: ForumContentMark[]; content?: ForumContentNode[];
}
/** Nunca contiene HTML, binarios ni URLs de almacenamiento. */
export interface ForumDocument { version: 1; content: ForumContentNode[] }
