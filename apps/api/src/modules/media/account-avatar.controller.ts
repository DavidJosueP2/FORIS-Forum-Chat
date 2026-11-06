import { Body, Controller, Get, Inject, Param, Patch, Req } from '@nestjs/common';
import { inputRecord, requestId } from '../../common/validation/input.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { MediaRepository } from './media.repository.js';

@Controller('account/avatar')
export class AccountAvatarController {
  constructor(@Inject(MediaRepository) private readonly media: MediaRepository, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Patch() async update(@Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    const fields = inputRecord(body, ['mediaId']);
    const id = fields.mediaId === null ? null : requestId(fields.mediaId);
    return this.media.avatar(actor, id);
  }
}
@Controller('profiles')
export class PublicAvatarController {
  constructor(@Inject(MediaRepository) private readonly media: MediaRepository) {}
  @Get(':id/avatar') avatar(@Param('id') id: string) { return this.media.publicAvatar(requestId(id)); }
}
