import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { AuthConfig } from './config.js';
import { SESSION_COOKIE_NAME } from './config.js';

export const TEST_PASSWORD = 'local-test-only';

let cachedHash: string | undefined;

export async function testPasswordHash(): Promise<string> {
  cachedHash ??= await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  return cachedHash;
}

export async function testAuthConfig(
  overrides: Partial<AuthConfig> = {},
): Promise<AuthConfig> {
  return {
    passwordHash: await testPasswordHash(),
    sessionSecret: randomBytes(32).toString('hex'),
    cookieSecure: false,
    sessionTtlSeconds: 1_209_600,
    trustProxy: false,
    ...overrides,
  };
}

export async function createTestApp(
  overrides: Partial<AuthConfig> = {},
): Promise<FastifyInstance> {
  return buildApp({
    databasePath: ':memory:',
    applyMigrations: true,
    logger: false,
    auth: await testAuthConfig(overrides),
  });
}

export function sessionCookieValue(response: {
  cookies: Array<{ name: string; value: string }>;
}): string {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME,
  );
  if (!cookie) {
    throw new Error('Cookie de session absent.');
  }
  return cookie.value;
}

export async function loginCookie(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { password: TEST_PASSWORD },
  });
  if (response.statusCode !== 200) {
    throw new Error(`Login de test échoué (${response.statusCode}).`);
  }
  return sessionCookieValue(response);
}
