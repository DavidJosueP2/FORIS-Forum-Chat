import { Body, Controller, Get, Header, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { ForumRepository } from './forum.repository.js';
import { createPostInput, createReplyInput, forumFilters, forumId } from './forum-validation.js';

@Controller()
export class ForumController {
  constructor(@Inject(ForumRepository) private readonly repository: ForumRepository, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get('topics') @Header('Cache-Control', 'no-store') topics() { return this.repository.topics(); }
  @Get('posts') @Header('Cache-Control', 'no-store') list(@Query() query: Record<string, unknown>) { return this.repository.list(forumFilters(query)); }
  @Get('posts/:id') @Header('Cache-Control', 'no-store') post(@Param('id') id: string) { return this.repository.getPost(forumId(id)); }
  @Get('posts/:id/replies') @Header('Cache-Control', 'no-store') replies(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    const pagination = forumFilters(query);
    return this.repository.listReplies(forumId(id), pagination.before, pagination.limit);
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
}
