import { Inject, Injectable } from '@nestjs/common';
import type { SearchResult } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { readableCommunity, readablePost } from '../communities/community-access.js';
import { visibleAuthor } from './author-visibility.js';

const fold = (column: string) => `translate(lower(${column}),'áéíóúü','aeiouu')`;

@Injectable()
export class SearchRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async find(term: string, viewer: string | null): Promise<SearchResult[]> {
    const literal = term.toLowerCase().normalize('NFC').replace(/[áéíóúü]/gu, vowel => 'aeiouu'['áéíóúü'.indexOf(vowel)])
      .replace(/[\\%_]/gu, '\\$&');
    const contains = '%' + literal + '%';
    const result = await this.database.query<SearchResult>(`
      (SELECT 'user' AS kind,u.id::text AS id,u.display_name AS title FROM users u
        WHERE ${fold('u.display_name')} LIKE $2 AND u.email_verified_at IS NOT NULL AND ${visibleAuthor('$1')}
        ORDER BY (${fold('u.display_name')} LIKE $3) DESC,u.display_name,u.id LIMIT 4)
      UNION ALL
      (SELECT 'community',c.id::text,c.name FROM communities c
        WHERE (${fold('c.name')} LIKE $2 OR ${fold('c.description')} LIKE $2) AND ${readableCommunity('c', '$1')}
        ORDER BY (${fold('c.name')} LIKE $3) DESC,(${fold('c.name')} LIKE $2) DESC,c.member_count DESC,c.id DESC LIMIT 4)
      UNION ALL
      (SELECT 'post',p.id::text,p.title FROM forum_posts p
        WHERE (${fold('p.title')} LIKE $2 OR ${fold('p.body')} LIKE $2) AND ${readablePost('$1')}
        ORDER BY (${fold('p.title')} LIKE $3) DESC,(${fold('p.title')} LIKE $2) DESC,p.created_at DESC,p.id DESC LIMIT 4)`,
    [viewer, contains, literal + '%']);
    return result.rows;
  }
}
