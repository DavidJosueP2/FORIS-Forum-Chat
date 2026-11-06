import { Body, Controller, Get, Header, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { ForumRepository } from './forum.repository.js';
import { createPostInput, createReplyInput, updatePostInput, forumFilters, forumId } from './forum-validation.js';
import { pageInput } from '../../common/validation/input.js';

@Controller()
export class ForumController {
  constructor(@Inject(ForumRepository) private readonly repository: ForumRepository, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get('topics') @Header('Cache-Control', 'no-store') topics() { return this.repository.topics(); }
  @Get('posts') @Header('Cache-Control', 'no-store') async list(@Query() query: Record<string, unknown>, @Req() request: AuthRequest) { return this.repository.list(forumFilters(query), (await this.sessions.optional(request))?.user.id ?? null); }
  @Get('posts/:id') @Header('Cache-Control', 'no-store') async post(@Param('id') id: string, @Req() request: AuthRequest) { return this.repository.getPost(forumId(id), undefined, (await this.sessions.optional(request))?.user.id ?? null); }
  @Get('posts/:id/replies') @Header('Cache-Control', 'no-store') async replies(@Param('id') id: string, @Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    const pagination = pageInput(query);
    return this.repository.listReplies(forumId(id), pagination.before, pagination.limit, (await this.sessions.optional(request))?.user.id ?? null);
  }
  @Post('posts') async create(@Body() body: unknown, @Req() request: AuthRequest, @Res() response: Response) {
    const actor = await this.sessions.required(request);
    const result = await this.repository.createPost(createPostInput(body), actor);
    response.set('Cache-Control','no-store').status(result.created ? 201 : 200).json(result);
  }
  @Post('posts/:id/replies') async reply(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest, @Res() response: Response) {
    const actor = await this.sessions.required(request);
    const result = await this.repository.createReply(forumId(id), createReplyInput(body), actor);
    response.set('Cache-Control','no-store').status(result.created ? 201 : 200).json(result);
  }
  @Patch('posts/:id') @Header('Cache-Control', 'no-store') async update(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.repository.updatePost(forumId(id), updatePostInput(body), actor);
  }
}
