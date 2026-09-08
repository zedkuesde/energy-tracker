import { describe, expect, test } from 'vitest';
import type { EnergyEntry } from './api/entries';
import {
  formatExactScore,
  formatMeanScore,
  observationLabel,
  periodEmptyMessage,
  periodHeading,
  summarizePeriod,
} from './period-summary';

function entry(extras: Partial<EnergyEntry> = {}): EnergyEntry {
  const timestamp = extras.timestamp ?? '2026-09-06T12:00:00.000Z';
  return {
    id: extras.id ?? 'a',
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

describe('summarizePeriod', () => {
  test('liste vide : aucune métrique, pas de moyenne à zéro', () => {
    const summary = summarizePeriod([], 7);
    expect(summary).toEqual({
      rangeDays: 7,
      observationCount: 0,
      energy: null,
      fatigue: null,
      desire: null,
    });
  });

  test('une entrée : moyennes égales aux valeurs, envie absente si null', () => {
    expect(
      summarizePeriod([entry({ energy: 7, fatigue: 4, desire: null })], 7),
    ).toEqual({
      rangeDays: 7,
      observationCount: 1,
      energy: { count: 1, mean: 7 },
      fatigue: { count: 1, mean: 4 },
      desire: null,
    });
  });

  test('une entrée avec envie factuelle, y compris 0', () => {
    expect(
      summarizePeriod([entry({ energy: 7, fatigue: 4, desire: 0 })], 30),
    ).toEqual({
      rangeDays: 30,
      observationCount: 1,
      energy: { count: 1, mean: 7 },
      fatigue: { count: 1, mean: 4 },
      desire: { count: 1, mean: 0 },
    });
  });

  test('plusieurs entrées : moyennes arithmétiques', () => {
    const summary = summarizePeriod(
      [
        entry({ id: 'a', energy: 6, fatigue: 5, desire: 4 }),
        entry({ id: 'b', energy: 7, fatigue: 5, desire: 4 }),
      ],
      30,
    );
    expect(summary.observationCount).toBe(2);
    expect(summary.energy).toEqual({ count: 2, mean: 6.5 });
    expect(summary.fatigue).toEqual({ count: 2, mean: 5 });
    expect(summary.desire).toEqual({ count: 2, mean: 4 });
  });

  test('envie absente partout reste null', () => {
    const summary = summarizePeriod(
      [entry({ id: 'a', desire: null }), entry({ id: 'b', desire: null })],
      90,
    );
    expect(summary.desire).toBeNull();
    expect(summary.energy?.count).toBe(2);
  });

  test('envie partiellement renseignée : moyenne sans les null', () => {
    const summary = summarizePeriod(
      [
        entry({ id: 'a', energy: 6, fatigue: 4, desire: 8 }),
        entry({ id: 'b', energy: 4, fatigue: 6, desire: null }),
        entry({ id: 'c', energy: 5, fatigue: 5, desire: 2 }),
      ],
      7,
    );
    expect(summary.energy).toEqual({ count: 3, mean: 5 });
    expect(summary.desire).toEqual({ count: 2, mean: 5 });
  });

  test('envie présente une seule fois', () => {
    const summary = summarizePeriod(
      [entry({ id: 'a', desire: null }), entry({ id: 'b', desire: 7 })],
      7,
    );
    expect(summary.desire).toEqual({ count: 1, mean: 7 });
  });

  test('absence d’envie n’est jamais traitée comme 0', () => {
    const withNulls = summarizePeriod(
      [entry({ id: 'a', desire: null }), entry({ id: 'b', desire: null })],
      7,
    );
    const withZero = summarizePeriod(
      [entry({ id: 'a', desire: 0 }), entry({ id: 'b', desire: 0 })],
      7,
    );
    expect(withNulls.desire).toBeNull();
    expect(withZero.desire).toEqual({ count: 2, mean: 0 });
  });

  test('ne refiltre pas par date : 7 / 30 / 90 ne font que labelliser', () => {
    const entries = [
      entry({
        id: 'old',
        timestamp: '2026-06-01T00:00:00.000Z',
        energy: 3,
        fatigue: 9,
      }),
      entry({
        id: 'new',
        timestamp: '2026-09-06T12:00:00.000Z',
        energy: 9,
        fatigue: 1,
      }),
    ];
    expect(summarizePeriod(entries, 7).observationCount).toBe(2);
    expect(summarizePeriod(entries, 30).energy).toEqual({ count: 2, mean: 6 });
    expect(summarizePeriod(entries, 90).rangeDays).toBe(90);
  });
});

describe('formatage', () => {
  test('arrondit la moyenne à une décimale française', () => {
    expect(formatMeanScore(6.5)).toBe('6,5 / 10');
    expect(formatMeanScore(5)).toBe('5,0 / 10');
    expect(formatMeanScore(6.44)).toBe('6,4 / 10');
    expect(formatMeanScore(6.45)).toBe('6,5 / 10');
    expect(formatMeanScore(0)).toBe('0,0 / 10');
  });

  test('une valeur factuelle reste entière', () => {
    expect(formatExactScore(7)).toBe('7 / 10');
    expect(formatExactScore(0)).toBe('0 / 10');
  });

  test('libellés de période et d’observations', () => {
    expect(periodHeading(7)).toBe('Sur 7 jours');
    expect(periodHeading(30)).toBe('Sur 30 jours');
    expect(periodHeading(90)).toBe('Sur 90 jours');
    expect(periodEmptyMessage(7)).toBe(
      'Pas encore d’observation sur les 7 derniers jours.',
    );
    expect(periodEmptyMessage(30)).toBe(
      'Pas encore d’observation sur les 30 derniers jours.',
    );
    expect(periodEmptyMessage(90)).toBe(
      'Pas encore d’observation sur les 90 derniers jours.',
    );
    expect(observationLabel(1)).toBe('1 observation');
    expect(observationLabel(12)).toBe('12 observations');
  });
});
