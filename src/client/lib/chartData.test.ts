import { describe, expect, test } from 'vitest';
import type { EnergyEntry } from './api/entries';
import { getRangeBounds } from './range';
import { summarizePeriod } from './period-summary';
import {
  addParisCivilDays,
  dailyChartXDomain,
  parisDayKey,
  shouldShowDesireLine,
  toChartPoints,
  toDailyChartPoints,
} from './chartData';

function entry(
  id: string,
  timestamp: string,
  extras: Partial<EnergyEntry> = {},
): EnergyEntry {
  return {
    id,
    timestamp,
    energy: 6,
    fatigue: 4,
    desire: null,
    context: null,
    activity: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...extras,
  };
}

describe('chartData', () => {
  test('trie par timestamp croissant puis par id', () => {
    const points = toChartPoints([
      entry('b', '2026-09-06T12:00:00.000Z'),
      entry('a', '2026-09-06T10:00:00.000Z'),
      entry('c', '2026-09-06T12:00:00.000Z'),
    ]);

    expect(points.map((point) => point.id)).toEqual(['a', 'b', 'c']);
    expect(points.map((point) => point.timestamp)).toEqual([
      '2026-09-06T10:00:00.000Z',
      '2026-09-06T12:00:00.000Z',
      '2026-09-06T12:00:00.000Z',
    ]);
  });

  test('conserve desire null sans le remplacer par zéro', () => {
    const [point] = toChartPoints([
      entry('a', '2026-09-06T10:00:00.000Z', { desire: null }),
    ]);
    expect(point.desire).toBeNull();
  });

  test('masque la courbe envie s’il y a moins de 2 valeurs', () => {
    expect(
      shouldShowDesireLine([
        entry('a', '2026-09-06T10:00:00.000Z', { desire: 4 }),
        entry('b', '2026-09-06T11:00:00.000Z'),
      ]),
    ).toBe(false);
  });

  test('affiche la courbe envie à partir de 2 valeurs', () => {
    expect(
      shouldShowDesireLine([
        entry('a', '2026-09-06T10:00:00.000Z', { desire: 4 }),
        entry('b', '2026-09-06T11:00:00.000Z', { desire: 7 }),
      ]),
    ).toBe(true);
  });
});

