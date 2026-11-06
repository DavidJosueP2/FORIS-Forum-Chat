import { Body, Controller, Get, Header, Inject, Param, Put, Query, Req } from '@nestjs/common';
import { inputRecord, invalidInput, pageInput, requestId, resourceId } from '../../common/validation/input.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { ForumFollowRepository } from './forum-follow.repository.js';
import { ForumRepository } from './forum.repository.js';
import { forumFilters } from './forum-validation.js';
import { CommunityRepository } from '../communities/community.repository.js';

function followingInput(body: unknown): boolean {
  const value = inputRecord(body, ['following']).following;
  if (typeof value !== 'boolean') invalidInput('Elige si quieres seguir este contenido.');
  return value;
}
@Controller()
export class ForumFollowController {
  constructor(@Inject(ForumFollowRepository) private readonly repository: ForumFollowRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(ForumRepository) private readonly posts: ForumRepository,
    @Inject(CommunityRepository) private readonly communities: CommunityRepository) {}
  @Get('authors/:id') @Header('Cache-Control', 'no-store') async author(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.repository.author(requestId(id), (await this.sessions.optional(request))?.user.id ?? null);
  }
  @Get('authors/:id/posts') @Header('Cache-Control', 'no-store') async authorPosts(@Param('id') id: string, @Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    const author = requestId(id);
    const viewer = (await this.sessions.optional(request))?.user.id ?? null;
    await this.repository.author(author, viewer);
    return this.posts.list({ ...forumFilters({ before: query.before, limit: query.limit }), author, publicOnly: true }, viewer);
  }
  @Get('authors/:id/communities') @Header('Cache-Control', 'no-store') async authorCommunities(@Param('id') id: string, @Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    const author = requestId(id);
    const viewer = (await this.sessions.optional(request))?.user.id ?? null;
    await this.repository.author(author, viewer);
    return this.communities.list({ ...pageInput(query), scope: 'all', publicMemberId: author }, viewer);
  }
  @Put('authors/:id/follow') @Header('Cache-Control', 'no-store') async authorFollow(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.repository.followAuthor(requestId(id), followingInput(body), actor);
  }
  @Put('communities/:id/follow') @Header('Cache-Control', 'no-store') async communityFollow(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.repository.followCommunity(resourceId(id), followingInput(body), actor);
  }
}
