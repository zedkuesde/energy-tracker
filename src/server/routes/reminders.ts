import type { FastifyInstance } from 'fastify';
import { requireUserId } from '../auth/hooks.js';
import type { VapidConfig } from '../config.js';
import type { SqliteDatabase } from '../db.js';
import { HttpError } from '../types.js';
import { configureWebPush } from '../reminders/push.js';
import {
  createReminderStore,
  isValidReminderTime,
} from '../reminders/store.js';

type PreferenceBody = {
  enabled?: unknown;
  timeHhmm?: unknown;
  lowEnergyEnabled?: unknown;
  absenceEnabled?: unknown;
};

type SubscribeBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function parsePreferenceBody(body: unknown): {
  enabled: boolean;
  time_hhmm: string;
  low_energy_enabled: boolean;
  absence_enabled: boolean;
} {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'validation_error', 'Corps de requête invalide.');
  }
  const payload = body as PreferenceBody;
  if (typeof payload.enabled !== 'boolean') {
    throw new HttpError(
      400,
      'validation_error',
      'Le champ enabled doit être un booléen.',
    );
  }
  if (typeof payload.timeHhmm !== 'string') {
    throw new HttpError(
      400,
      'validation_error',
      'Le champ timeHhmm doit être une heure HH:MM.',
    );
  }
  if (typeof payload.lowEnergyEnabled !== 'boolean') {
    throw new HttpError(
      400,
      'validation_error',
      'Le champ lowEnergyEnabled doit être un booléen.',
    );
  }
  if (typeof payload.absenceEnabled !== 'boolean') {
    throw new HttpError(
      400,
      'validation_error',
      'Le champ absenceEnabled doit être un booléen.',
    );
  }
  const timeHhmm = payload.timeHhmm.trim();
  if (!isValidReminderTime(timeHhmm)) {
    throw new HttpError(
      400,
      'validation_error',
      'L’heure doit être au format HH:MM (00:00–23:59), fuseau Europe/Paris.',
    );
  }
  return {
    enabled: payload.enabled,
    time_hhmm: timeHhmm,
    low_energy_enabled: payload.lowEnergyEnabled,
    absence_enabled: payload.absenceEnabled,
  };
}

function parseSubscribeBody(body: unknown): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'validation_error', 'Corps de requête invalide.');
  }
  const payload = body as SubscribeBody;
  const endpoint =
    typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const p256dh =
    typeof payload.keys?.p256dh === 'string' ? payload.keys.p256dh.trim() : '';
  const auth =
    typeof payload.keys?.auth === 'string' ? payload.keys.auth.trim() : '';

  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    throw new HttpError(
      400,
      'validation_error',
      'Abonnement push invalide (endpoint HTTPS et clés requis).',
    );
  }
  if (endpoint.length > 2048 || p256dh.length > 512 || auth.length > 512) {
    throw new HttpError(
      400,
      'validation_error',
      'Abonnement push trop volumineux.',
    );
  }
  return { endpoint, p256dh, auth };
}

function preferenceResponse(
  preference: ReturnType<
    ReturnType<typeof createReminderStore>['getOrDefaultPreference']
  >,
  store: ReturnType<typeof createReminderStore>,
  vapid: VapidConfig | null,
) {
  return {
    enabled: preference.enabled,
    timeHhmm: preference.time_hhmm,
    lowEnergyEnabled: preference.low_energy_enabled,
    absenceEnabled: preference.absence_enabled,
    timezone: 'Europe/Paris',
    subscriptionCount: store.subscriptionCount(preference.user_id),
    pushConfigured: Boolean(vapid),
    vapidPublicKey: vapid?.publicKey ?? null,
  };
}

export function registerReminderRoutes(
  app: FastifyInstance,
  db: SqliteDatabase,
  vapid: VapidConfig | null,
): void {
  const store = createReminderStore(db);
  if (vapid) {
    configureWebPush(vapid);
  }

  app.get('/api/reminders', async (request) => {
    const userId = requireUserId(request);
    const preference = store.getOrDefaultPreference(userId);
    return {
      data: {
        ...preferenceResponse(preference, store, vapid),
        notificationPermissionHint:
          'Les notifications ne sont demandées qu’après une action explicite.',
      },
    };
  });

  app.put('/api/reminders', async (request) => {
    const userId = requireUserId(request);
    const input = parsePreferenceBody(request.body);
    const preference = store.savePreference(userId, input);
    return {
      data: preferenceResponse(preference, store, vapid),
    };
  });

  app.post('/api/reminders/subscribe', async (request) => {
    const userId = requireUserId(request);
    if (!vapid) {
      throw new HttpError(
        503,
        'push_not_configured',
        'Les notifications push ne sont pas configurées sur ce serveur.',
      );
    }
    const input = parseSubscribeBody(request.body);
    const subscription = store.saveSubscription(userId, input);
    return {
      data: {
        id: subscription.id,
        endpoint: subscription.endpoint,
        subscriptionCount: store.subscriptionCount(userId),
      },
    };
  });

  app.delete('/api/reminders/subscribe', async (request) => {
    const userId = requireUserId(request);
    const body = request.body as { endpoint?: unknown } | undefined;
    const endpoint =
      typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
    if (!endpoint) {
      throw new HttpError(
        400,
        'validation_error',
        'Le champ endpoint est requis.',
      );
    }
    const removed = store.removeSubscriptionForUser(userId, endpoint);
    return {
      data: {
        removed,
        subscriptionCount: store.subscriptionCount(userId),
      },
    };
  });
}
