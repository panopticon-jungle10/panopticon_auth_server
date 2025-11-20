import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class UsersService {
  constructor(private db: DbService) {}

  async upsert(payload: any) {
    const { provider, github_id, google_id, login, email, avatar_url } = payload;

    if (provider === 'github' && github_id) {
      const sql = `INSERT INTO users (github_id, login, email, avatar_url, provider)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (github_id) DO UPDATE SET
          login = EXCLUDED.login,
          email = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url,
          provider = EXCLUDED.provider,
          updated_at = now()
        RETURNING *`;
      const result = await this.db.query(sql, [github_id, login || null, email || null, avatar_url || null, provider]);
      return result.rows[0];
    }

    if (provider === 'google' && google_id) {
      const sql = `INSERT INTO users (google_id, login, email, avatar_url, provider)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (google_id) DO UPDATE SET
          login = EXCLUDED.login,
          email = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url,
          provider = EXCLUDED.provider,
          updated_at = now()
        RETURNING *`;
      const result = await this.db.query(sql, [google_id, login || null, email || null, avatar_url || null, provider]);
      return result.rows[0];
    }

    if (email) {
      const sql = `INSERT INTO users (email, login, avatar_url, provider)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (email) DO UPDATE SET
          login = EXCLUDED.login,
          avatar_url = EXCLUDED.avatar_url,
          provider = EXCLUDED.provider,
          updated_at = now()
        RETURNING *`;
      const result = await this.db.query(sql, [email, login || null, avatar_url || null, provider]);
      return result.rows[0];
    }

    throw new Error('insufficient identifiers');
  }
}

