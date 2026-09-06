import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from '../config.js';
import { HttpError } from '../types.js';
import { verifyPassword } from './password.js';
import type { LoginRateLimiter } from './rate-limit.js';
import {
  clearSessionCookie,
  readSignedSessionId,
  resolveActiveSession,
  setSessionCookie,
  UNAUTHENTICATED_BODY,
} from './hooks.js';
import type { SessionStore } from './sessions.js';

const MAX_PASSWORD_LENGTH = 1024;

function parseLoginPassword(body: unknown): string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(
      400,
      'validation_error',
      'Le corps de la requête est invalide.',
    );
  }

  if (!('password' in body) || typeof body.password !== 'string') {
    throw new HttpError(
      400,
      'validation_error',
      'Le corps de la requête est invalide.',
    );
  }

  if (
    body.password.length === 0 ||
    body.password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpError(
      400,
      'validation_error',
      'Le corps de la requête est invalide.',
    );
  }

  return body.password;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  store: SessionStore,
  auth: AuthConfig,
  rateLimiter: LoginRateLimiter,
): void {
  app.post('/api/auth/login', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const ip = request.ip || 'unknown';

    if (rateLimiter.isBlocked(ip)) {
      return reply.status(429).send({
        error: {
          code: 'too_many_attempts',
          message: 'Trop de tentatives. Réessaie dans quelques minutes.',
        },
      });
    }

    const password = parseLoginPassword(request.body);
    const matches = await verifyPassword(auth.passwordHash, password);
    if (!matches) {
      rateLimiter.recordFailure(ip);
      return reply.status(401).send({
        error: {
          code: 'invalid_credentials',
          message: 'Identifiants invalides.',
        },
      });
    }

    rateLimiter.reset(ip);
    store.deleteExpired();
    const session = store.create(auth.sessionTtlSeconds);
    setSessionCookie(reply, auth, session.id);
    return reply.status(200).send({
      data: { authenticated: true },
    });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const sessionId = readSignedSessionId(request);
    if (sessionId) {
      store.delete(sessionId);
    }
    clearSessionCookie(reply, auth);
    return reply.status(204).send();
  });

  app.get('/api/auth/session', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const sessionId = await resolveActiveSession(request, reply, store, auth);
    if (!sessionId) {
      return reply.status(401).send(UNAUTHENTICATED_BODY);
    }
    return reply.status(200).send({
      data: { authenticated: true },
    });
  });
}
