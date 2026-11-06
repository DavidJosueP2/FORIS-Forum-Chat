/** Contratos JSON compartidos por el servidor y el navegador. */
export interface MessageInput {
  author: string;
  body: string;
  senderId: string;
  requestId: string;
}

export interface Message extends MessageInput {
  /** Asignado únicamente por el servidor cuando el envío tiene una sesión válida. */
  accountId?: string | null;
  // PostgreSQL BIGINT se transporta como texto para conservar su precisión.
  id: string;
  createdAt: string;
}

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
}

export interface Pagination {
  before?: string;
  after?: string;
  limit: number;
}

export interface Presence {
  connections: number;
}
