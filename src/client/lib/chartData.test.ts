import { describe, expect, test } from 'vitest';
import type { EnergyEntry } from './api/entries';
import { shouldShowDesireLine, toChartPoints } from './chartData';

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
