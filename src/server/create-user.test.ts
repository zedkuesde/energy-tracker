import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createUser, CreateUserError } from './create-user.js';
import { openDatabase } from './db.js';
import { runMigrations } from './migrate.js';
import { testPasswordHash } from './test-support.js';
import { verifyPassword } from './auth/password.js';

const OWNER_EMAIL = 'lucas@example.test';
const FRIEND_EMAIL = 'amie@example.test';
const FRIEND_PASSWORD = 'friend-test-only';

describe('createUser', () => {
  let db: ReturnType<typeof openDatabase>;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    runMigrations(db, {
      ownerEmail: OWNER_EMAIL,
      ownerPasswordHash: await testPasswordHash(),
    });
  });

  afterEach(() => {
    db.close();
  });

  test('crée un compte non propriétaire avec un hash Argon2id', async () => {
    await createUser(db, {
      email: '  Amie@Example.TEST  ',
      password: FRIEND_PASSWORD,
    });

    const row = db
      .prepare(
        'SELECT email, password_hash, is_owner FROM users WHERE email = ?',
      )
      .get('amie@example.test') as {
      email: string;
      password_hash: string;
      is_owner: number;
    };
    assert.equal(row.email, 'amie@example.test');
    assert.equal(row.is_owner, 0);
    assert.equal(row.password_hash.startsWith('$argon2id$'), true);
    assert.equal(row.password_hash.includes(FRIEND_PASSWORD), false);
    assert.equal(
      await verifyPassword(row.password_hash, FRIEND_PASSWORD),
      true,
    );

    const owners = db
      .prepare('SELECT COUNT(*) AS total FROM users WHERE is_owner = 1')
      .get() as { total: number };
    assert.equal(owners.total, 1);
  });

  test('refuse un email déjà utilisé sans révéler de hash', async () => {
    await assert.rejects(
      () => createUser(db, { email: OWNER_EMAIL, password: FRIEND_PASSWORD }),
      (error: unknown) =>
        error instanceof CreateUserError &&
        error.message === 'Un compte avec cet email existe déjà.' &&
        !error.message.includes('$argon2id$'),
    );
  });

  test('refuse un email invalide', async () => {
    await assert.rejects(
      () =>
        createUser(db, { email: 'pas-un-email', password: FRIEND_PASSWORD }),
      (error: unknown) =>
        error instanceof CreateUserError && error.message === 'Email invalide.',
    );
  });

  test('refuse un mot de passe trop court', async () => {
    await assert.rejects(
      () => createUser(db, { email: FRIEND_EMAIL, password: 'short-pass' }),
      (error: unknown) =>
        error instanceof CreateUserError &&
        error.message.includes('12') &&
        !error.message.includes('short-pass'),
    );
  });
});
