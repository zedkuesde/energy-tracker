import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import {
  ABSENCE_NOTIFICATION,
  LOW_ENERGY_NOTIFICATION,
  REMINDER_NOTIFICATION,
  type PushSendOptions,
  type ReminderPayload,
} from './push.js';
import { parisDateTimeToUtc } from './low-energy-followup.js';
import { createReminderScheduler } from './scheduler.js';
import {
  createReminderStore,
  type PushSubscriptionRecord,
} from './store.js';
import {
  TEST_OWNER_EMAIL,
  testAuthConfig,
  testPasswordHash,
} from '../test-support.js';

function paris(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return parisDateTimeToUtc(date, h * 60 + m);
}

async function buildTestApp(): Promise<FastifyInstance> {
  return buildApp({
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
}

function ownerId(app: FastifyInstance): string {
  return (
    app.sqlite
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(TEST_OWNER_EMAIL) as { id: string }
  ).id;
}

function insertEntry(
  app: FastifyInstance,
  userId: string,
  entry: {
    id: string;
    timestamp: string;
    energy: number;
    created_at?: string;
  },
): void {
  const created = entry.created_at ?? entry.timestamp;
  app.sqlite
    .prepare(
      `INSERT INTO energy_entries (
        id, user_id, timestamp, energy, fatigue, desire, context, activity,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 5, NULL, NULL, NULL, ?, ?)`,
    )
    .run(entry.id, userId, entry.timestamp, entry.energy, created, created);
}

describe('rappels intelligents V2', () => {
  test('TTL 900 pour smarts, aucun TTL pour le fixe', async () => {
    const app = await buildTestApp();
    try {
      const store = createReminderStore(app.sqlite);
      const uid = ownerId(app);
      store.savePreference(
        uid,
        {
          enabled: true,
          time_hhmm: '19:00',
          low_energy_enabled: true,
          absence_enabled: true,
        },
        paris('2026-07-15', '10:00'),
      );
      app.sqlite
        .prepare(
          'UPDATE notification_preferences SET last_sent_on = NULL, absence_last_sent_on = NULL WHERE user_id = ?',
        )
        .run(uid);
      store.saveSubscription(uid, {
        endpoint: 'https://push.example/ttl',
        p256dh: 'p',
        auth: 'a',
      });

      // Absence only at 19:00 — check TTL
      const smartOpts: Array<PushSendOptions | undefined> = [];
      const smartPayloads: ReminderPayload[] = [];
      const absenceScheduler = createReminderScheduler({
        store,
        now: () => paris('2026-07-15', '19:00'),
        send: async (_sub, payload, options) => {
          smartOpts.push(options);
          if (payload) {
            smartPayloads.push(payload);
          }
          return { ok: true };
        },
      });
      assert.equal((await absenceScheduler.tick()).sentUsers, 1);
      assert.deepEqual(smartOpts[0], { TTL: 900 });
      assert.equal(smartPayloads[0]?.title, ABSENCE_NOTIFICATION.title);

      // Fixed only next day — no TTL option
      store.savePreference(
        uid,
        {
          enabled: true,
          time_hhmm: '09:00',
          low_energy_enabled: false,
          absence_enabled: false,
        },
        paris('2026-07-16', '08:00'),
      );
      app.sqlite
        .prepare(
          'UPDATE notification_preferences SET last_sent_on = NULL WHERE user_id = ?',
        )
        .run(uid);
      const fixedOpts: Array<PushSendOptions | undefined> = [];
      const fixedPayloads: ReminderPayload[] = [];
      const fixedScheduler = createReminderScheduler({
        store,
        now: () => paris('2026-07-16', '09:05'),
        send: async (_sub, payload, options) => {
          fixedOpts.push(options);
          if (payload) {
            fixedPayloads.push(payload);
          }
          return { ok: true };
        },
      });
      assert.equal((await fixedScheduler.tick()).sentUsers, 1);
      assert.equal(fixedOpts[0], undefined);
      assert.equal(fixedPayloads[0]?.title, REMINDER_NOTIFICATION.title);
    } finally {
      await app.close();
    }
  });

  test('relance basse énergie : bornes fenêtre et rétroactif sans pending', async () => {
    const app = await buildTestApp();
    try {
      const store = createReminderStore(app.sqlite);
      const uid = ownerId(app);
      store.savePreference(
        uid,
        {
          enabled: false,
          time_hhmm: '20:00',
          low_energy_enabled: true,
          absence_enabled: false,
        },
        paris('2026-07-15', '10:00'),
      );
      store.saveSubscription(uid, {
        endpoint: 'https://push.example/low',
        p256dh: 'p',
        auth: 'a',
      });

      const entryTs = paris('2026-07-15', '16:00');
      insertEntry(app, uid, {
        id: 'e-low',
        timestamp: entryTs.toISOString(),
        energy: 3,
      });
      // Schedule as if "now" is still morning after entry — fire_at 17:30 is future
      store.syncLowEnergyAfterMutation(
        uid,
        {
          id: 'e-low',
          timestamp: entryTs.toISOString(),
          energy: 3,
          created_at: entryTs.toISOString(),
        },
        paris('2026-07-15', '16:05'),
      );
      const pref = store.getPreference(uid)!;
      assert.ok(pref.pending_low_energy_fire_at);
      assert.equal(pref.pending_low_energy_entry_id, 'e-low');

      let sends = 0;
      let title = '';
      const atFire = createReminderScheduler({
        store,
        now: () => paris('2026-07-15', '17:30'),
        send: async (_s, payload) => {
          sends += 1;
          title = payload?.title ?? '';
          return { ok: true };
        },
      });
      assert.equal((await atFire.tick()).sentUsers, 1);
      assert.equal(sends, 1);
      assert.equal(title, LOW_ENERGY_NOTIFICATION.title);
      assert.equal(store.getPreference(uid)!.pending_low_energy_fire_at, null);

      // Retroactive: fire_at already past → no pending
      insertEntry(app, uid, {
        id: 'e-retro',
        timestamp: paris('2026-07-15', '10:00').toISOString(),
        energy: 2,
        created_at: paris('2026-07-15', '18:00').toISOString(),
      });
      store.syncLowEnergyAfterMutation(
        uid,
        {
          id: 'e-retro',
          timestamp: paris('2026-07-15', '10:00').toISOString(),
          energy: 2,
          created_at: paris('2026-07-15', '18:00').toISOString(),
        },
        paris('2026-07-15', '18:00'),
      );
      // e-retro is older timestamp than nothing pending; latest by timestamp is e-low (16:00) > 10:00
      // Actually latest is e-low at 16:00 with energy 3 — but pending was cleared after send.
      // Re-eval from latest e-low: fire_at 17:30 <= now 18:00 → no pending
      assert.equal(store.getPreference(uid)!.pending_low_energy_fire_at, null);

      // Past grace: set pending manually then tick after +15min
      store.setPendingLowEnergy(
        uid,
        'e-low',
        paris('2026-07-15', '17:30').toISOString(),
        paris('2026-07-15', '17:30'),
      );
      const afterGrace = createReminderScheduler({
        store,
        now: () =>
          new Date(paris('2026-07-15', '17:30').getTime() + 15 * 60 * 1000 + 1),
        send: async () => {
          sends += 1;
          return { ok: true };
        },
      });
      const before = sends;
      assert.equal((await afterGrace.tick()).sentUsers, 0);
      assert.equal(sends, before);
      assert.equal(store.getPreference(uid)!.pending_low_energy_fire_at, null);
    } finally {
      await app.close();
    }
  });

  test('DELETE : réévalu dernière saisie toutes notes', async () => {
    const app = await buildTestApp();
    try {
      const store = createReminderStore(app.sqlite);
      const uid = ownerId(app);
      store.savePreference(
        uid,
        {
          enabled: false,
          time_hhmm: '20:00',
          low_energy_enabled: true,
          absence_enabled: false,
        },
        paris('2026-07-15', '10:00'),
      );

      insertEntry(app, uid, {
        id: 'low1',
        timestamp: paris('2026-07-15', '12:00').toISOString(),
        energy: 2,
      });
      insertEntry(app, uid, {
        id: 'high2',
        timestamp: paris('2026-07-15', '14:00').toISOString(),
        energy: 7,
      });
      store.syncLowEnergyAfterMutation(
        uid,
        {
          id: 'high2',
          timestamp: paris('2026-07-15', '14:00').toISOString(),
          energy: 7,
          created_at: paris('2026-07-15', '14:00').toISOString(),
        },
        paris('2026-07-15', '14:01'),
      );
      assert.equal(store.getPreference(uid)!.pending_low_energy_fire_at, null);

      // Pending from low1 then delete high2 → latest is low1, schedule if fire future
      store.syncLowEnergyAfterMutation(
        uid,
        {
          id: 'low1',
          timestamp: paris('2026-07-15', '12:00').toISOString(),
          energy: 2,
          created_at: paris('2026-07-15', '12:00').toISOString(),
        },
        paris('2026-07-15', '12:05'),
      );
      assert.ok(store.getPreference(uid)!.pending_low_energy_fire_at);

      app.sqlite
        .prepare('DELETE FROM energy_entries WHERE id = ?')
        .run('low1');
      insertEntry(app, uid, {
        id: 'high-only',
        timestamp: paris('2026-07-15', '15:00').toISOString(),
        energy: 8,
      });
      store.syncLowEnergyAfterMutation(uid, null, paris('2026-07-15', '15:01'));
      assert.equal(store.getPreference(uid)!.pending_low_energy_fire_at, null);
    } finally {
      await app.close();
    }
  });

  test('collision absence > fixe : un send, marks après delivered seulement', async () => {
    const app = await buildTestApp();
    try {
      const store = createReminderStore(app.sqlite);
      const uid = ownerId(app);
      store.savePreference(
        uid,
        {
          enabled: true,
          time_hhmm: '19:00',
          low_energy_enabled: false,
          absence_enabled: true,
        },
        paris('2026-07-15', '10:00'),
      );
      app.sqlite
        .prepare(
          'UPDATE notification_preferences SET last_sent_on = NULL, absence_last_sent_on = NULL WHERE user_id = ?',
        )
        .run(uid);
      store.saveSubscription(uid, {
        endpoint: 'https://push.example/collision',
        p256dh: 'p',
        auth: 'a',
      });

      const payloads: string[] = [];
      const failScheduler = createReminderScheduler({
        store,
        now: () => paris('2026-07-15', '19:00'),
        send: async (_s, payload) => {
          payloads.push(payload?.title ?? '');
          return { ok: false, invalid: false, message: 'fail' };
        },
      });
      assert.equal((await failScheduler.tick()).sentUsers, 0);
      assert.deepEqual(payloads, [ABSENCE_NOTIFICATION.title]);
      assert.equal(store.getPreference(uid)!.last_sent_on, null);
      assert.equal(store.getPreference(uid)!.absence_last_sent_on, null);

      payloads.length = 0;
      const okScheduler = createReminderScheduler({
        store,
        now: () => paris('2026-07-15', '19:00'),
        send: async (_s, payload) => {
          payloads.push(payload?.title ?? '');
          return { ok: true };
        },
      });
      assert.equal((await okScheduler.tick()).sentUsers, 1);
      assert.deepEqual(payloads, [ABSENCE_NOTIFICATION.title]);
      const after = store.getPreference(uid)!;
      assert.equal(after.absence_last_sent_on, '2026-07-15');
      assert.equal(after.last_sent_on, '2026-07-15');

      payloads.length = 0;
      assert.equal((await okScheduler.tick()).sentUsers, 0);
      assert.equal(payloads.length, 0);
    } finally {
      await app.close();
    }
  });

  test('saisie du jour bloque l’absence', async () => {
    const app = await buildTestApp();
    try {
      const store = createReminderStore(app.sqlite);
      const uid = ownerId(app);
      store.savePreference(
        uid,
        {
          enabled: false,
          time_hhmm: '20:00',
          low_energy_enabled: false,
          absence_enabled: true,
        },
        paris('2026-07-15', '10:00'),
      );
      store.saveSubscription(uid, {
        endpoint: 'https://push.example/abs',
        p256dh: 'p',
        auth: 'a',
      });
      insertEntry(app, uid, {
        id: 'any',
        timestamp: paris('2026-07-15', '12:00').toISOString(),
        energy: 8,
      });
      let sends = 0;
      const scheduler = createReminderScheduler({
        store,
        now: () => paris('2026-07-15', '19:00'),
        send: async () => {
          sends += 1;
          return { ok: true };
        },
      });
      assert.equal((await scheduler.tick()).sentUsers, 0);
      assert.equal(sends, 0);
    } finally {
      await app.close();
    }
  });

  test('rétroactif plus ancien n’annule pas une relance valide', async () => {
    const app = await buildTestApp();
    try {
      const store = createReminderStore(app.sqlite);
      const uid = ownerId(app);
      store.savePreference(
        uid,
        {
          enabled: false,
          time_hhmm: '20:00',
          low_energy_enabled: true,
          absence_enabled: false,
        },
        paris('2026-07-15', '10:00'),
      );
      insertEntry(app, uid, {
        id: 'recent-low',
        timestamp: paris('2026-07-15', '16:00').toISOString(),
        energy: 3,
      });
      store.syncLowEnergyAfterMutation(
        uid,
        {
          id: 'recent-low',
          timestamp: paris('2026-07-15', '16:00').toISOString(),
          energy: 3,
          created_at: paris('2026-07-15', '16:00').toISOString(),
        },
        paris('2026-07-15', '16:05'),
      );
      const pending = store.getPreference(uid)!.pending_low_energy_fire_at;
      assert.ok(pending);

      insertEntry(app, uid, {
        id: 'older-high',
        timestamp: paris('2026-07-15', '09:00').toISOString(),
        energy: 9,
        created_at: paris('2026-07-15', '16:10').toISOString(),
      });
      store.syncLowEnergyAfterMutation(
        uid,
        {
          id: 'older-high',
          timestamp: paris('2026-07-15', '09:00').toISOString(),
          energy: 9,
          created_at: paris('2026-07-15', '16:10').toISOString(),
        },
        paris('2026-07-15', '16:10'),
      );
      assert.equal(
        store.getPreference(uid)!.pending_low_energy_fire_at,
        pending,
      );
    } finally {
      await app.close();
    }
  });
});

// Silence unused import in case of tree-shake noise
void (null as unknown as PushSubscriptionRecord);
