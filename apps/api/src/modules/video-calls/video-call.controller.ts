import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { requestId, inputRecord } from '../../common/validation/input.js';
import { VideoCallService } from './video-call.service.js';
import { joinInput, signalInput, syncInput } from './video-call-validation.js';
import { conversationScope } from '../conversations/conversation-access.js';

@Controller('video-call')
export class VideoCallController {
  constructor(@Inject(VideoCallService) private readonly calls: VideoCallService, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get() @Header('Cache-Control', 'no-store') async status(@Req() request: AuthRequest, @Query('room') room: unknown) {
    return this.calls.status(await this.sessions.required(request), room === undefined ? undefined : conversationScope(room));
  }
  @Post('join') @HttpCode(200) async join(@Body() body: unknown, @Req() request: AuthRequest, @Query('room') room: unknown) {
    return this.calls.join(await this.sessions.required(request), joinInput(body), room === undefined ? undefined : conversationScope(room));
  }
  @Post(':id/sync') @HttpCode(200) async sync(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request); this.calls.requireEnabled();
    return this.calls.repository.sync(requestId(id), syncInput(body), actor);
  }
  @Post(':id/signals') @HttpCode(200) async signal(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request); this.calls.requireEnabled();
    return this.calls.repository.signal(requestId(id), signalInput(body), actor);
  }
  @Post(':id/leave') @HttpCode(200) async leave(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request); inputRecord(body, []);
    return this.calls.repository.leave(requestId(id), actor);
  }
}
