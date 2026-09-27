import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertCanonicalDemoDatabasePath,
  assertCodespacesSecretsPresent,
  assertGitHubCodespaces,
  AUTH_SESSION_SECRET_NAME,
  CodespacesDemoError,
  CODESPACES_DEMO_DB_RELATIVE,
  CODESPACES_DEMO_PASSWORD_SECRET,
  codespacesPreviewUrl,
  findMissingCodespacesSecrets,
  formatMissingSecretsMessage,
  getCanonicalDemoDatabasePath,
  isGitHubCodespaces,
} from './codespaces-demo.js';
import { resetCodespacesDemoDatabase } from './codespaces-demo-reset.js';
import {
  buildDemoEntrySeeds,
  materializeDemoEntries,
  seedCodespacesDemoEntries,
} from './codespaces-demo-seed.js';
import { openDatabase } from './db.js';
import { runMigrations } from './migrate.js';

const OWNER_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHRmb3Jjb2Rlc3BhY2Vz$dGVzdGhhc2hmb3Jjb2Rlc3BhY2VzZGVtbw';

const tempRoot = await mkdtemp(path.join(tmpdir(), 'energy-tracker-cs-'));

after(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

test('isGitHubCodespaces exige CODESPACES=true', () => {
  assert.equal(isGitHubCodespaces({}), false);
  assert.equal(isGitHubCodespaces({ CODESPACES: 'false' }), false);
  assert.equal(isGitHubCodespaces({ CODESPACES: 'true' }), true);
});

test('assertGitHubCodespaces refuse hors Codespaces', () => {
  assert.throws(
    () => assertGitHubCodespaces({}),
    (error: unknown) =>
      error instanceof CodespacesDemoError &&
      error.message.includes('uniquement autorisée'),
  );
});

test('chemin canonique sous la racine du dépôt', () => {
  const expected = path.resolve(tempRoot, CODESPACES_DEMO_DB_RELATIVE);
  assert.equal(getCanonicalDemoDatabasePath(tempRoot), expected);
  assert.equal(assertCanonicalDemoDatabasePath(tempRoot), expected);
});

test('refuse un chemin personnalisé même sous data/', () => {
  assert.throws(
    () =>
      assertCanonicalDemoDatabasePath(
        tempRoot,
        path.join(tempRoot, 'data', 'other.sqlite'),
      ),
    (error: unknown) =>
      error instanceof CodespacesDemoError &&
      error.message.includes('Chemin de base refusé'),
  );
});

test('refuse un lien symbolique vers le fichier de base', () => {
  const root = path.join(tempRoot, 'symlink-file');
  mkdirSync(path.join(root, 'data'), { recursive: true });
  const target = path.join(root, 'data', 'real.sqlite');
  const link = path.join(root, 'data', 'codespaces-demo.sqlite');
  writeFileSync(target, '');
  symlinkSync(target, link);

  assert.throws(
    () => assertCanonicalDemoDatabasePath(root),
    (error: unknown) =>
      error instanceof CodespacesDemoError &&
      error.message.includes('lien symbolique'),
  );
});

test('refuse un répertoire data/ qui est un lien symbolique', () => {
  const root = path.join(tempRoot, 'symlink-dir');
  const realData = path.join(root, 'real-data');
  mkdirSync(realData, { recursive: true });
  mkdirSync(root, { recursive: true });
  symlinkSync(realData, path.join(root, 'data'));

  assert.throws(
    () => assertCanonicalDemoDatabasePath(root),
    (error: unknown) =>
      error instanceof CodespacesDemoError &&
      error.message.includes('lien symbolique'),
  );
});

test('secrets manquants : message avec le nom seulement', () => {
  const missing = findMissingCodespacesSecrets({
    [CODESPACES_DEMO_PASSWORD_SECRET]: 'long-enough-demo-password',
  });
  assert.equal(missing.length, 1);
  assert.equal(missing[0]?.name, AUTH_SESSION_SECRET_NAME);
  const message = formatMissingSecretsMessage(missing);
  assert.match(message, new RegExp(AUTH_SESSION_SECRET_NAME));
  assert.doesNotMatch(message, /long-enough/);

  assert.throws(
    () =>
      assertCodespacesSecretsPresent({
        [AUTH_SESSION_SECRET_NAME]: 'x'.repeat(32),
      }),
    (error: unknown) =>
      error instanceof CodespacesDemoError &&
      error.message.includes(CODESPACES_DEMO_PASSWORD_SECRET) &&
      !error.message.includes('x'.repeat(8)),
  );
});

test('codespacesPreviewUrl construit l’URL du port 3000', () => {
  assert.equal(
    codespacesPreviewUrl({
      CODESPACE_NAME: 'fancy-space',
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
    }),
    'https://fancy-space-3000.app.github.dev',
  );
  assert.equal(codespacesPreviewUrl({}), null);
});

test('reset refuse hors Codespaces, sans confirm, et chemin tiers', () => {
  const root = path.join(tempRoot, 'reset-guards');
  mkdirSync(path.join(root, 'data'), { recursive: true });
  const dbPath = path.join(root, 'data', 'codespaces-demo.sqlite');
  writeFileSync(dbPath, 'demo');

  assert.throws(
    () =>
      resetCodespacesDemoDatabase({
        projectRoot: root,
        env: {},
        confirm: true,
      }),
    CodespacesDemoError,
  );

  assert.throws(
    () =>
      resetCodespacesDemoDatabase({
        projectRoot: root,
        env: { CODESPACES: 'true' },
        confirm: false,
      }),
    (error: unknown) =>
      error instanceof CodespacesDemoError &&
      error.message.includes('--confirm'),
  );

  assert.throws(
    () =>
      resetCodespacesDemoDatabase({
        projectRoot: root,
        env: { CODESPACES: 'true' },
        confirm: true,
        candidatePath: path.join(root, 'data', 'energy-tracker.sqlite'),
      }),
    (error: unknown) =>
      error instanceof CodespacesDemoError &&
      error.message.includes('Chemin de base refusé'),
  );
});

test('reset confirme supprime uniquement sqlite/wal/shm canoniques', () => {
  const root = path.join(tempRoot, 'reset-ok');
  mkdirSync(path.join(root, 'data'), { recursive: true });
  const dbPath = path.join(root, 'data', 'codespaces-demo.sqlite');
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  const otherPath = path.join(root, 'data', 'energy-tracker.sqlite');
  writeFileSync(dbPath, 'demo');
  writeFileSync(walPath, 'wal');
  writeFileSync(shmPath, 'shm');
  writeFileSync(otherPath, 'prod-like');

  const result = resetCodespacesDemoDatabase({
    projectRoot: root,
    env: { CODESPACES: 'true' },
    confirm: true,
  });

  assert.equal(result.databasePath, dbPath);
  assert.deepEqual(
    new Set(result.removed),
    new Set([dbPath, walPath, shmPath]),
  );
  assert.equal(existsSync(dbPath), false);
  assert.equal(existsSync(otherPath), true);
});

test('seed démo : desire null et 0, idempotent', () => {
  const databasePath = path.join(tempRoot, 'seed.sqlite');
  const db = openDatabase(databasePath);
  try {
    runMigrations(db, {
      ownerEmail: 'demo@energy-tracker.local',
      ownerPasswordHash: OWNER_PASSWORD_HASH,
    });

    const seeds = buildDemoEntrySeeds();
    assert.ok(seeds.some((entry) => entry.desire === null));
    assert.ok(seeds.some((entry) => entry.desire === 0));

    const now = new Date('2026-09-27T12:00:00.000Z');
    const materialized = materializeDemoEntries(seeds, now);
    assert.ok(materialized.every((entry) => entry.timestamp.endsWith('Z')));
    assert.ok(
      materialized.some((entry) => entry.timestamp.startsWith('2026-09-27')),
    );
    assert.ok(
      materialized.some((entry) => entry.timestamp.startsWith('2026-07')),
    );

    const first = seedCodespacesDemoEntries(db, { now });
    assert.equal(first.skipped, false);
    assert.ok(first.inserted > 0);

    const second = seedCodespacesDemoEntries(db, { now });
    assert.equal(second.skipped, true);
    assert.equal(second.inserted, 0);

    const total = (
      db.prepare('SELECT COUNT(*) AS total FROM energy_entries').get() as {
        total: number;
      }
    ).total;
    assert.equal(total, first.inserted);
  } finally {
    db.close();
  }
});
