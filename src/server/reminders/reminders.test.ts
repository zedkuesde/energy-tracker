import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { buildApp } from '../app.js';
import {
  parseVapidConfig,
  SESSION_COOKIE_NAME,
  VAPID_CONFIG_INCOMPLETE,
  type VapidConfig,
} from '../config.js';
import { createUser } from '../create-user.js';
import {
  loginCookie,
  TEST_FRIEND_EMAIL,
  TEST_FRIEND_PASSWORD,
  TEST_OWNER_EMAIL,
  TEST_PASSWORD,
  testAuthConfig,
  testPasswordHash,
} from '../test-support.js';
import { createReminderScheduler } from './scheduler.js';
import { createReminderStore } from './store.js';
import type { PushSubscriptionRecord } from './store.js';

const vapidKeys = webpush.generateVAPIDKeys();
const testVapid: VapidConfig = {
  publicKey: vapidKeys.publicKey,
  privateKey: vapidKeys.privateKey,
  subject: 'mailto:reminders-test@example.test',
};

describe('parseVapidConfig', () => {
  test('retourne null si tout est vide', () => {
    assert.equal(parseVapidConfig({}), null);
  });

  test('refuse une config partielle', () => {
    assert.throws(
      () =>
        parseVapidConfig({
          VAPID_PUBLIC_KEY: 'x',
          VAPID_PRIVATE_KEY: '',
          VAPID_SUBJECT: '',
        }),
      (error: unknown) =>
        error instanceof Error && error.message === VAPID_CONFIG_INCOMPLETE,
    );
  });

  test('accepte une config complète', () => {
    const parsed = parseVapidConfig({
      VAPID_PUBLIC_KEY: testVapid.publicKey,
      VAPID_PRIVATE_KEY: testVapid.privateKey,
      VAPID_SUBJECT: testVapid.subject,
    });
    assert.deepEqual(parsed, testVapid);
  });
});