describe('toDailyChartPoints', () => {
  test('moyenne plusieurs saisies le même jour Paris', () => {
    const points = toDailyChartPoints([
      entry('a', '2026-09-06T08:00:00.000Z', { energy: 6, fatigue: 2 }),
      entry('b', '2026-09-06T16:00:00.000Z', { energy: 8, fatigue: 4 }),
    ]);

    expect(points).toHaveLength(1);
    expect(points[0].dayKey).toBe('2026-09-06');
    expect(points[0].energy).toBe(7);
    expect(points[0].fatigue).toBe(3);
    expect(points[0].count).toBe(2);
  });

  test('sépare les jours de part et d’autre de minuit Paris', () => {
    // 21:30 UTC = 23:30 Paris le 5 ; 22:30 UTC = 00:30 Paris le 6
    const points = toDailyChartPoints([
      entry('a', '2026-09-05T21:30:00.000Z', { energy: 3, fatigue: 7 }),
      entry('b', '2026-09-05T22:30:00.000Z', { energy: 9, fatigue: 1 }),
    ]);

    expect(points.map((point) => point.dayKey)).toEqual([
      '2026-09-05',
      '2026-09-06',
    ]);
    expect(points[0].energy).toBe(3);
    expect(points[1].energy).toBe(9);
  });

  test('insère des trous null entre deux jours renseignés, sans zéro', () => {
    const points = toDailyChartPoints([
      entry('a', '2026-09-01T12:00:00.000Z', { energy: 5, fatigue: 5 }),
      entry('b', '2026-09-04T12:00:00.000Z', { energy: 8, fatigue: 2 }),
    ]);

    expect(points.map((point) => point.dayKey)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
    expect(points[1].energy).toBeNull();
    expect(points[1].fatigue).toBeNull();
    expect(points[1].count).toBe(0);
    expect(points[2].energy).toBeNull();
    expect(points.every((point) => point.energy !== 0 || point.count > 0)).toBe(
      true,
    );
    expect(points.filter((point) => point.count === 0)).toHaveLength(2);
  });

  test('domaine X partagé couvre premier et dernier jour renseigné', () => {
    const points = toDailyChartPoints([
      entry('a', '2026-09-01T12:00:00.000Z'),
      entry('b', '2026-09-03T12:00:00.000Z'),
    ]);
    const domain = dailyChartXDomain(points);
    expect(domain).not.toBeNull();
    expect(domain?.[0]).toBe(points[0].ms);
    expect(domain?.[1]).toBe(points[points.length - 1].ms);
  });

  test('une fenêtre 7×24h peut couvrir 8 jours civils Paris', () => {
    const now = new Date('2026-09-06T18:00:00.000Z');
    const { from, to } = getRangeBounds(7, now);
    expect(from).toBe('2026-08-30T18:00:00.000Z');
    expect(to).toBe('2026-09-06T18:00:00.000Z');

    const firstParisDay = parisDayKey(from);
    const lastParisDay = parisDayKey(to);
    expect(firstParisDay).toBe('2026-08-30');
    expect(lastParisDay).toBe('2026-09-06');

    const civilDays: string[] = [];
    for (
      let key = firstParisDay;
      key <= lastParisDay;
      key = addParisCivilDays(key, 1)
    ) {
      civilDays.push(key);
    }
    expect(civilDays).toHaveLength(8);

    const points = toDailyChartPoints([
      entry('a', from, { energy: 4, fatigue: 6 }),
      entry('b', to, { energy: 7, fatigue: 3 }),
    ]);
    expect(points).toHaveLength(8);
    expect(points[0].count).toBe(1);
    expect(points[points.length - 1].count).toBe(1);
    expect(points.slice(1, -1).every((point) => point.energy === null)).toBe(
      true,
    );
  });

  test('regroupe correctement autour du passage à l’heure d’été Paris', () => {
    // 2026-03-29 : 02:00 CET → 03:00 CEST
    const before = entry('a', '2026-03-28T22:30:00.000Z', {
      energy: 2,
      fatigue: 8,
    }); // 23:30 CET le 28
    const afterJump = entry('b', '2026-03-29T01:30:00.000Z', {
      energy: 5,
      fatigue: 5,
    }); // 03:30 CEST le 29
    const nextEvening = entry('c', '2026-03-29T20:00:00.000Z', {
      energy: 7,
      fatigue: 3,
    }); // 22:00 CEST le 29

    expect(parisDayKey(before.timestamp)).toBe('2026-03-28');
    expect(parisDayKey(afterJump.timestamp)).toBe('2026-03-29');
    expect(parisDayKey(nextEvening.timestamp)).toBe('2026-03-29');

    const points = toDailyChartPoints([before, afterJump, nextEvening]);
    expect(points.map((point) => point.dayKey)).toEqual([
      '2026-03-28',
      '2026-03-29',
    ]);
    expect(points[0].energy).toBe(2);
    expect(points[1].energy).toBe(6);
    expect(points[1].count).toBe(2);
  });

  test('regroupe correctement autour du passage à l’heure d’hiver Paris', () => {
    // 2026-10-25 : 03:00 CEST → 02:00 CET
    const before = entry('a', '2026-10-24T22:00:00.000Z', {
      energy: 4,
      fatigue: 4,
    }); // 00:00 CEST le 25
    const afterFallback = entry('b', '2026-10-25T01:30:00.000Z', {
      energy: 8,
      fatigue: 2,
    }); // 02:30 CET le 25
    const nextDay = entry('c', '2026-10-25T23:00:00.000Z', {
      energy: 1,
      fatigue: 9,
    }); // 00:00 CET le 26

    expect(parisDayKey(before.timestamp)).toBe('2026-10-25');
    expect(parisDayKey(afterFallback.timestamp)).toBe('2026-10-25');
    expect(parisDayKey(nextDay.timestamp)).toBe('2026-10-26');

    const points = toDailyChartPoints([before, afterFallback, nextDay]);
    expect(points.map((point) => point.dayKey)).toEqual([
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(points[0].energy).toBe(6);
    expect(points[0].count).toBe(2);
    expect(points[1].energy).toBe(1);
  });

  test('la moyenne de période reste pondérée par les saisies brutes', () => {
    const entries = [
      entry('a', '2026-09-01T10:00:00.000Z', { energy: 10, fatigue: 0 }),
      entry('b', '2026-09-01T14:00:00.000Z', { energy: 10, fatigue: 0 }),
      entry('c', '2026-09-03T12:00:00.000Z', { energy: 0, fatigue: 10 }),
    ];
    const points = toDailyChartPoints(entries);
    const filled = points.filter((point) => point.count > 0);
    expect(filled).toHaveLength(2);
    expect(filled[0].energy).toBe(10);
    expect(filled[1].energy).toBe(0);

    const unweightedDaily =
      ((filled[0].energy ?? 0) + (filled[1].energy ?? 0)) / filled.length;
    expect(unweightedDaily).toBe(5);

    const summary = summarizePeriod(entries, 7);
    expect(summary.energy?.mean).toBeCloseTo(20 / 3, 5);
    expect(summary.energy?.mean).not.toBe(unweightedDaily);
  });
});
