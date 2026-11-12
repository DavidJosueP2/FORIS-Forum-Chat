import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { inputRecord, inputText, invalidInput, requestId } from '../../common/validation/input.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { MAX_MESSAGE_LENGTH, validatePagination } from '../messages/dto/message-validation.js';
import { conversationScope } from './conversation-access.js';
import { ConversationsRepository } from './conversations.repository.js';

@Controller('conversations')
export class ConversationsController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService,
    @Inject(ConversationsRepository) private readonly rooms: ConversationsRepository) {}

  @Get() @Header('Cache-Control', 'no-store')
  async list(@Req() request: AuthRequest) {
    return { rooms: await this.rooms.list(await this.sessions.required(request)) };
  }
  @Get('direct/:peer') @Header('Cache-Control', 'no-store')
  async direct(@Req() request: AuthRequest, @Param('peer') peer: string) {
    return this.rooms.direct(await this.sessions.required(request), requestId(peer));
  }

  @Get(':room/messages') @Header('Cache-Control', 'no-store')
  async history(@Req() request: AuthRequest, @Param('room') room: string, @Query() query: Record<string, unknown>) {
    const actor = await this.sessions.required(request);
    const fromStart = query.after === '0';
    if (fromStart && query.before !== undefined) invalidInput('Usa una sola dirección para consultar el historial.');
    const page = validatePagination(fromStart ? { ...query, after: undefined } : query);
    return this.rooms.history(actor, conversationScope(room), fromStart ? { ...page, after: '0' } : page);
  }

  @Post(':room/messages') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async send(@Req() request: AuthRequest, @Param('room') room: string, @Body() body: unknown) {
    const actor = await this.sessions.required(request);
    const input = inputRecord(body, ['body', 'requestId']);
    return this.rooms.send(actor, conversationScope(room), inputText(input.body, 'El mensaje', MAX_MESSAGE_LENGTH, true), requestId(input.requestId));
  }
}
