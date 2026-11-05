import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';

@Injectable()
export class HealthService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async check(): Promise<{ status: 'ok' }> {
    await this.database.ping();
    return { status: 'ok' };
  }
}
