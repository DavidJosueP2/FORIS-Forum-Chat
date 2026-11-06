import { Body, Controller, Delete, Get, Header, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { inputRecord, resourceId, requestId } from '../../common/validation/input.js';
import { communityInput, preferencesInput, communityFilters } from './community-validation.js';
import { CommunityRepository } from './community.repository.js';

@Controller('communities')
export class CommunityController {
  constructor(@Inject(CommunityRepository) private readonly communities: CommunityRepository, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get() @Header('Cache-Control', 'no-store')
  async list(@Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    const actor = await this.sessions.optional(request);
    return this.communities.list(communityFilters(query), actor?.user.id ?? null);
  }
  @Get(':id') @Header('Cache-Control', 'no-store')
  async get(@Param('id') id: string, @Req() request: AuthRequest) {
    const actor = await this.sessions.optional(request);
    return this.communities.get(resourceId(id), actor?.user.id ?? null);
  }
  @Post() async create(@Body() body: unknown, @Req() request: AuthRequest, @Res() response: Response) {
    const actor = await this.sessions.required(request);
    const result = await this.communities.create(communityInput(body), actor);
    response.status(result.created ? 201 : 200).json(result);
  }
  @Post(':id/membership') async join(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    inputRecord(body, []);
    return this.communities.join(resourceId(id), actor);
  }
  @Delete(':id/membership') async leave(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    inputRecord(body, []);
    return this.communities.leave(resourceId(id), actor);
  }
  @Patch(':id/preferences') async preferences(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.communities.preferences(resourceId(id), preferencesInput(body), actor);
  }
  @Patch(':id/image') async image(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    const fields = inputRecord(body, ['mediaId']);
    return this.communities.updateImage(resourceId(id), fields.mediaId === null ? null : requestId(fields.mediaId), actor);
  }
}
