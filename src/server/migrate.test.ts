import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { projectRoot } from './config.js';
import { openDatabase, type SqliteDatabase } from './db.js';
import { runMigrations } from './migrate.js';
import {
  MULTI_ACCOUNT_MIGRATION_ID,
  OWNER_BOOTSTRAP_ERROR,
} from './migrate-multi-account.js';

const OWNER_EMAIL = '  Lucas@Example.TEST  ';
const OWNER_EMAIL_NORMALIZED = 'lucas@example.test';
const OWNER_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHRmb3JtaWdyYXRpb24$dGVzdGhhc2hmb3JtaWdyYXRpb250ZXN0';

const bootstrap = {
  ownerEmail: OWNER_EMAIL,
  ownerPasswordHash: OWNER_PASSWORD_HASH,
};

const expectedMigrations = [
  '001_create_energy_entries.sql',
  '002_create_sessions.sql',
  MULTI_ACCOUNT_MIGRATION_ID,
];

const tempDir = await mkdtemp(path.join(tmpdir(), 'energy-tracker-migrate-'));

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function applySqlFile(db: SqliteDatabase, fileName: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  db.exec(readFileSync(path.join(projectRoot, 'migrations', fileName), 'utf8'));
  db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  ).run(fileName, new Date().toISOString());
}

function insertLegacyEntry(
  db: SqliteDatabase,
  id: string,
  timestamp: string,
): void {
  db.prepare(
    `INSERT INTO energy_entries (
      id, timestamp, energy, fatigue, desire, context, activity, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    timestamp,
    6,
    4,
    null,
    null,
    null,
    '2026-09-06T15:45:01.000Z',
    '2026-09-06T15:45:01.000Z',
  );
}

test('migration exécutée une fois puis relancée sans recréer ni effacer de données', () => {
  const databasePath = path.join(tempDir, 'replay.sqlite');
  const db = openDatabase(databasePath);
  try {
    const first = runMigrations(db, bootstrap);
    assert.deepEqual(first, expectedMigrations);

    const owner = db.prepare('SELECT id, email, is_owner FROM users').get() as {
      id: string;
      email: string;
      is_owner: number;
    };
    assert.equal(owner.email, OWNER_EMAIL_NORMALIZED);
    assert.equal(owner.is_owner, 1);

    db.prepare(
      `INSERT INTO energy_entries (
        id, user_id, timestamp, energy, fatigue, desire, context, activity,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'entry-1',
      owner.id,
      '2026-09-06T15:45:00.000Z',
      6,
      4,
      null,
      null,
      null,
      '2026-09-06T15:45:01.000Z',
      '2026-09-06T15:45:01.000Z',
    );

    const second = runMigrations(db, bootstrap);
    assert.deepEqual(second, []);

    const count = db
      .prepare('SELECT COUNT(*) AS total FROM energy_entries')
      .get() as { total: number };
    assert.equal(count.total, 1);

    const owners = db
      .prepare('SELECT COUNT(*) AS total FROM users WHERE is_owner = 1')
      .get() as { total: number };
    assert.equal(owners.total, 1);

    const migrations = db
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .all() as Array<{ id: string }>;
    assert.deepEqual(migrations, [
      { id: '001_create_energy_entries.sql' },
      { id: '002_create_sessions.sql' },
      { id: MULTI_ACCOUNT_MIGRATION_ID },
    ]);
  } finally {
    db.close();
  }
});

