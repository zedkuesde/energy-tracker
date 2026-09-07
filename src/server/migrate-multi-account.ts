import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from './db.js';
import { normalizeEmail } from './validation/account.js';

export const MULTI_ACCOUNT_MIGRATION_ID = '003_multi_account';

export const OWNER_BOOTSTRAP_ERROR =
  'Migration 003_multi_account : définissez AUTH_OWNER_EMAIL (email du compte propriétaire) et AUTH_PASSWORD_HASH (hash Argon2id existant) dans .env.';

export type OwnerBootstrap = {
  ownerEmail: string;
  ownerPasswordHash: string;
};

export type MigrationOptions = {
  ownerEmail?: string;
  ownerPasswordHash?: string;
};

export function resolveOwnerBootstrap(
  options?: MigrationOptions,
): OwnerBootstrap {
  const ownerEmail = options
    ? (options.ownerEmail ?? '')
    : (process.env.AUTH_OWNER_EMAIL ?? '');
  const ownerPasswordHash = options
    ? (options.ownerPasswordHash ?? '')
    : (process.env.AUTH_PASSWORD_HASH ?? '');

  const email = normalizeEmail(ownerEmail);
  const hash = ownerPasswordHash.trim();

  if (!email || !hash.startsWith('$argon2id$')) {
    throw new Error(OWNER_BOOTSTRAP_ERROR);
  }

  return { ownerEmail: email, ownerPasswordHash: hash };
}

export function applyMultiAccountMigration(
  db: SqliteDatabase,
  bootstrap: OwnerBootstrap,
): void {
  const countBefore = (
    db.prepare('SELECT COUNT(*) AS total FROM energy_entries').get() as {
      total: number;
    }
  ).total;

  const ownerId = randomUUID();
  const createdAt = new Date().toISOString();

  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1)),
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_users_email ON users (email);
    CREATE UNIQUE INDEX idx_users_owner ON users (is_owner) WHERE is_owner = 1;
  `);

  db.prepare(
    `
      INSERT INTO users (id, email, password_hash, is_owner, created_at)
      VALUES (@id, @email, @password_hash, @is_owner, @created_at)
    `,
  ).run({
    id: ownerId,
    email: bootstrap.ownerEmail,
    password_hash: bootstrap.ownerPasswordHash,
    is_owner: 1,
    created_at: createdAt,
  });

  db.exec(`
    CREATE TABLE energy_entries_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      energy INTEGER NOT NULL CHECK (energy >= 0 AND energy <= 10),
      fatigue INTEGER NOT NULL CHECK (fatigue >= 0 AND fatigue <= 10),
      desire INTEGER CHECK (desire IS NULL OR (desire >= 0 AND desire <= 10)),
      context TEXT CHECK (context IS NULL OR length(context) <= 280),
      activity TEXT CHECK (
        activity IS NULL
        OR activity IN (
          'rest',
          'work',
          'transport',
          'leisure',
          'creative',
          'sport',
          'other'
        )
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.prepare(
    `
      INSERT INTO energy_entries_new (
        id, user_id, timestamp, energy, fatigue, desire, context, activity,
        created_at, updated_at
      )
      SELECT
        id, ?, timestamp, energy, fatigue, desire, context, activity,
        created_at, updated_at
      FROM energy_entries
    `,
  ).run(ownerId);

  const countCopied = (
    db.prepare('SELECT COUNT(*) AS total FROM energy_entries_new').get() as {
      total: number;
    }
  ).total;
  if (countCopied !== countBefore) {
    throw new Error(
      'Migration 003_multi_account : le nombre d’entrées a changé pendant la copie.',
    );
  }

  db.exec(`
    DROP TABLE energy_entries;
    ALTER TABLE energy_entries_new RENAME TO energy_entries;
    CREATE INDEX idx_energy_entries_user_timestamp_id
      ON energy_entries (user_id, timestamp DESC, id DESC);
  `);

  const missingOwner = (
    db
      .prepare(
        'SELECT COUNT(*) AS total FROM energy_entries WHERE user_id IS NULL',
      )
      .get() as { total: number }
  ).total;
  if (missingOwner !== 0) {
    throw new Error(
      'Migration 003_multi_account : des entrées n’ont pas de propriétaire.',
    );
  }

  db.exec(`
    DROP TABLE sessions;
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
    CREATE INDEX idx_sessions_user_id ON sessions (user_id);
  `);

  const foreignKeyViolations = db.pragma('foreign_key_check') as unknown[];
  if (foreignKeyViolations.length > 0) {
    throw new Error(
      'Migration 003_multi_account : PRAGMA foreign_key_check a échoué.',
    );
  }
}
