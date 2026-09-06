import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
  AUTH_CONFIG_ERROR,
  parseAuthConfig,
  SESSION_COOKIE_NAME,
} from './config.js';
import {
  createTestApp,
  loginCookie,
  sessionCookieValue,
  TEST_PASSWORD,
} from './test-support.js';

const WRONG_PASSWORD = 'not-the-password';

function cookieHeader(value: string): { cookie: string } {
  return { cookie: `${SESSION_COOKIE_NAME}=${value}` };
}

function assertNoSecretLeak(payload: string): void {
  assert.equal(payload.includes(TEST_PASSWORD), false);
  assert.equal(payload.includes(WRONG_PASSWORD), false);
  assert.equal(payload.includes('$argon2id$'), false);
}

describe('parseAuthConfig', () => {
  test('refuse un hash ou un secret manquant sans révéler de valeur', () => {
    assert.throws(
      () =>
        parseAuthConfig({
          AUTH_PASSWORD_HASH: '',
          AUTH_SESSION_SECRET: 'x'.repeat(32),
        }),
      (error: unknown) =>
        error instanceof Error && error.message === AUTH_CONFIG_ERROR,
    );
  });
});

describe('authentification', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /health reste public', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok' });
  });

  test('login réussi retourne 200, cookie et réponse minimale', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: TEST_PASSWORD },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: { authenticated: true } });
    assert.equal(response.headers['cache-control'], 'no-store');
    assertNoSecretLeak(response.payload);

    const cookie = response.cookies.find(
      (item) => item.name === SESSION_COOKIE_NAME,
    );
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(String(cookie.sameSite).toLowerCase(), 'lax');
    assert.equal(cookie.path, '/');
    assert.notEqual(cookie.secure, true);
    assert.equal(cookie.maxAge, 1_209_600);
  });

  test('login avec mauvais mot de passe retourne 401 neutre', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: WRONG_PASSWORD },
    });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      error: {
        code: 'invalid_credentials',
        message: 'Identifiants invalides.',
      },
    });
    assert.equal(
      response.cookies.some((item) => item.name === SESSION_COOKIE_NAME),
      false,
    );
    assertNoSecretLeak(response.payload);
  });

  test('login body invalide retourne 400', async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });
    const wrongType = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 12 },
    });
    assert.equal(missing.statusCode, 400);
    assert.equal(wrongType.statusCode, 400);
    assert.equal(missing.json().error.code, 'validation_error');
    assertNoSecretLeak(missing.payload);
  });

  test('session valide autorise GET /api/auth/session', async () => {
    const cookie = await loginCookie(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: cookieHeader(cookie),
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: { authenticated: true } });
    assert.equal(response.headers['cache-control'], 'no-store');
  });

  test('requête protégée sans session retourne 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/entries' });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      error: {
        code: 'unauthenticated',
        message: 'Authentification requise.',
      },
    });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal('data' in response.json(), false);
  });

  test('CRUD des entrées est protégé puis fonctionne avec session', async () => {
    const unauthenticated = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/entries',
        payload: { energy: 6, fatigue: 4 },
      }),
      app.inject({ method: 'GET', url: '/api/entries' }),
      app.inject({
        method: 'GET',
        url: '/api/entries/11111111-2222-4333-8444-555555555555',
      }),
      app.inject({
        method: 'PATCH',
        url: '/api/entries/11111111-2222-4333-8444-555555555555',
        payload: { energy: 7 },
      }),
      app.inject({
        method: 'DELETE',
        url: '/api/entries/11111111-2222-4333-8444-555555555555',
      }),
    ]);
    for (const response of unauthenticated) {
      assert.equal(response.statusCode, 401);
      assert.equal('data' in response.json(), false);
    }

    const cookie = await loginCookie(app);
    const headers = cookieHeader(cookie);
    const created = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers,
      payload: { energy: 6, fatigue: 4 },
    });
    assert.equal(created.statusCode, 201);
    const id = created.json().data.id as string;

    const listed = await app.inject({
      method: 'GET',
      url: '/api/entries',
      headers,
    });
    assert.equal(listed.statusCode, 200);

    const one = await app.inject({
      method: 'GET',
      url: `/api/entries/${id}`,
      headers,
    });
    assert.equal(one.statusCode, 200);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      headers,
      payload: { energy: 8 },
    });
    assert.equal(patched.statusCode, 200);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/entries/${id}`,
      headers,
    });
    assert.equal(deleted.statusCode, 204);
  });

  test('logout retourne 204, invalide la session et refuse ensuite les routes protégées', async () => {
    const cookie = await loginCookie(app);
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: cookieHeader(cookie),
    });
    assert.equal(logout.statusCode, 204);
    assert.equal(logout.headers['cache-control'], 'no-store');

    const cleared = logout.cookies.find(
      (item) => item.name === SESSION_COOKIE_NAME,
    );
    assert.ok(cleared);
    assert.equal(cleared.httpOnly, true);
    assert.equal(String(cleared.sameSite).toLowerCase(), 'lax');
    assert.equal(cleared.path, '/');

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: cookieHeader(cookie),
    });
    assert.equal(session.statusCode, 401);

    const entries = await app.inject({
      method: 'GET',
      url: '/api/entries',
      headers: cookieHeader(cookie),
    });
    assert.equal(entries.statusCode, 401);
  });

  test('logout sans session reste idempotent', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });
    assert.equal(response.statusCode, 204);
  });

  test('session expirée est refusée, supprimée et le cookie est effacé', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: TEST_PASSWORD },
    });
    const cookie = sessionCookieValue(login);
    app.sqlite
      .prepare(`UPDATE sessions SET expires_at = ?`)
      .run('2000-01-01T00:00:00.000Z');

    const remaining = app.sqlite
      .prepare(`SELECT COUNT(*) AS total FROM sessions`)
      .get() as { total: number };
    assert.equal(remaining.total, 1);

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: cookieHeader(cookie),
    });
    assert.equal(session.statusCode, 401);
    const cleared = session.cookies.find(
      (item) => item.name === SESSION_COOKIE_NAME,
    );
    assert.ok(cleared);

    const after = app.sqlite
      .prepare(`SELECT COUNT(*) AS total FROM sessions`)
      .get() as { total: number };
    assert.equal(after.total, 0);

    const entries = await app.inject({
      method: 'GET',
      url: '/api/entries',
      headers: cookieHeader(cookie),
    });
    assert.equal(entries.statusCode, 401);
  });

  test('cinq échecs puis 429 sans fuite d’information', async () => {
    for (let index = 0; index < 5; index += 1) {
      const failed = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: WRONG_PASSWORD },
      });
      assert.equal(failed.statusCode, 401);
      assertNoSecretLeak(failed.payload);
    }

    const limited = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: WRONG_PASSWORD },
    });
    assert.equal(limited.statusCode, 429);
    assert.deepEqual(limited.json(), {
      error: {
        code: 'too_many_attempts',
        message: 'Trop de tentatives. Réessaie dans quelques minutes.',
      },
    });
    assertNoSecretLeak(limited.payload);
  });
});

describe('cookie Secure et TTL', () => {
  test('Secure suit AUTH_COOKIE_SECURE', async () => {
    const secureApp = await createTestApp({ cookieSecure: true });
    try {
      const response = await secureApp.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: TEST_PASSWORD },
      });
      const cookie = response.cookies.find(
        (item) => item.name === SESSION_COOKIE_NAME,
      );
      assert.equal(cookie?.secure, true);
    } finally {
      await secureApp.close();
    }
  });

  test('Max-Age suit AUTH_SESSION_TTL_SECONDS', async () => {
    const shortApp = await createTestApp({ sessionTtlSeconds: 60 });
    try {
      const response = await shortApp.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: TEST_PASSWORD },
      });
      const cookie = response.cookies.find(
        (item) => item.name === SESSION_COOKIE_NAME,
      );
      assert.equal(cookie?.maxAge, 60);
    } finally {
      await shortApp.close();
    }
  });
});
