import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from './db.js';
import { runMigrations } from './migrate.js';

const tempDir = await mkdtemp(path.join(tmpdir(), 'energy-tracker-migrate-'));
const databasePath = path.join(tempDir, 'test.sqlite');

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('migration exécutée une fois puis relancée sans recréer ni effacer de données', () => {
  const db = openDatabase(databasePath);
  try {
    const first = runMigrations(db);
    assert.deepEqual(first, ['001_create_energy_entries.sql']);

    db.prepare(
      `INSERT INTO energy_entries (
        id, timestamp, energy, fatigue, desire, context, activity, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'entry-1',
      '2026-09-06T15:45:00.000Z',
      6,
      4,
      null,
      null,
      null,
      '2026-09-06T15:45:01.000Z',
      '2026-09-06T15:45:01.000Z',
    );

    const second = runMigrations(db);
    assert.deepEqual(second, []);

    const count = db
      .prepare('SELECT COUNT(*) AS total FROM energy_entries')
      .get() as {
      total: number;
    };
    assert.equal(count.total, 1);

    const migrations = db
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .all() as Array<{ id: string }>;
    assert.deepEqual(migrations, [{ id: '001_create_energy_entries.sql' }]);
  } finally {
    db.close();
  }
});
