import { randomBytes } from 'node:crypto';
import type { SqliteDatabase } from '../db.js';

export type SessionRow = {
  id: string;
  created_at: string;
  expires_at: string;
};

export function createSessionStore(db: SqliteDatabase) {
  const insert = db.prepare(`
    INSERT INTO sessions (id, created_at, expires_at)
    VALUES (@id, @created_at, @expires_at)
  `);
  const select = db.prepare(`
    SELECT id, created_at, expires_at
    FROM sessions
    WHERE id = ?
  `);
  const remove = db.prepare(`DELETE FROM sessions WHERE id = ?`);
  const removeExpired = db.prepare(`
    DELETE FROM sessions
    WHERE expires_at <= ?
  `);

  return {
    create(ttlSeconds: number): SessionRow {
      const now = new Date();
      const row: SessionRow = {
        id: randomBytes(32).toString('hex'),
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      };
      insert.run(row);
      return row;
    },
    find(id: string): SessionRow | undefined {
      return select.get(id) as SessionRow | undefined;
    },
    delete(id: string): void {
      remove.run(id);
    },
    deleteExpired(): void {
      removeExpired.run(new Date().toISOString());
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