describe('API rappels', () => {
  let app: FastifyInstance;
  let cookie: string;

  function inject(opts: Parameters<FastifyInstance['inject']>[0]) {
    return app.inject({
      ...opts,
      cookies: { [SESSION_COOKIE_NAME]: cookie },
    });
  }

  beforeEach(async () => {
    app = await buildApp({
      databasePath: ':memory:',
      applyMigrations: true,
      migration: {
        ownerEmail: TEST_OWNER_EMAIL,
        ownerPasswordHash: await testPasswordHash(),
      },
      logger: false,
      auth: await testAuthConfig(),
      vapid: testVapid,
      startReminderScheduler: false,
    });
    cookie = await loginCookie(app);
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /api/reminders exige une session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/reminders' });
    assert.equal(response.statusCode, 401);
  });

  test('réglages par défaut puis mise à jour', async () => {
    const initial = await inject({ method: 'GET', url: '/api/reminders' });
    assert.equal(initial.statusCode, 200);
    assert.deepEqual(initial.json().data, {
      enabled: false,
      timeHhmm: '20:00',
      timezone: 'Europe/Paris',
      subscriptionCount: 0,
      pushConfigured: true,
      vapidPublicKey: testVapid.publicKey,
      notificationPermissionHint:
        'Les notifications ne sont demandées qu’après une action explicite.',
    });

    const updated = await inject({
      method: 'PUT',
      url: '/api/reminders',
      payload: { enabled: true, timeHhmm: '08:15' },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().data.enabled, true);
    assert.equal(updated.json().data.timeHhmm, '08:15');
  });

  test('refuse une heure invalide', async () => {
    const response = await inject({
      method: 'PUT',
      url: '/api/reminders',
      payload: { enabled: true, timeHhmm: '25:00' },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'validation_error');
  });

  test('abonnement push et isolation entre utilisateurs', async () => {
    await createUser(app.sqlite, {
      email: TEST_FRIEND_EMAIL,
      password: TEST_FRIEND_PASSWORD,
    });

    const ownerEndpoint = 'https://push.example/owner-endpoint';
    const subscribeOwner = await inject({
      method: 'POST',
      url: '/api/reminders/subscribe',
      payload: {
        endpoint: ownerEndpoint,
        keys: { p256dh: 'owner-p256dh', auth: 'owner-auth' },
      },
    });
    assert.equal(subscribeOwner.statusCode, 200);
    assert.equal(subscribeOwner.json().data.subscriptionCount, 1);

    const friendCookie = await loginCookie(app, {
      email: TEST_FRIEND_EMAIL,
      password: TEST_FRIEND_PASSWORD,
    });
    const friendGet = await app.inject({
      method: 'GET',
      url: '/api/reminders',
      cookies: { [SESSION_COOKIE_NAME]: friendCookie },
    });
    assert.equal(friendGet.json().data.subscriptionCount, 0);

    const friendDelete = await app.inject({
      method: 'DELETE',
      url: '/api/reminders/subscribe',
      cookies: { [SESSION_COOKIE_NAME]: friendCookie },
      payload: { endpoint: ownerEndpoint },
    });
    assert.equal(friendDelete.statusCode, 200);
    assert.equal(friendDelete.json().data.removed, false);

    const ownerStill = await inject({ method: 'GET', url: '/api/reminders' });
    assert.equal(ownerStill.json().data.subscriptionCount, 1);

    await inject({
      method: 'PUT',
      url: '/api/reminders',
      payload: { enabled: true, timeHhmm: '07:00' },
    });
    const friendPrefs = await app.inject({
      method: 'PUT',
      url: '/api/reminders',
      cookies: { [SESSION_COOKIE_NAME]: friendCookie },
      payload: { enabled: true, timeHhmm: '21:30' },
    });
    assert.equal(friendPrefs.json().data.timeHhmm, '21:30');

    const ownerPrefs = await inject({ method: 'GET', url: '/api/reminders' });
    assert.equal(ownerPrefs.json().data.timeHhmm, '07:00');
  });

  test('subscribe refuse sans VAPID', async () => {
    const bare = await buildApp({
      databasePath: ':memory:',
      applyMigrations: true,
      migration: {
        ownerEmail: TEST_OWNER_EMAIL,
        ownerPasswordHash: await testPasswordHash(),
      },
      logger: false,
      auth: await testAuthConfig(),
      vapid: null,
      startReminderScheduler: false,
    });
    try {
      const bareCookie = await loginCookie(bare, {
        email: TEST_OWNER_EMAIL,
        password: TEST_PASSWORD,
      });
      const response = await bare.inject({
        method: 'POST',
        url: '/api/reminders/subscribe',
        cookies: { [SESSION_COOKIE_NAME]: bareCookie },
        payload: {
          endpoint: 'https://push.example/x',
          keys: { p256dh: 'a', auth: 'b' },
        },
      });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().error.code, 'push_not_configured');
    } finally {
      await bare.close();
    }
  });
});

describe('planification des rappels', () => {
  test('n’envoie qu’une fois par jour Paris et retire les abonnements invalides', async () => {
    const app = await buildApp({
      databasePath: ':memory:',
      applyMigrations: true,
      migration: {
        ownerEmail: TEST_OWNER_EMAIL,
        ownerPasswordHash: await testPasswordHash(),
      },
      logger: false,
      auth: await testAuthConfig(),
      vapid: testVapid,
      startReminderScheduler: false,
    });

    try {
      const store = createReminderStore(app.sqlite);
      const owner = app.sqlite
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(TEST_OWNER_EMAIL) as { id: string };

      const now = new Date('2026-07-15T18:05:00.000Z');
      store.savePreference(
        owner.id,
        { enabled: true, time_hhmm: '20:00' },
        new Date('2026-07-15T10:00:00.000Z'),
      );
      store.saveSubscription(owner.id, {
        endpoint: 'https://push.example/valid',
        p256dh: 'p',
        auth: 'a',
      });
      store.saveSubscription(owner.id, {
        endpoint: 'https://push.example/gone',
        p256dh: 'p2',
        auth: 'a2',
      });

      const sent: string[] = [];
      const scheduler = createReminderScheduler({
        store,
        enabled: true,
        now: () => now,
        send: async (subscription: PushSubscriptionRecord) => {
          if (subscription.endpoint.endsWith('/gone')) {
            return {
              ok: false,
              invalid: true,
              statusCode: 410,
              message: 'gone',
            };
          }
          sent.push(subscription.endpoint);
          return { ok: true };
        },
      });

      const first = await scheduler.tick();
      assert.equal(first.sentUsers, 1);
      assert.equal(first.removedSubscriptions, 1);
      assert.deepEqual(sent, ['https://push.example/valid']);
      assert.equal(store.subscriptionCount(owner.id), 1);

      sent.length = 0;
      const second = await scheduler.tick();
      assert.equal(second.sentUsers, 0);
      assert.equal(sent.length, 0);

      const nextDay = createReminderScheduler({
        store,
        enabled: true,
        now: () => new Date('2026-07-16T18:05:00.000Z'),
        send: async (subscription) => {
          sent.push(subscription.endpoint);
          return { ok: true };
        },
      });
      const third = await nextDay.tick();
      assert.equal(third.sentUsers, 1);
      assert.deepEqual(sent, ['https://push.example/valid']);
    } finally {
      await app.close();
    }
  });

  test('rattrapage après redémarrage sans double envoi', async () => {
    const app = await buildApp({
      databasePath: ':memory:',
      applyMigrations: true,
      migration: {
        ownerEmail: TEST_OWNER_EMAIL,
        ownerPasswordHash: await testPasswordHash(),
      },
      logger: false,
      auth: await testAuthConfig(),
      vapid: null,
      startReminderScheduler: false,
    });

    try {
      const store = createReminderStore(app.sqlite);
      const owner = app.sqlite
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(TEST_OWNER_EMAIL) as { id: string };

      store.savePreference(
        owner.id,
        { enabled: true, time_hhmm: '09:00' },
        new Date('2026-01-15T07:00:00.000Z'),
      );
      app.sqlite
        .prepare(
          'UPDATE notification_preferences SET last_sent_on = NULL WHERE user_id = ?',
        )
        .run(owner.id);
      store.saveSubscription(owner.id, {
        endpoint: 'https://push.example/restart',
        p256dh: 'p',
        auth: 'a',
      });

      let sends = 0;
      const scheduler = createReminderScheduler({
        store,
        now: () => new Date('2026-01-15T12:00:00.000Z'),
        send: async () => {
          sends += 1;
          return { ok: true };
        },
      });
      assert.equal((await scheduler.tick()).sentUsers, 1);
      assert.equal(sends, 1);
      assert.equal((await scheduler.tick()).sentUsers, 0);
      assert.equal(sends, 1);
    } finally {
      await app.close();
    }
  });
});