test('003 rattache les entrées existantes au propriétaire, recrée les sessions et vérifie les FK', () => {
  const databasePath = path.join(tempDir, 'backfill.sqlite');
  const db = openDatabase(databasePath);
  try {
    applySqlFile(db, '001_create_energy_entries.sql');
    applySqlFile(db, '002_create_sessions.sql');
    insertLegacyEntry(db, 'entry-a', '2026-09-06T15:45:00.000Z');
    insertLegacyEntry(db, 'entry-b', '2026-09-06T16:45:00.000Z');
    db.prepare(
      `INSERT INTO sessions (id, created_at, expires_at) VALUES (?, ?, ?)`,
    ).run(
      'legacy-session',
      '2026-09-06T15:00:00.000Z',
      '2026-09-20T15:00:00.000Z',
    );

    const before = db
      .prepare('SELECT COUNT(*) AS total FROM energy_entries')
      .get() as { total: number };
    assert.equal(before.total, 2);

    const applied = runMigrations(db, bootstrap);
    assert.deepEqual(applied, [MULTI_ACCOUNT_MIGRATION_ID]);

    const after = db
      .prepare('SELECT COUNT(*) AS total FROM energy_entries')
      .get() as { total: number };
    assert.equal(after.total, 2);

    const owner = db
      .prepare('SELECT id, email, password_hash, is_owner FROM users')
      .get() as {
      id: string;
      email: string;
      password_hash: string;
      is_owner: number;
    };
    assert.equal(owner.email, OWNER_EMAIL_NORMALIZED);
    assert.equal(owner.is_owner, 1);
    assert.equal(owner.password_hash, OWNER_PASSWORD_HASH);

    const orphaned = db
      .prepare(
        'SELECT COUNT(*) AS total FROM energy_entries WHERE user_id IS NULL',
      )
      .get() as { total: number };
    assert.equal(orphaned.total, 0);

    const assigned = db
      .prepare('SELECT COUNT(*) AS total FROM energy_entries WHERE user_id = ?')
      .get(owner.id) as { total: number };
    assert.equal(assigned.total, 2);

    const ids = db
      .prepare('SELECT id FROM energy_entries ORDER BY timestamp ASC, id ASC')
      .all() as Array<{ id: string }>;
    assert.deepEqual(
      ids.map((row) => row.id),
      ['entry-a', 'entry-b'],
    );

    const sessions = db
      .prepare('SELECT COUNT(*) AS total FROM sessions')
      .get() as { total: number };
    assert.equal(sessions.total, 0);

    const index = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
      )
      .get('idx_energy_entries_user_timestamp_id') as { name: string };
    assert.equal(index.name, 'idx_energy_entries_user_timestamp_id');

    const foreignKeyCheck = db.pragma('foreign_key_check') as unknown[];
    assert.deepEqual(foreignKeyCheck, []);

    assert.throws(
      () =>
        db
          .prepare(
            `INSERT INTO energy_entries (
              id, user_id, timestamp, energy, fatigue, desire, context, activity,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            'orphan',
            'missing-user',
            '2026-09-06T17:00:00.000Z',
            5,
            5,
            null,
            null,
            null,
            '2026-09-06T17:00:00.000Z',
            '2026-09-06T17:00:00.000Z',
          ),
      /FOREIGN KEY/i,
    );
  } finally {
    db.close();
  }
});

test('003 sans bootstrap échoue et ne laisse pas de schéma partiel', () => {
  const databasePath = path.join(tempDir, 'fail.sqlite');
  const db = openDatabase(databasePath);
  try {
    applySqlFile(db, '001_create_energy_entries.sql');
    applySqlFile(db, '002_create_sessions.sql');
    insertLegacyEntry(db, 'entry-1', '2026-09-06T15:45:00.000Z');

    assert.throws(
      () => runMigrations(db, {}),
      (error: unknown) =>
        error instanceof Error && error.message.includes(OWNER_BOOTSTRAP_ERROR),
    );

    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`,
      )
      .get();
    assert.equal(tables, undefined);

    const count = db
      .prepare('SELECT COUNT(*) AS total FROM energy_entries')
      .get() as { total: number };
    assert.equal(count.total, 1);

    const columns = db
      .prepare('PRAGMA table_info(energy_entries)')
      .all() as Array<{
      name: string;
    }>;
    assert.equal(
      columns.some((column) => column.name === 'user_id'),
      false,
    );
  } finally {
    db.close();
  }
});
