import { Body, Controller, Delete, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { inputRecord, requestId, resourceId } from '../../common/validation/input.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { CommunityInvitationsRepository, invitationToken } from './community-invitations.repository.js';

@Controller('communities/:communityId/invitations')
export class CommunityInvitationsController {
  constructor(@Inject(CommunityInvitationsRepository) private readonly invitations: CommunityInvitationsRepository, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get() async list(@Param('communityId') id: string, @Req() request: AuthRequest) { return this.invitations.list(resourceId(id), await this.sessions.required(request)); }
  @Post() async create(@Param('communityId') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request); inputRecord(body, []);
    const result = await this.invitations.create(resourceId(id), actor);
    return { invitation: result.invitation, url: this.sessions.config.origin + '/invitaciones/' + result.token };
  }
  @Delete(':invitationId') async revoke(@Param('communityId') id: string, @Param('invitationId') invitationId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request); inputRecord(body, []);
    return this.invitations.revoke(resourceId(id), requestId(invitationId), actor);
  }
}
@Controller('community-invitations')
export class InvitationAcceptanceController {
  constructor(@Inject(CommunityInvitationsRepository) private readonly invitations: CommunityInvitationsRepository, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Post('preview') async preview(@Body() body: unknown, @Req() request: AuthRequest) {
    const fields = inputRecord(body, ['token']);
    return this.invitations.preview(invitationToken(fields.token), (await this.sessions.optional(request))?.user.id ?? null);
  }
  @Post('accept') async accept(@Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    const fields = inputRecord(body, ['token']);
    return this.invitations.accept(invitationToken(fields.token), actor);
  }
}
