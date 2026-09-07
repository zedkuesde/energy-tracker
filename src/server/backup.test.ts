import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backupDatabase, restoreDatabase } from './backup.js';
import { openDatabase } from './db.js';
import { runMigrations } from './migrate.js';

const tempDir = await mkdtemp(path.join(tmpdir(), 'energy-tracker-backup-'));

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('backup produit un fichier SQLite unique restaurable', async () => {
  const sourcePath = path.join(tempDir, 'source.sqlite');
  const backupPath = path.join(
    tempDir,
    'energy-tracker-20260101-000000.sqlite',
  );
  const restoredPath = path.join(tempDir, 'restored.sqlite');

  const db = openDatabase(sourcePath);
  try {
    runMigrations(db, {
      ownerEmail: 'owner@example.test',
      ownerPasswordHash:
        '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHRmb3JtaWdyYXRpb24$dGVzdGhhc2hmb3JtaWdyYXRpb250ZXN0',
    });
    const owner = db
      .prepare('SELECT id FROM users WHERE is_owner = 1')
      .get() as { id: string };
    db.prepare(
      `INSERT INTO energy_entries (
        id, user_id, timestamp, energy, fatigue, desire, context, activity,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      owner.id,
      '2026-09-06T15:45:00.000Z',
      7,
      3,
      null,
      null,
      null,
      '2026-09-06T15:45:01.000Z',
      '2026-09-06T15:45:01.000Z',
    );
  } finally {
    db.close();
  }

  await backupDatabase(sourcePath, backupPath);
  assert.equal(existsSync(backupPath), true);
  assert.equal(existsSync(`${backupPath}-wal`), false);
  assert.equal(existsSync(`${backupPath}-shm`), false);

  restoreDatabase(backupPath, restoredPath);
  const restored = openDatabase(restoredPath);
  try {
    const row = restored
      .prepare('SELECT energy FROM energy_entries WHERE id = ?')
      .get('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as { energy: number };
    assert.equal(row.energy, 7);
  } finally {
    restored.close();
  }
});
