import { Body, Controller, Get, Header, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { inputRecord, pageInput, resourceId } from '../../common/validation/input.js';
import { NotificationRepository } from './notification.repository.js';

@Controller('notifications')
export class NotificationController {
  constructor(@Inject(NotificationRepository) private readonly notifications: NotificationRepository, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get('count') @Header('Cache-Control', 'no-store')
  async count(@Req() request: AuthRequest) { return this.notifications.count((await this.sessions.required(request)).user.id); }
  @Get() @Header('Cache-Control', 'no-store')
  async list(@Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    const page = pageInput(query);
    return this.notifications.list(actor.user.id, page.before, page.limit);
  }
  @Post('read-all') async allRead(@Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    const fields = inputRecord(body, ['throughId']);
    return this.notifications.readThrough(resourceId(fields.throughId), actor);
  }
  @Post(':id/read') async read(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    inputRecord(body, []);
    return this.notifications.read(resourceId(id), actor);
  }
}
