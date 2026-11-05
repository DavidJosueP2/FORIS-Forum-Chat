import { Body, Controller, Get, Header, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { MessagePage } from '@messages/contracts';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { CreateMessagePipe, ListMessagesPipe } from './pipes/message-validation.pipe.js';
import { MessagesService } from './messages.service.js';
import { MessageEventsService } from './message-events.service.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { HttpError } from '../../common/errors/http-error.js';

@Controller()
export class MessagesController {
  constructor(
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(MessageEventsService) private readonly events: MessageEventsService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Get('messages')
  @Header('Cache-Control', 'no-store')
  list(@Query(ListMessagesPipe) page: ListMessagesDto): Promise<MessagePage> {
    return this.messages.list(page);
  }

  @Post('messages')
  async send(@Body(CreateMessagePipe) input: CreateMessageDto, @Res() response: Response, @Req() request: AuthRequest): Promise<void> {
    const mode = request.get('x-foris-identity');
    if (mode && mode !== 'account' && mode !== 'guest') throw new HttpError(400, 'INVALID_INPUT', 'La forma de participar no es válida.');
    const context = mode === 'guest' ? null : await this.sessions.optional(request);
    if (!context && (mode === 'account' || (mode !== 'guest' && this.sessions.hasCookie(request)))) {
      throw new HttpError(401, 'SESSION_REQUIRED', 'Tu sesión terminó. Vuelve a entrar o continúa como invitado.');
    }
    if (context) { input.accountId = context.user.id; input.author = context.user.displayName; input.senderId = context.user.id; }
    const result = await this.messages.send(input);
    response.status(result.created ? 201 : 200).json({ message: result.message });
  }

  @Get('events')
  connect(@Req() request: Request, @Res() response: Response): void {
    this.events.connect(request, response);
  }
}
