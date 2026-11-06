import type { MessageInput } from '@messages/contracts';

export class CreateMessageDto implements MessageInput {
  declare author: string;
  declare body: string;
  declare senderId: string;
  declare requestId: string;
  declare accountId?: string | null;
}
