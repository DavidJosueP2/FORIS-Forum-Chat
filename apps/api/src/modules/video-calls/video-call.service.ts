import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, BeforeApplicationShutdown } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { VideoCallJoin, VideoCallStatus } from '@messages/contracts';
import { APP_CONFIG, APP_LOGGER } from '../../config/app-config.js';
import type { AppConfig, AppLogger } from '../../config/app-config.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { AuthContext } from '../auth/auth.types.js';
import { VideoCallRepository, callCapacity } from './video-call.repository.js';
import { cloudflareTurnServers } from './cloudflare-turn.js';
import type { ConversationScope } from '../conversations/conversation-access.js';

@Injectable()
export class VideoCallService implements OnModuleInit, BeforeApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | undefined;
  private cleanup: Promise<void> | undefined;
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig, @Inject(APP_LOGGER) private readonly logger: AppLogger,
    @Inject(VideoCallRepository) readonly repository: VideoCallRepository) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      this.cleanup ??= this.repository.sweep().catch(() => { this.logger.error('video_call_cleanup_failed'); }).finally(() => { this.cleanup = undefined; });
    }, 60000);
    this.timer.unref();
  }
  async beforeApplicationShutdown() { if (this.timer) clearInterval(this.timer); await this.cleanup; }
  requireEnabled() { if (!this.config.videoCalls.enabled) throw new HttpError(503, 'CALL_DISABLED', 'Las videollamadas todavía no están disponibles en este entorno.'); }
  async status(actor: AuthContext, scope?: ConversationScope): Promise<VideoCallStatus> {
    return { enabled: this.config.videoCalls.enabled, participants: await this.repository.count(actor, scope), capacity: callCapacity(scope), relay: this.config.videoCalls.turn !== null };
  }
  async join(actor: AuthContext, requestId: string, scope?: ConversationScope): Promise<VideoCallJoin> {
    this.requireEnabled();
    const config = this.config.videoCalls;
    const turn = config.turn;
    // El controlador ya exige sesión verificada. No reservar plazas si el proveedor falla.
    if (scope && turn?.provider === 'cloudflare') await this.repository.checkAccess(actor, scope);
    const cloudflare = turn?.provider === 'cloudflare' ? await cloudflareTurnServers(turn) : undefined;
    const member = await this.repository.join(actor, requestId, scope);
    if (cloudflare) return { ...member, iceTransportPolicy: 'relay', iceServers: cloudflare };
    if (turn?.provider === 'coturn') {
      const username = Math.floor(Date.now() / 1000 + 3600) + ':' + member.memberId;
      const credential = createHmac('sha1', turn.secret).update(username).digest('base64');
      return { ...member, iceTransportPolicy: 'relay', iceServers: [{ urls: turn.urls, username, credential }] };
    }
    return { ...member, iceTransportPolicy: 'all', iceServers: config.stunUrls.length ? [{ urls: config.stunUrls }] : [] };
  }
}
