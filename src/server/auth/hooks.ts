import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_COOKIE_NAME, type AuthConfig } from '../config.js';
import { HttpError } from '../types.js';
import type { SessionStore } from './sessions.js';

export const UNAUTHENTICATED_BODY = {
  error: {
    code: 'unauthenticated',
    message: 'Authentification requise.',
  },
} as const;

export type ActiveSession = {
  id: string;
  userId: string;
};

export function cookieOptions(auth: AuthConfig) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: auth.cookieSecure,
    signed: true,
  };
}

export function setSessionCookie(
  reply: FastifyReply,
  auth: AuthConfig,
  sessionId: string,
): void {
  void reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
    ...cookieOptions(auth),
    maxAge: auth.sessionTtlSeconds,
  });
}

export function clearSessionCookie(
  reply: FastifyReply,
  auth: AuthConfig,
): void {
  void reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions(auth));
}

export function readSignedSessionId(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE_NAME];
  if (!raw) {
    return null;
  }
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) {
    return null;
  }
  return unsigned.value;
}

export function isSessionExpired(expiresAt: string, now = new Date()): boolean {
  return Date.parse(expiresAt) <= now.getTime();
}

export async function resolveActiveSession(
  request: FastifyRequest,
  reply: FastifyReply,
  store: SessionStore,
  auth: AuthConfig,
): Promise<ActiveSession | null> {
  const hasCookie = Boolean(request.cookies[SESSION_COOKIE_NAME]);
  const sessionId = readSignedSessionId(request);

  if (!sessionId) {
    if (hasCookie) {
      clearSessionCookie(reply, auth);
    }
    return null;
  }

  const session = store.find(sessionId);
  if (!session || !session.user_id) {
    clearSessionCookie(reply, auth);
    return null;
  }

  if (isSessionExpired(session.expires_at)) {
    store.delete(session.id);
    clearSessionCookie(reply, auth);
    return null;
  }

  return { id: session.id, userId: session.user_id };
}

export function requireUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new HttpError(401, 'unauthenticated', 'Authentification requise.');
  }
  return request.userId;
}

export function isPublicRoute(url: string, method: string): boolean {
  const path = url.split('?')[0];
  if (path === '/health' && method === 'GET') {
    return true;
  }
  if (path === '/api/auth/login' && method === 'POST') {
    return true;
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return true;
  }
  if (path === '/api/auth/session' && method === 'GET') {
    return true;
  }
  return !path.startsWith('/api/');
}

export function registerAuthHooks(
  app: FastifyInstance,
  store: SessionStore,
  auth: AuthConfig,
): void {
  app.addHook('onRequest', async (request, reply) => {
    if (isPublicRoute(request.url, request.method)) {
      return;
    }

    const session = await resolveActiveSession(request, reply, store, auth);
    if (!session) {
      return reply
        .status(401)
        .header('Cache-Control', 'no-store')
        .send(UNAUTHENTICATED_BODY);
    }

    request.sessionId = session.id;
    request.userId = session.userId;
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.split('?')[0].startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });
}
