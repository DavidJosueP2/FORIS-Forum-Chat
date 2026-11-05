import { Body, Controller, Get, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import type { AuthRequest } from './auth.types.js';

@Controller('account')
export class AccountController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(SessionService) private readonly sessions: SessionService) {}
  @Get('profile') async profile(@Req() request: AuthRequest) { return (await this.sessions.required(request)).user; }
  @Patch('profile') async update(@Body() body: unknown, @Req() request: AuthRequest) {
    return this.auth.updateProfile(body, await this.sessions.required(request));
  }
  @Post('email/request') async emailRequest(@Body() body: unknown, @Req() request: AuthRequest) {
    return this.auth.requestEmailChange(body, await this.sessions.required(request));
  }
  @Post('email/confirm') async emailConfirm(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const grant = await this.auth.changeEmail(body, await this.sessions.required(request));
    this.sessions.setCookie(response, grant);
    return this.sessions.view(grant.context);
  }
  @Post('password/request') async passwordRequest(@Body() body: unknown, @Req() request: AuthRequest) {
    return this.auth.requestPasswordChange(body, await this.sessions.required(request));
  }
  @Post('password/confirm') async passwordConfirm(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const grant = await this.auth.changePassword(body, await this.sessions.required(request));
    this.sessions.setCookie(response, grant);
    return this.sessions.view(grant.context);
  }
  @Post('google/unlink') async unlink(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const grant = await this.auth.unlinkGoogle(body, await this.sessions.required(request));
    this.sessions.setCookie(response, grant);
    return this.sessions.view(grant.context);
  }
}
