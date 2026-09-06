import { describe, expect, test } from 'vitest';
import { getRangeBounds } from './range';

describe('getRangeBounds', () => {
  const now = new Date('2026-09-06T18:00:00.000Z');

  test('calcule 7 jours à partir d’une date de référence', () => {
    expect(getRangeBounds(7, now)).toEqual({
      from: '2026-08-30T18:00:00.000Z',
      to: '2026-09-06T18:00:00.000Z',
    });
  });

  test('calcule 30 jours à partir d’une date de référence', () => {
    expect(getRangeBounds(30, now)).toEqual({
      from: '2026-08-07T18:00:00.000Z',
      to: '2026-09-06T18:00:00.000Z',
    });
  });

  test('calcule 90 jours à partir d’une date de référence', () => {
    expect(getRangeBounds(90, now)).toEqual({
      from: '2026-06-08T18:00:00.000Z',
      to: '2026-09-06T18:00:00.000Z',
    });
  });
});
