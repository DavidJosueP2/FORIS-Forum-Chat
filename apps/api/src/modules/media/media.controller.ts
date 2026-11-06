import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { inputRecord } from '../../common/validation/input.js';
import { MediaService } from './media.service.js';
import { mediaId } from './media-validation.js';
import { mediaMetadata } from './media.repository.js';

@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get('options') options() { return this.media.options(); }
  @Get('usage') async usage(@Req() request: AuthRequest) { return this.media.repository.usage((await this.sessions.required(request)).user.id); }
  @Post('uploads') async upload(@Body() body: unknown, @Req() request: AuthRequest) { return this.media.authorize(body, await this.sessions.required(request)); }
  @Get(':id') async metadata(@Param('id') id: string, @Req() request: AuthRequest) {
    return mediaMetadata(await this.media.repository.view(mediaId(id), (await this.sessions.optional(request))?.user.id ?? null));
  }
  @Post(':id/complete') @HttpCode(200) async complete(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    inputRecord(body, []);
    return this.media.complete(mediaId(id), actor);
  }
  @Get(':id/read-url') async read(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.media.readUrl(mediaId(id), (await this.sessions.optional(request))?.user.id ?? null);
  }
  @Delete(':id') async remove(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    inputRecord(body, []);
    return this.media.remove(mediaId(id), actor);
  }
}
@Controller('media')
export class MediaLocalController {
  constructor(@Inject(MediaService) private readonly media: MediaService, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Put(':id/local-upload') async upload(@Param('id') id: string, @Body() body: unknown, @Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    return this.media.acceptLocal(mediaId(id), query, await this.sessions.required(request), request.get('content-type'), body);
  }
  @Get(':id/local-content') async read(@Param('id') id: string, @Query() query: Record<string, unknown>, @Res() response: Response) {
    const image = await this.media.localContent(mediaId(id), query);
    response.set('Content-Type', image.mime).set('Content-Disposition', 'inline').set('Cache-Control', 'private, no-store').send(image.bytes);
  }
}
