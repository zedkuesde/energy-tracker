import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../db.js';
import {
  computeLowEnergyFollowUpAt,
  isAbsenceInWindow,
  isEntryMoreRecentThan,
  isLowEnergyFollowUpInWindow,
} from './low-energy-followup.js';
import { getParisClock, parseHhmmToMinutes } from './paris-time.js';

export const DEFAULT_REMINDER_TIME = '20:00';

export type NotificationPreference = {
  user_id: string;
  enabled: boolean;
  time_hhmm: string;
  last_sent_on: string | null;
  low_energy_enabled: boolean;
  absence_enabled: boolean;
  pending_low_energy_fire_at: string | null;
  pending_low_energy_entry_id: string | null;
  absence_last_sent_on: string | null;
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

export type ReminderKind = 'low_energy' | 'absence' | 'fixed';

export type DueReminder = {
  userId: string;
  kind: ReminderKind;
  timeHhmm: string;
  subscriptions: PushSubscriptionRecord[];
};

type PreferenceRow = {
  user_id: string;
  enabled: number;
  time_hhmm: string;
  last_sent_on: string | null;
  low_energy_enabled: number;
  absence_enabled: number;
  pending_low_energy_fire_at: string | null;
  pending_low_energy_entry_id: string | null;
  absence_last_sent_on: string | null;
  updated_at: string;
};

type EntryRecencyRow = {
  id: string;
  timestamp: string;
  energy: number;
  created_at: string;
};

export function isValidReminderTime(value: string): boolean {
  return parseHhmmToMinutes(value) !== null;
}

export function createReminderStore(db: SqliteDatabase) {
  const selectPreference = db.prepare(`
    SELECT user_id, enabled, time_hhmm, last_sent_on,
           low_energy_enabled, absence_enabled,
           pending_low_energy_fire_at, pending_low_energy_entry_id,
           absence_last_sent_on, updated_at
    FROM notification_preferences
    WHERE user_id = ?
  `);

  const upsertPreference = db.prepare(`
    INSERT INTO notification_preferences (
      user_id, enabled, time_hhmm, last_sent_on,
      low_energy_enabled, absence_enabled,
      pending_low_energy_fire_at, pending_low_energy_entry_id,
      absence_last_sent_on, updated_at
    ) VALUES (
      @user_id, @enabled, @time_hhmm, @last_sent_on,
      @low_energy_enabled, @absence_enabled,
      @pending_low_energy_fire_at, @pending_low_energy_entry_id,
      @absence_last_sent_on, @updated_at
    )
    ON CONFLICT(user_id) DO UPDATE SET
      enabled = excluded.enabled,
      time_hhmm = excluded.time_hhmm,
      last_sent_on = excluded.last_sent_on,
      low_energy_enabled = excluded.low_energy_enabled,
      absence_enabled = excluded.absence_enabled,
      pending_low_energy_fire_at = excluded.pending_low_energy_fire_at,
      pending_low_energy_entry_id = excluded.pending_low_energy_entry_id,
      absence_last_sent_on = excluded.absence_last_sent_on,
      updated_at = excluded.updated_at
  `);

  const markFixedSent = db.prepare(`
    UPDATE notification_preferences
    SET last_sent_on = @last_sent_on, updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const markAbsenceSentSql = db.prepare(`
    UPDATE notification_preferences
    SET absence_last_sent_on = @absence_last_sent_on, updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const clearPendingSql = db.prepare(`
    UPDATE notification_preferences
    SET pending_low_energy_fire_at = NULL,
        pending_low_energy_entry_id = NULL,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const setPendingSql = db.prepare(`
    UPDATE notification_preferences
    SET pending_low_energy_fire_at = @pending_low_energy_fire_at,
        pending_low_energy_entry_id = @pending_low_energy_entry_id,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const ensurePreferenceRow = db.prepare(`
    INSERT INTO notification_preferences (
      user_id, enabled, time_hhmm, last_sent_on,
      low_energy_enabled, absence_enabled,
      pending_low_energy_fire_at, pending_low_energy_entry_id,
      absence_last_sent_on, updated_at
    ) VALUES (
      @user_id, 0, @time_hhmm, NULL,
      0, 0, NULL, NULL, NULL, @updated_at
    )
    ON CONFLICT(user_id) DO NOTHING
  `);

  const selectEnabledFixed = db.prepare(`
    SELECT user_id, enabled, time_hhmm, last_sent_on,
           low_energy_enabled, absence_enabled,
           pending_low_energy_fire_at, pending_low_energy_entry_id,
           absence_last_sent_on, updated_at
    FROM notification_preferences
    WHERE enabled = 1
  `);

  const selectSmartCandidates = db.prepare(`
    SELECT user_id, enabled, time_hhmm, last_sent_on,
           low_energy_enabled, absence_enabled,
           pending_low_energy_fire_at, pending_low_energy_entry_id,
           absence_last_sent_on, updated_at
    FROM notification_preferences
    WHERE low_energy_enabled = 1 OR absence_enabled = 1
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

  const selectEntryById = db.prepare(`
    SELECT id, timestamp, energy, created_at
    FROM energy_entries
    WHERE id = @id AND user_id = @user_id
  `);

  const selectLatestEntry = db.prepare(`
    SELECT id, timestamp, energy, created_at
    FROM energy_entries
    WHERE user_id = ?
    ORDER BY timestamp DESC, created_at DESC, id DESC
    LIMIT 1
  `);

  const selectEntriesForUser = db.prepare(`
    SELECT id, timestamp, energy, created_at
    FROM energy_entries
    WHERE user_id = ?
  `);

  function mapPreference(row: PreferenceRow): NotificationPreference {
    return {
      user_id: row.user_id,
      enabled: row.enabled === 1,
      time_hhmm: row.time_hhmm,
      last_sent_on: row.last_sent_on,
      low_energy_enabled: row.low_energy_enabled === 1,
      absence_enabled: row.absence_enabled === 1,
      pending_low_energy_fire_at: row.pending_low_energy_fire_at,
      pending_low_energy_entry_id: row.pending_low_energy_entry_id,
      absence_last_sent_on: row.absence_last_sent_on,
      updated_at: row.updated_at,
    };
  }

  function defaultPreference(userId: string): NotificationPreference {
    return {
      user_id: userId,
      enabled: false,
      time_hhmm: DEFAULT_REMINDER_TIME,
      last_sent_on: null,
      low_energy_enabled: false,
      absence_enabled: false,
      pending_low_energy_fire_at: null,
      pending_low_energy_entry_id: null,
      absence_last_sent_on: null,
      updated_at: new Date(0).toISOString(),
    };
  }

  function getPreference(userId: string): NotificationPreference | null {
    const row = selectPreference.get(userId) as PreferenceRow | undefined;
    return row ? mapPreference(row) : null;
  }

  function getOrDefaultPreference(userId: string): NotificationPreference {
    return getPreference(userId) ?? defaultPreference(userId);
  }

  function ensureRow(userId: string, now: Date): void {
    ensurePreferenceRow.run({
      user_id: userId,
      time_hhmm: DEFAULT_REMINDER_TIME,
      updated_at: now.toISOString(),
    });
  }

  function savePreference(
    userId: string,
    input: {
      enabled: boolean;
      time_hhmm: string;
      low_energy_enabled: boolean;
      absence_enabled: boolean;
    },
    now: Date = new Date(),
  ): NotificationPreference {
    const existing = getPreference(userId);
    const clock = getParisClock(now);
    let lastSentOn = existing?.last_sent_on ?? null;

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
      low_energy_enabled: input.low_energy_enabled ? 1 : 0,
      absence_enabled: input.absence_enabled ? 1 : 0,
      pending_low_energy_fire_at: existing?.pending_low_energy_fire_at ?? null,
      pending_low_energy_entry_id:
        existing?.pending_low_energy_entry_id ?? null,
      absence_last_sent_on: existing?.absence_last_sent_on ?? null,
      updated_at: updatedAt,
    });

    return getOrDefaultPreference(userId);
  }

  function clearPendingLowEnergy(userId: string, now: Date = new Date()): void {
    ensureRow(userId, now);
    clearPendingSql.run({
      user_id: userId,
      updated_at: now.toISOString(),
    });
  }

  function setPendingLowEnergy(
    userId: string,
    entryId: string,
    fireAtIso: string,
    now: Date = new Date(),
  ): void {
    ensureRow(userId, now);
    setPendingSql.run({
      user_id: userId,
      pending_low_energy_fire_at: fireAtIso,
      pending_low_energy_entry_id: entryId,
      updated_at: now.toISOString(),
    });
  }

  function scheduleFromEntry(
    userId: string,
    entry: { id: string; timestamp: string; energy: number },
    now: Date = new Date(),
  ): void {
    const preference = getOrDefaultPreference(userId);
    if (!preference.low_energy_enabled) {
      return;
    }
    if (entry.energy >= 5) {
      clearPendingLowEnergy(userId, now);
      return;
    }
    const fireAt = computeLowEnergyFollowUpAt(new Date(entry.timestamp));
    if (!fireAt || fireAt.getTime() <= now.getTime()) {
      clearPendingLowEnergy(userId, now);
      return;
    }
    setPendingLowEnergy(userId, entry.id, fireAt.toISOString(), now);
  }

  function syncLowEnergyAfterMutation(
    userId: string,
    mutated: EntryRecencyRow | null,
    now: Date = new Date(),
  ): void {
    const preference = getOrDefaultPreference(userId);
    if (!preference.low_energy_enabled) {
      return;
    }

    const pendingId = preference.pending_low_energy_entry_id;
    const pendingSource = pendingId
      ? (selectEntryById.get({ id: pendingId, user_id: userId }) as
          | EntryRecencyRow
          | undefined)
      : undefined;

    if (mutated) {
      const touchesPending =
        !pendingSource ||
        pendingSource.id === mutated.id ||
        isEntryMoreRecentThan(mutated, pendingSource);
      if (!touchesPending) {
        return;
      }
      if (pendingSource && pendingSource.id === mutated.id) {
        scheduleFromEntry(userId, mutated, now);
        return;
      }
      if (!pendingSource || isEntryMoreRecentThan(mutated, pendingSource)) {
        scheduleFromEntry(userId, mutated, now);
        return;
      }
    }

    // DELETE path or need full re-eval from latest remaining entry.
    reevaluatePendingFromLatest(userId, now);
  }

  function reevaluatePendingFromLatest(
    userId: string,
    now: Date = new Date(),
  ): void {
    const preference = getOrDefaultPreference(userId);
    if (!preference.low_energy_enabled) {
      clearPendingLowEnergy(userId, now);
      return;
    }
    const latest = selectLatestEntry.get(userId) as EntryRecencyRow | undefined;
    if (!latest) {
      clearPendingLowEnergy(userId, now);
      return;
    }
    scheduleFromEntry(userId, latest, now);
  }

  function hasEntryOnParisDate(userId: string, parisDate: string): boolean {
    const rows = selectEntriesForUser.all(userId) as EntryRecencyRow[];
    for (const row of rows) {
      if (getParisClock(new Date(row.timestamp)).date === parisDate) {
        return true;
      }
    }
    return false;
  }

  function entryIsStillValidSource(
    userId: string,
    entryId: string,
  ): EntryRecencyRow | null {
    const entry = selectEntryById.get({ id: entryId, user_id: userId }) as
      | EntryRecencyRow
      | undefined;
    if (!entry || entry.energy >= 5) {
      return null;
    }
    const latest = selectLatestEntry.get(userId) as EntryRecencyRow | undefined;
    if (!latest) {
      return null;
    }
    if (latest.id !== entry.id) {
      return null;
    }
    return entry;
  }

  /** Expire stale low-energy pendings without sending. */
  function expireStalePendings(now: Date = new Date()): void {
    const clock = getParisClock(now);
    const smartRows = selectSmartCandidates.all() as PreferenceRow[];
    for (const row of smartRows) {
      const preference = mapPreference(row);
      if (!preference.pending_low_energy_fire_at) {
        continue;
      }
      if (isLowEnergyFollowUpInWindow(preference.pending_low_energy_fire_at, now)) {
        continue;
      }
      const fireDate = new Date(preference.pending_low_energy_fire_at);
      if (Number.isNaN(fireDate.getTime())) {
        clearPendingLowEnergy(preference.user_id, now);
        continue;
      }
      const pastGrace =
        now.getTime() > fireDate.getTime() + 15 * 60 * 1000;
      const otherDay = getParisClock(fireDate).date !== clock.date;
      if (pastGrace || otherDay) {
        clearPendingLowEnergy(preference.user_id, now);
      }
    }
  }

  function listDueRemindersUnfiltered(now: Date = new Date()): DueReminder[] {
    const clock = getParisClock(now);
    const due: DueReminder[] = [];

    const fixedRows = selectEnabledFixed.all() as PreferenceRow[];
    for (const row of fixedRows) {
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
        kind: 'fixed',
        timeHhmm: preference.time_hhmm,
        subscriptions,
      });
    }

    const smartRows = selectSmartCandidates.all() as PreferenceRow[];
    for (const row of smartRows) {
      const preference = mapPreference(row);
      const subscriptions = selectSubscriptionsForUser.all(
        preference.user_id,
      ) as PushSubscriptionRecord[];
      if (subscriptions.length === 0) {
        continue;
      }

      if (
        preference.low_energy_enabled &&
        preference.pending_low_energy_fire_at &&
        preference.pending_low_energy_entry_id &&
        isLowEnergyFollowUpInWindow(
          preference.pending_low_energy_fire_at,
          now,
        ) &&
        entryIsStillValidSource(
          preference.user_id,
          preference.pending_low_energy_entry_id,
        )
      ) {
        due.push({
          userId: preference.user_id,
          kind: 'low_energy',
          timeHhmm: getParisClock(
            new Date(preference.pending_low_energy_fire_at),
          ).hhmm,
          subscriptions,
        });
      }

      if (
        preference.absence_enabled &&
        preference.absence_last_sent_on !== clock.date &&
        isAbsenceInWindow(now) &&
        !hasEntryOnParisDate(preference.user_id, clock.date)
      ) {
        due.push({
          userId: preference.user_id,
          kind: 'absence',
          timeHhmm: '19:00',
          subscriptions,
        });
      }
    }

    return due;
  }

  /**
   * One reminder per user per tick. When several kinds are due together,
   * keep highest priority only. Losers are marked after a successful send.
   */
  function pickDueReminders(now: Date = new Date()): DueReminder[] {
    expireStalePendings(now);
    const all = listDueRemindersUnfiltered(now);
    const priority: Record<ReminderKind, number> = {
      low_energy: 0,
      absence: 1,
      fixed: 2,
    };
    const byUser = new Map<string, DueReminder[]>();
    for (const item of all) {
      const list = byUser.get(item.userId) ?? [];
      list.push(item);
      byUser.set(item.userId, list);
    }

    const result: DueReminder[] = [];
    for (const [, list] of byUser) {
      list.sort((a, b) => priority[a.kind] - priority[b.kind]);
      result.push(list[0]!);
    }
    return result;
  }

  function listCollisionLosers(
    userId: string,
    winner: DueReminder,
    now: Date = new Date(),
  ): ReminderKind[] {
    return listDueRemindersUnfiltered(now)
      .filter((r) => r.userId === userId && r.kind !== winner.kind)
      .map((r) => r.kind);
  }

  function markReminderSent(userId: string, now: Date = new Date()): void {
    const clock = getParisClock(now);
    markFixedSent.run({
      user_id: userId,
      last_sent_on: clock.date,
      updated_at: now.toISOString(),
    });
  }

  function markAbsenceSent(userId: string, now: Date = new Date()): void {
    const clock = getParisClock(now);
    ensureRow(userId, now);
    markAbsenceSentSql.run({
      user_id: userId,
      absence_last_sent_on: clock.date,
      updated_at: now.toISOString(),
    });
  }

  function markKindSent(
    userId: string,
    kind: ReminderKind,
    now: Date = new Date(),
  ): void {
    if (kind === 'fixed') {
      markReminderSent(userId, now);
      return;
    }
    if (kind === 'absence') {
      markAbsenceSent(userId, now);
      return;
    }
    clearPendingLowEnergy(userId, now);
  }

  function saveSubscription(
    userId: string,
    input: { endpoint: string; p256dh: string; auth: string },
    now: Date = new Date(),
  ): PushSubscriptionRecord {
    const existing = selectSubscriptionByEndpoint.get(input.endpoint) as
      | PushSubscriptionRecord
      | undefined;
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
    listDueReminders: pickDueReminders,
    listDueRemindersUnfiltered,
    listCollisionLosers,
    markReminderSent,
    markAbsenceSent,
    markKindSent,
    clearPendingLowEnergy,
    setPendingLowEnergy,
    scheduleFromEntry,
    syncLowEnergyAfterMutation,
    reevaluatePendingFromLatest,
    hasEntryOnParisDate,
    saveSubscription,
    removeSubscriptionByEndpoint,
    removeSubscriptionForUser,
    removeSubscriptionById,
    subscriptionCount,
  };
}

export type ReminderStore = ReturnType<typeof createReminderStore>;
