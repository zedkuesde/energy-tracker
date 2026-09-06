import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from '../config.js';
import type { SqliteDatabase } from '../db.js';
import { registerAuthHooks } from './hooks.js';
import { createLoginRateLimiter } from './rate-limit.js';
import { registerAuthRoutes } from './routes.js';
import { createSessionStore } from './sessions.js';

export async function registerAuth(
  app: FastifyInstance,
  db: SqliteDatabase,
  auth: AuthConfig,
): Promise<void> {
  await app.register(cookie, {
    secret: auth.sessionSecret,
  });
  const store = createSessionStore(db);
  const rateLimiter = createLoginRateLimiter();
  registerAuthHooks(app, store, auth);
  registerAuthRoutes(app, store, auth, rateLimiter);
}
