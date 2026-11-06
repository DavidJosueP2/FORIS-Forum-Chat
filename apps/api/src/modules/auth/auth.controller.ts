import { Body, Controller, Get, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { GoogleAuthService, GoogleCallbackError } from './google-auth.service.js';
import { SessionService } from './session.service.js';
import { OtpService } from './otp.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import { record, text } from './auth-validation.js';
import type { AuthRequest } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(GoogleAuthService) private readonly google: GoogleAuthService,
  ) {}
  @Get('options') options() { return this.auth.options(); }
  @Get('session') async session(@Req() request: AuthRequest) {
    // Una respuesta GET antigua no debe borrar la cookie recién rotada por otro flujo.
    return this.sessions.view(await this.sessions.optional(request));
  }
  @Post('register') register(@Body() body: unknown) { return this.auth.register(body); }
  @Post('verify-email') async verify(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const grant = await this.auth.verifyEmail(body);
    this.sessions.setCookie(response, grant);
    return this.sessions.view(grant.context);
  }
  @Post('login') async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body);
    if ('challenge' in result) return { challenge: result.challenge };
    this.sessions.setCookie(response, result.grant);
    return { session: this.sessions.view(result.grant.context) };
  }
  @Post('logout') async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    await this.sessions.logout(request, response);
    return { message: 'Sesión cerrada.' };
  }
  @Post('otp/resend') async resend(@Body() body: unknown, @Req() request: AuthRequest) {
    const fields = record(body, ['challengeId']);
    const id = text(fields.challengeId, 'La solicitud', 36);
    if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(id)) throw new HttpError(400, 'INVALID_INPUT', 'La solicitud no es válida.');
    return this.otp.resend(id, (await this.sessions.optional(request)) ?? undefined);
  }
  @Post('password/forgot') forgot(@Body() body: unknown) { return this.auth.forgotPassword(body); }
  @Post('password/reset') reset(@Body() body: unknown) { return this.auth.resetPassword(body); }
  @Post('google/start') startGoogle(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    return this.google.start(body, request, response);
  }
  @Get('google/callback') async callback(@Query() query: Record<string, unknown>, @Req() request: AuthRequest, @Res() response: Response) {
    this.google.clearCookie(response);
    try {
      const result = await this.google.callback(query, request);
      this.sessions.setCookie(response, result.grant);
      response.redirect(303, result.intent === 'login' ? result.returnTo : '/profile?notice=' + (result.intent === 'link' ? 'google_linked' : 'reauthenticated'));
    } catch (error) {
      const codes = new Set(['GOOGLE_CANCELLED','GOOGLE_FLOW_EXPIRED','GOOGLE_ACCOUNT_EXISTS','GOOGLE_IN_USE','GOOGLE_IDENTITY_MISMATCH','SESSION_REQUIRED','GOOGLE_ALREADY_LINKED']);
      const code = error instanceof HttpError && codes.has(error.code) ? error.code : 'GOOGLE_FAILED';
      const params = new URLSearchParams({ error: code, next: error instanceof GoogleCallbackError ? error.returnTo : '/' });
      response.redirect(303, '/login?' + params.toString());
    }
  }
}
