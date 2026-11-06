/** Catálogo de lectura: path contiene los UUID desde la raíz hasta esta temática. */
export interface ForumCategory {
  id: string; slug: string; name: string; description: string;
  parentId: string | null; rootId: string; depth: number; path: string[]; position: number;
}
export interface ForumTag { id: string; name: string }
