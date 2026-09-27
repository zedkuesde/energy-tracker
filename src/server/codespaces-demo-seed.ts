import { randomUUID } from 'node:crypto';
import type { Activity } from './types.js';
import {
  CodespacesDemoError,
  CODESPACES_DEMO_EMAIL,
} from './codespaces-demo.js';
import type { SqliteDatabase } from './db.js';
import { createUserStore } from './auth/users.js';
import { normalizeEmail } from './validation/account.js';

export type DemoEntrySeed = {
  daysAgo: number;
  hour: number;
  minute: number;
  energy: number;
  fatigue: number;
  desire: number | null;
  context: string | null;
  activity: Activity | null;
};

/** Jeu fictif compact, relatif à « maintenant », utile pour 7 / 30 / 90 jours. */
export function buildDemoEntrySeeds(): DemoEntrySeed[] {
  return [
    // Aujourd'hui — plusieurs saisies, dont envie absente et envie à 0
    {
      daysAgo: 0,
      hour: 8,
      minute: 15,
      energy: 7,
      fatigue: 3,
      desire: null,
      context: 'Matin calme',
      activity: 'rest',
    },
    {
      daysAgo: 0,
      hour: 13,
      minute: 40,
      energy: 5,
      fatigue: 5,
      desire: 0,
      context: 'Après déjeuner',
      activity: 'work',
    },
    {
      daysAgo: 0,
      hour: 20,
      minute: 5,
      energy: 4,
      fatigue: 6,
      desire: 2,
      context: null,
      activity: 'leisure',
    },
    // Hier — une seule saisie
    {
      daysAgo: 1,
      hour: 18,
      minute: 30,
      energy: 6,
      fatigue: 4,
      desire: 5,
      context: 'Fin de journée',
      activity: 'transport',
    },
    // Jours 2–3 vides intentionnellement
    {
      daysAgo: 4,
      hour: 9,
      minute: 0,
      energy: 8,
      fatigue: 2,
      desire: 7,
      context: null,
      activity: 'sport',
    },
    {
      daysAgo: 4,
      hour: 21,
      minute: 10,
      energy: 3,
      fatigue: 7,
      desire: null,
      context: 'Soirée',
      activity: 'rest',
    },
    {
      daysAgo: 6,
      hour: 12,
      minute: 20,
      energy: 5,
      fatigue: 5,
      desire: 4,
      context: null,
      activity: 'work',
    },
    {
      daysAgo: 10,
      hour: 16,
      minute: 45,
      energy: 6,
      fatigue: 3,
      desire: 6,
      context: 'Après-midi',
      activity: 'creative',
    },
    {
      daysAgo: 10,
      hour: 22,
      minute: 0,
      energy: 2,
      fatigue: 8,
      desire: 1,
      context: null,
      activity: 'other',
    },
    {
      daysAgo: 18,
      hour: 11,
      minute: 30,
      energy: 7,
      fatigue: 2,
      desire: null,
      context: null,
      activity: 'leisure',
    },
    {
      daysAgo: 25,
      hour: 19,
      minute: 15,
      energy: 4,
      fatigue: 6,
      desire: 3,
      context: 'Semaine chargée',
      activity: 'work',
    },
    {
      daysAgo: 25,
      hour: 7,
      minute: 50,
      energy: 6,
      fatigue: 4,
      desire: 0,
      context: null,
      activity: 'rest',
    },
    {
      daysAgo: 40,
      hour: 14,
      minute: 0,
      energy: 5,
      fatigue: 5,
      desire: 5,
      context: null,
      activity: 'transport',
    },
    {
      daysAgo: 55,
      hour: 10,
      minute: 25,
      energy: 8,
      fatigue: 1,
      desire: 8,
      context: 'Bonne journée',
      activity: 'sport',
    },
    {
      daysAgo: 70,
      hour: 17,
      minute: 40,
      energy: 3,
      fatigue: 7,
      desire: null,
      context: null,
      activity: 'work',
    },
  ];
}

/** Horodatage UTC relatif à maintenant, pour garder 7 / 30 / 90 jours utiles. */
export function relativeDemoTimestamp(
  now: Date,
  daysAgo: number,
  hour: number,
  minute: number,
): string {
  const date = new Date(now.getTime());
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function materializeDemoEntries(
  seeds: DemoEntrySeed[],
  now = new Date(),
): Array<{
  id: string;
  timestamp: string;
  energy: number;
  fatigue: number;
  desire: number | null;
  context: string | null;
  activity: Activity | null;
}> {
  return seeds.map((seed) => ({
    id: randomUUID(),
    timestamp: relativeDemoTimestamp(now, seed.daysAgo, seed.hour, seed.minute),
    energy: seed.energy,
    fatigue: seed.fatigue,
    desire: seed.desire,
    context: seed.context,
    activity: seed.activity,
  }));
}

export type SeedDemoResult = {
  inserted: number;
  skipped: boolean;
  userId: string;
};

/**
 * Insère les entrées de démo pour le compte démo si aucune entrée n'existe encore.
 * N'efface jamais de données. Idempotent.
 */
export function seedCodespacesDemoEntries(
  db: SqliteDatabase,
  options: { now?: Date; email?: string } = {},
): SeedDemoResult {
  const email = normalizeEmail(options.email ?? CODESPACES_DEMO_EMAIL);
  if (!email) {
    throw new CodespacesDemoError('Email du compte démo invalide.');
  }
  const users = createUserStore(db);
  const user = users.findByEmail(email);
  if (!user) {
    throw new CodespacesDemoError(
      `Compte démo introuvable (${email}). Exécute d’abord les migrations Codespaces.`,
    );
  }

  const countRow = db
    .prepare('SELECT COUNT(*) AS total FROM energy_entries WHERE user_id = ?')
    .get(user.id) as { total: number };
  if (countRow.total > 0) {
    return { inserted: 0, skipped: true, userId: user.id };
  }

  const insert = db.prepare(`
    INSERT INTO energy_entries (
      id, user_id, timestamp, energy, fatigue, desire, context, activity,
      created_at, updated_at
    ) VALUES (
      @id, @user_id, @timestamp, @energy, @fatigue, @desire, @context, @activity,
      @created_at, @updated_at
    )
  `);

  const entries = materializeDemoEntries(buildDemoEntrySeeds(), options.now);
  const createdAt = (options.now ?? new Date()).toISOString();

  const insertAll = db.transaction(() => {
    for (const entry of entries) {
      insert.run({
        id: entry.id,
        user_id: user.id,
        timestamp: entry.timestamp,
        energy: entry.energy,
        fatigue: entry.fatigue,
        desire: entry.desire,
        context: entry.context,
        activity: entry.activity,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }
  });
  insertAll();

  return { inserted: entries.length, skipped: false, userId: user.id };
}
