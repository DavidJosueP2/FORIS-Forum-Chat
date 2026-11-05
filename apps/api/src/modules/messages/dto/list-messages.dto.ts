import type { Pagination } from '@messages/contracts';

export class ListMessagesDto implements Pagination {
  declare before?: string;
  declare after?: string;
  declare limit: number;
}
