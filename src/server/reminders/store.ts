import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../db.js';
import { getParisClock, parseHhmmToMinutes } from './paris-time.js';

export const DEFAULT_REMINDER_TIME = '20:00';

export type NotificationPreference = {
  user_id: string;
  enabled: boolean;
  time_hhmm: string;
  last_sent_on: string | null;
  updated_at: string;
};

export type PushSubscriptionRecord = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  updated_at: string;
};

export type DueReminder = {
  userId: string;
  timeHhmm: string;
  subscriptions: PushSubscriptionRecord[];
};

export function isValidReminderTime(value: string): boolean {
  return parseHhmmToMinutes(value) !== null;
}

export function createReminderStore(db: SqliteDatabase) {
  const selectPreference = db.prepare(`
    SELECT user_id, enabled, time_hhmm, last_sent_on, updated_at
    FROM notification_preferences
    WHERE user_id = ?
  `);

  const upsertPreference = db.prepare(`
    INSERT INTO notification_preferences (
      user_id, enabled, time_hhmm, last_sent_on, updated_at
    ) VALUES (
      @user_id, @enabled, @time_hhmm, @last_sent_on, @updated_at
    )
    ON CONFLICT(user_id) DO UPDATE SET
      enabled = excluded.enabled,
      time_hhmm = excluded.time_hhmm,
      last_sent_on = excluded.last_sent_on,
      updated_at = excluded.updated_at
  `);

  const markSent = db.prepare(`
    UPDATE notification_preferences
    SET last_sent_on = @last_sent_on, updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const selectEnabled = db.prepare(`
    SELECT user_id, enabled, time_hhmm, last_sent_on, updated_at
    FROM notification_preferences
    WHERE enabled = 1
  `);

  const selectSubscriptionsForUser = db.prepare(`
    SELECT id, user_id, endpoint, p256dh, auth, created_at, updated_at
    FROM push_subscriptions
    WHERE user_id = ?
  `);

  const selectSubscriptionByEndpoint = db.prepare(`
    SELECT id, user_id, endpoint, p256dh, auth, created_at, updated_at
    FROM push_subscriptions
    WHERE endpoint = ?
  `);

  const countSubscriptionsForUser = db.prepare(`
    SELECT COUNT(*) AS total FROM push_subscriptions WHERE user_id = ?
  `);

  const upsertSubscription = db.prepare(`
    INSERT INTO push_subscriptions (
      id, user_id, endpoint, p256dh, auth, created_at, updated_at
    ) VALUES (
      @id, @user_id, @endpoint, @p256dh, @auth, @created_at, @updated_at
    )
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = excluded.updated_at
  `);

  const deleteSubscriptionByEndpoint = db.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `);

  const deleteSubscriptionForUser = db.prepare(`
    DELETE FROM push_subscriptions
    WHERE endpoint = @endpoint AND user_id = @user_id
  `);

  const deleteSubscriptionById = db.prepare(`
    DELETE FROM push_subscriptions WHERE id = ?
  `);

  function mapPreference(row: {
    user_id: string;
    enabled: number;
    time_hhmm: string;
    last_sent_on: string | null;
    updated_at: string;
  }): NotificationPreference {
    return {
      user_id: row.user_id,
      enabled: row.enabled === 1,
      time_hhmm: row.time_hhmm,
      last_sent_on: row.last_sent_on,
      updated_at: row.updated_at,
    };
  }

  function getPreference(userId: string): NotificationPreference | null {
    const row = selectPreference.get(userId) as
      | {
          user_id: string;
          enabled: number;
          time_hhmm: string;
          last_sent_on: string | null;
          updated_at: string;
        }
      | undefined;
    return row ? mapPreference(row) : null;
  }

  function getOrDefaultPreference(userId: string): NotificationPreference {
    return (
      getPreference(userId) ?? {
        user_id: userId,
        enabled: false,
        time_hhmm: DEFAULT_REMINDER_TIME,
        last_sent_on: null,
        updated_at: new Date(0).toISOString(),
      }
    );
  }

  function savePreference(
    userId: string,
    input: { enabled: boolean; time_hhmm: string },
    now: Date = new Date(),
  ): NotificationPreference {
    const existing = getPreference(userId);
    const clock = getParisClock(now);
    let lastSentOn = existing?.last_sent_on ?? null;

    // Évite un envoi immédiat le jour où l’utilisateur active un horaire déjà passé.
    if (
      input.enabled &&
      (!existing || !existing.enabled) &&
      parseHhmmToMinutes(input.time_hhmm)! <= clock.minutesOfDay
    ) {
      lastSentOn = clock.date;
    }

    const updatedAt = now.toISOString();
    upsertPreference.run({
      user_id: userId,
      enabled: input.enabled ? 1 : 0,
      time_hhmm: input.time_hhmm,
      last_sent_on: lastSentOn,
      updated_at: updatedAt,
    });

    return getOrDefaultPreference(userId);
  }

  function listDueReminders(now: Date = new Date()): DueReminder[] {
    const clock = getParisClock(now);
    const rows = selectEnabled.all() as Array<{
      user_id: string;
      enabled: number;
      time_hhmm: string;
      last_sent_on: string | null;
      updated_at: string;
    }>;

    const due: DueReminder[] = [];
    for (const row of rows) {
      const preference = mapPreference(row);
      if (
        preference.last_sent_on === clock.date ||
        parseHhmmToMinutes(preference.time_hhmm)! > clock.minutesOfDay
      ) {
        continue;
      }
      const subscriptions = selectSubscriptionsForUser.all(
        preference.user_id,
      ) as PushSubscriptionRecord[];
      if (subscriptions.length === 0) {
        continue;
      }
      due.push({
        userId: preference.user_id,
        timeHhmm: preference.time_hhmm,
        subscriptions,
      });
    }
    return due;
  }

  function markReminderSent(userId: string, now: Date = new Date()): void {
    const clock = getParisClock(now);
    markSent.run({
      user_id: userId,
      last_sent_on: clock.date,
      updated_at: now.toISOString(),
    });
  }

  function saveSubscription(
    userId: string,
    input: { endpoint: string; p256dh: string; auth: string },
    now: Date = new Date(),
  ): PushSubscriptionRecord {
    const existing = selectSubscriptionByEndpoint.get(input.endpoint) as
      PushSubscriptionRecord | undefined;
    const id = existing?.id ?? randomUUID();
    const createdAt = existing?.created_at ?? now.toISOString();
    const updatedAt = now.toISOString();
    upsertSubscription.run({
      id,
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      created_at: createdAt,
      updated_at: updatedAt,
    });
    return selectSubscriptionByEndpoint.get(
      input.endpoint,
    ) as PushSubscriptionRecord;
  }

  function removeSubscriptionByEndpoint(endpoint: string): boolean {
    const result = deleteSubscriptionByEndpoint.run(endpoint);
    return result.changes > 0;
  }

  function removeSubscriptionForUser(
    userId: string,
    endpoint: string,
  ): boolean {
    const result = deleteSubscriptionForUser.run({
      user_id: userId,
      endpoint,
    });
    return result.changes > 0;
  }

  function removeSubscriptionById(id: string): void {
    deleteSubscriptionById.run(id);
  }

  function subscriptionCount(userId: string): number {
    const row = countSubscriptionsForUser.get(userId) as { total: number };
    return row.total;
  }

  return {
    getPreference,
    getOrDefaultPreference,
    savePreference,
    listDueReminders,
    markReminderSent,
    saveSubscription,
    removeSubscriptionByEndpoint,
    removeSubscriptionForUser,
    removeSubscriptionById,
    subscriptionCount,
  };
}

export type ReminderStore = ReturnType<typeof createReminderStore>;
