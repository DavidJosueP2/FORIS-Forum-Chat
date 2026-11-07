import { Body, Controller, Get, Header, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { MessagePage } from '@messages/contracts';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { CreateMessagePipe, ListMessagesPipe } from './pipes/message-validation.pipe.js';
import { MessagesService } from './messages.service.js';
import { MessageEventsService } from './message-events.service.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { HttpError } from '../../common/errors/http-error.js';
import { PresenceIdentityService } from './presence-identity.service.js';
import { inputRecord } from '../../common/validation/input.js';

@Controller()
export class MessagesController {
  constructor(
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(MessageEventsService) private readonly events: MessageEventsService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(PresenceIdentityService) private readonly identities: PresenceIdentityService,
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
  async connect(@Req() request: AuthRequest, @Res() response: Response): Promise<void> {
    // EventSource no envía Origin en todos los GET; si existe debe ser el configurado.
    if (request.get('origin') && request.get('origin') !== this.sessions.config.origin) throw new HttpError(403, 'ORIGIN_REJECTED', 'Abre el chat desde Foris.');
    if (request.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'ORIGIN_REJECTED', 'Abre el chat desde Foris.');
    await this.events.connect(request, response, await this.identities.resolve(request));
  }

  @Post('chat/presence/identity')
  bootstrap(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    inputRecord(body, []);
    return this.identities.bootstrap(request, response);
  }
}
