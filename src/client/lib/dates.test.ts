import { describe, expect, test } from 'vitest';
import {
  formatParisDate,
  formatParisDateTime,
  formatParisTime,
  formatParisTooltipStamp,
  formatParisWeekdayTime,
  parseUtcInstant,
} from './dates';

describe('dates', () => {
  test('convertit un timestamp UTC vers Europe/Paris en hiver (CET)', () => {
    const instant = '2026-01-15T12:00:00.000Z';
    const formatted = formatParisDateTime(instant);
    expect(formatted).toContain('13:00');
    expect(formatted).toContain('15 janvier 2026');
    expect(formatParisTime(instant)).toContain('13:00');
    expect(formatParisDate(instant).toLowerCase()).toContain('15 janvier');
  });

  test('convertit un timestamp UTC vers Europe/Paris en été (CEST)', () => {
    const instant = '2026-07-15T12:00:00.000Z';
    const formatted = formatParisDateTime(instant);
    expect(formatted).toContain('14:00');
    expect(formatted).toContain('15 juillet 2026');
    expect(formatParisTime(instant)).toContain('14:00');
    expect(formatParisDate(instant).toLowerCase()).toContain('15 juillet');
  });

  test('sépare la date et l’heure à Paris sans changer l’instant', () => {
    const instant = '2026-09-06T16:40:00.000Z';
    expect(formatParisDate(instant).toLowerCase()).toContain('6 septembre');
    expect(formatParisTime(instant)).toContain('18:40');
    expect(formatParisWeekdayTime(instant)).toContain('18:40');
    expect(parseUtcInstant(instant).toISOString()).toBe(instant);
  });

  test('le tooltip inclut la date et l’heure à Paris', () => {
    const formatted = formatParisTooltipStamp('2026-07-15T12:00:00.000Z');
    expect(formatted).toContain('14:00');
    expect(formatted.toLowerCase()).toContain('juillet');
  });

  test('refuse une chaîne timestamp sans fuseau', () => {
    expect(() => parseUtcInstant('2026-09-06T15:45:00')).toThrow(/fuseau/);
  });

  test('accepte un offset explicite', () => {
    const date = parseUtcInstant('2026-09-06T17:45:00+02:00');
    expect(date.toISOString()).toBe('2026-09-06T15:45:00.000Z');
  });
});
