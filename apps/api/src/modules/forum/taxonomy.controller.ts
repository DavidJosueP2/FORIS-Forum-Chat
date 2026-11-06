import { Controller, Get, Header, Inject, Param, Query, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { requestId } from '../../common/validation/input.js';
import { TaxonomyRepository, category } from './taxonomy.repository.js';
import { tagFilters } from './taxonomy-validation.js';

@Controller('taxonomy')
export class TaxonomyController {
  constructor(@Inject(TaxonomyRepository) private readonly repository: TaxonomyRepository,
    @Inject(SessionService) private readonly sessions: SessionService) {}

  @Get('categories') @Header('Cache-Control', 'no-store') categories() { return this.repository.categories(); }
  @Get('categories/:id') @Header('Cache-Control', 'no-store') async get(@Param('id') id: string) {
    return category(await this.repository.get(requestId(id)));
  }
  @Get('tags') @Header('Cache-Control', 'no-store') async tags(@Query() query: Record<string, unknown>, @Req() request: AuthRequest) {
    const filters = tagFilters(query);
    return this.repository.tags(filters.search, filters.limit, (await this.sessions.optional(request))?.user.id ?? null);
  }
}
