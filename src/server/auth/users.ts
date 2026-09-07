import type { SqliteDatabase } from '../db.js';

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  is_owner: number;
  created_at: string;
};

export function createUserStore(db: SqliteDatabase) {
  const selectByEmail = db.prepare(`
    SELECT id, email, password_hash, is_owner, created_at
    FROM users
    WHERE email = ?
  `);
  const insert = db.prepare(`
    INSERT INTO users (id, email, password_hash, is_owner, created_at)
    VALUES (@id, @email, @password_hash, @is_owner, @created_at)
  `);

  return {
    findByEmail(email: string): UserRow | undefined {
      return selectByEmail.get(email) as UserRow | undefined;
    },
    insert(row: UserRow): void {
      insert.run(row);
    },
  };
}

export type UserStore = ReturnType<typeof createUserStore>;
