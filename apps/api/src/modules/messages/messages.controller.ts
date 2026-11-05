import { Body, Controller, Get, Header, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { MessagePage } from '@messages/contracts';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { CreateMessagePipe, ListMessagesPipe } from './pipes/message-validation.pipe.js';
import { MessagesService } from './messages.service.js';
import { MessageEventsService } from './message-events.service.js';

@Controller()
export class MessagesController {
  constructor(
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(MessageEventsService) private readonly events: MessageEventsService,
  ) {}

  @Get('messages')
  @Header('Cache-Control', 'no-store')
  list(@Query(ListMessagesPipe) page: ListMessagesDto): Promise<MessagePage> {
    return this.messages.list(page);
  }

  @Post('messages')
  async send(@Body(CreateMessagePipe) input: CreateMessageDto, @Res() response: Response): Promise<void> {
    const result = await this.messages.send(input);
    response.status(result.created ? 201 : 200).json({ message: result.message });
  }

  @Get('events')
  connect(@Req() request: Request, @Res() response: Response): void {
    this.events.connect(request, response);
  }
}
