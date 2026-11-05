import type { Message, MessageInput, MessagePage, Pagination } from '@messages/contracts';

export interface MessageRow {
  [column: string]: unknown;
  id: string | number;
  author: string;
  body: string;
  sender_id: string;
  request_id: string;
  created_at: Date | string;
}

export interface SaveResult {
  message: Message;
  created: boolean;
}

export interface MessageRepositoryPort {
  list(page: Pagination): Promise<MessagePage>;
  save(input: MessageInput): Promise<SaveResult>;
}
