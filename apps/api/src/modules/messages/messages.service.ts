import { Inject, Injectable } from '@nestjs/common';
import type { MessageInput, MessagePage, Pagination } from '@messages/contracts';
import { MessagesRepository } from './messages.repository.js';
import { MessageEventsService } from './message-events.service.js';
import type { MessageRepositoryPort, SaveResult } from './messages.types.js';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(MessagesRepository) private readonly repository: MessageRepositoryPort,
    @Inject(MessageEventsService) private readonly events: MessageEventsService,
  ) {}

  list(page: Pagination): Promise<MessagePage> { return this.repository.list(page); }

  async send(input: MessageInput): Promise<SaveResult> {
    const result = await this.repository.save(input);
    if (result.created) this.events.publish('message', result.message);
    return result;
  }
}
