import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createUser } from './create-user.js';
import { SESSION_COOKIE_NAME } from './config.js';
import {
  createTestApp,
  loginCookie,
  TEST_FRIEND_EMAIL,
  TEST_FRIEND_PASSWORD,
  TEST_OWNER_EMAIL,
} from './test-support.js';

const MISSING_ID = '11111111-2222-4333-8444-555555555555';
const NOT_FOUND = {
  error: {
    code: 'not_found',
    message: 'Entrée introuvable.',
  },
};

describe('isolation des entrées par utilisateur', () => {
  let app: FastifyInstance;
  let ownerCookie: string;
  let friendCookie: string;

  function headers(cookie: string) {
    return { cookie: `${SESSION_COOKIE_NAME}=${cookie}` };
  }

  beforeEach(async () => {
    app = await createTestApp();
    await createUser(app.sqlite, {
      email: TEST_FRIEND_EMAIL,
      password: TEST_FRIEND_PASSWORD,
    });
    ownerCookie = await loginCookie(app);
    friendCookie = await loginCookie(app, {
      email: TEST_FRIEND_EMAIL,
      password: TEST_FRIEND_PASSWORD,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('chaque utilisateur ne voit que ses propres entrées', async () => {
    const ownerCreated = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: headers(ownerCookie),
      payload: { energy: 6, fatigue: 4, context: 'lucas' },
    });
    const friendCreated = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: headers(friendCookie),
      payload: { energy: 8, fatigue: 2, context: 'amie' },
    });
    assert.equal(ownerCreated.statusCode, 201);
    assert.equal(friendCreated.statusCode, 201);
    assert.equal('user_id' in ownerCreated.json().data, false);
    assert.equal('userId' in ownerCreated.json().data, false);

    const ownerList = await app.inject({
      method: 'GET',
      url: '/api/entries',
      headers: headers(ownerCookie),
    });
    const friendList = await app.inject({
      method: 'GET',
      url: '/api/entries',
      headers: headers(friendCookie),
    });
    assert.equal(ownerList.statusCode, 200);
    assert.equal(friendList.statusCode, 200);
    assert.equal(ownerList.json().pagination.total, 1);
    assert.equal(friendList.json().pagination.total, 1);
    assert.deepEqual(
      ownerList.json().data.map((entry: { context: string }) => entry.context),
      ['lucas'],
    );
    assert.deepEqual(
      friendList.json().data.map((entry: { context: string }) => entry.context),
      ['amie'],
    );
  });

  test('GET PATCH DELETE d’une entrée d’un autre compte renvoient le même 404', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: headers(ownerCookie),
      payload: { energy: 6, fatigue: 4 },
    });
    const ownerId = created.json().data.id as string;

    const foreignGet = await app.inject({
      method: 'GET',
      url: `/api/entries/${ownerId}`,
      headers: headers(friendCookie),
    });
    const missingGet = await app.inject({
      method: 'GET',
      url: `/api/entries/${MISSING_ID}`,
      headers: headers(friendCookie),
    });
    assert.equal(foreignGet.statusCode, 404);
    assert.deepEqual(foreignGet.json(), NOT_FOUND);
    assert.deepEqual(foreignGet.json(), missingGet.json());

    const foreignPatch = await app.inject({
      method: 'PATCH',
      url: `/api/entries/${ownerId}`,
      headers: headers(friendCookie),
      payload: { energy: 1 },
    });
    const missingPatch = await app.inject({
      method: 'PATCH',
      url: `/api/entries/${MISSING_ID}`,
      headers: headers(friendCookie),
      payload: { energy: 1 },
    });
    assert.equal(foreignPatch.statusCode, 404);
    assert.deepEqual(foreignPatch.json(), NOT_FOUND);
    assert.deepEqual(foreignPatch.json(), missingPatch.json());

    const foreignDelete = await app.inject({
      method: 'DELETE',
      url: `/api/entries/${ownerId}`,
      headers: headers(friendCookie),
    });
    const missingDelete = await app.inject({
      method: 'DELETE',
      url: `/api/entries/${MISSING_ID}`,
      headers: headers(friendCookie),
    });
    assert.equal(foreignDelete.statusCode, 404);
    assert.deepEqual(foreignDelete.json(), NOT_FOUND);
    assert.deepEqual(foreignDelete.json(), missingDelete.json());

    const stillThere = await app.inject({
      method: 'GET',
      url: `/api/entries/${ownerId}`,
      headers: headers(ownerCookie),
    });
    assert.equal(stillThere.statusCode, 200);
    assert.equal(stillThere.json().data.energy, 6);
  });

  test('POST refuse un userId ou user_id fourni par le client', async () => {
    const friend = app.sqlite
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(TEST_FRIEND_EMAIL) as { id: string };
    const owner = app.sqlite
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(TEST_OWNER_EMAIL) as { id: string };

    const withUserId = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: headers(ownerCookie),
      payload: { energy: 6, fatigue: 4, userId: friend.id },
    });
    const withUserUnderscore = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: headers(ownerCookie),
      payload: { energy: 6, fatigue: 4, user_id: friend.id },
    });
    assert.equal(withUserId.statusCode, 400);
    assert.equal(withUserUnderscore.statusCode, 400);
    assert.equal(withUserId.json().error.code, 'validation_error');

    const created = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: headers(ownerCookie),
      payload: { energy: 7, fatigue: 3 },
    });
    assert.equal(created.statusCode, 201);
    const stored = app.sqlite
      .prepare('SELECT user_id FROM energy_entries WHERE id = ?')
      .get(created.json().data.id) as { user_id: string };
    assert.equal(stored.user_id, owner.id);
    assert.notEqual(stored.user_id, friend.id);
  });
});
