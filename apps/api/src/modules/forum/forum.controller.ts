import { Body, Controller, Delete, Get, Header, Inject, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { ForumRepository } from './forum.repository.js';
import { createPostInput, createReplyInput, updatePostInput, forumFilters, forumId, updateReplyInput, deleteReplyInput, voteInput, pinInput } from './forum-validation.js';
import { inputText, pageInput, resourceId } from '../../common/validation/input.js';
import { ForumDiscussionRepository } from './forum-discussion.repository.js';
import { SearchRepository } from './search.repository.js';

@Controller()
export class ForumController {
  constructor(@Inject(ForumRepository) private readonly repository: ForumRepository, @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(ForumDiscussionRepository) private readonly discussion: ForumDiscussionRepository,
    @Inject(SearchRepository) private readonly searchIndex: SearchRepository) {}
  @Get('search') @Header('Cache-Control', 'no-store')
  async search(@Query('q') query: unknown, @Req() request: AuthRequest) {
    const term = inputText(query, 'La búsqueda', 120);
    if (Array.from(term).length < 2) return { results: [] };
    return { results: await this.searchIndex.find(term, (await this.sessions.optional(request))?.user.id ?? null) };
  }
  @Get('topics') @Header('Cache-Control', 'no-store') topics() { return this.repository.topics(); }
  @Get('posts') @Header('Cache-Control', 'no-store') async list(@Query() query: Record<string, unknown>, @Req() request: AuthRequest) { return this.repository.list(forumFilters(query), (await this.sessions.optional(request))?.user.id ?? null); }
  @Get('posts/:id') @Header('Cache-Control', 'no-store') async post(@Param('id') id: string, @Req() request: AuthRequest) { return this.repository.getPost(forumId(id), undefined, (await this.sessions.optional(request))?.user.id ?? null); }
  @Get('posts/:id/replies') @Header('Cache-Control', 'no-store') async replies(@Param('id') id: string, @Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    const pagination = pageInput(query);
    const parentId = query.parentId === undefined ? null : resourceId(query.parentId);
    return this.discussion.list(forumId(id), parentId, pagination.before, pagination.limit, (await this.sessions.optional(request))?.user.id ?? null);
  }
  @Get('posts/:id/replies/:replyId') @Header('Cache-Control', 'no-store') async comment(@Param('id') id: string, @Param('replyId') replyId: string, @Req() request: AuthRequest) {
    return this.discussion.get(forumId(id), resourceId(replyId), (await this.sessions.optional(request))?.user.id ?? null);
  }
  @Post('posts') async create(@Body() body: unknown, @Req() request: AuthRequest, @Res() response: Response) {
    const actor = await this.sessions.required(request);
    const result = await this.repository.createPost(createPostInput(body), actor);
    response.set('Cache-Control','no-store').status(result.created ? 201 : 200).json(result);
  }
  @Post('posts/:id/replies') async reply(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest, @Res() response: Response) {
    const actor = await this.sessions.required(request);
    const result = await this.discussion.create(forumId(id), createReplyInput(body), actor);
    response.set('Cache-Control','no-store').status(result.created ? 201 : 200).json(result);
  }
  @Patch('posts/:id') @Header('Cache-Control', 'no-store') async update(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.repository.updatePost(forumId(id), updatePostInput(body), actor);
  }
  @Patch('posts/:id/replies/:replyId') @Header('Cache-Control', 'no-store') async updateReply(@Param('id') id: string, @Param('replyId') replyId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.discussion.update(forumId(id), resourceId(replyId), updateReplyInput(body), actor);
  }
  @Delete('posts/:id/replies/:replyId') @Header('Cache-Control', 'no-store') async deleteReply(@Param('id') id: string, @Param('replyId') replyId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.discussion.remove(forumId(id), resourceId(replyId), deleteReplyInput(body), actor);
  }
  @Put('posts/:id/vote') @Header('Cache-Control', 'no-store') async vote(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.discussion.vote(forumId(id), null, voteInput(body), actor);
  }
  @Put('posts/:id/replies/:replyId/vote') @Header('Cache-Control', 'no-store') async voteReply(@Param('id') id: string, @Param('replyId') replyId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.discussion.vote(forumId(id), resourceId(replyId), voteInput(body), actor);
  }
  @Put('posts/:id/replies/:replyId/pin') @Header('Cache-Control', 'no-store') async pin(@Param('id') id: string, @Param('replyId') replyId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const actor = await this.sessions.required(request);
    return this.discussion.pin(forumId(id), resourceId(replyId), pinInput(body), actor);
  }
}
