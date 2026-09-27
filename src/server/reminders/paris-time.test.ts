import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getParisClock,
  isReminderDue,
  parseHhmmToMinutes,
} from './paris-time.js';

test('parseHhmmToMinutes accepte 00:00–23:59 et refuse le reste', () => {
  assert.equal(parseHhmmToMinutes('00:00'), 0);
  assert.equal(parseHhmmToMinutes('09:30'), 9 * 60 + 30);
  assert.equal(parseHhmmToMinutes('23:59'), 23 * 60 + 59);
  assert.equal(parseHhmmToMinutes('24:00'), null);
  assert.equal(parseHhmmToMinutes('9:30'), null);
  assert.equal(parseHhmmToMinutes('ab:cd'), null);
});

test('getParisClock interprète un instant CET (hiver)', () => {
  // 2026-01-15 12:00 UTC = 13:00 Europe/Paris (CET, UTC+1)
  const clock = getParisClock(new Date('2026-01-15T12:00:00.000Z'));
  assert.equal(clock.date, '2026-01-15');
  assert.equal(clock.hhmm, '13:00');
  assert.equal(clock.minutesOfDay, 13 * 60);
});

test('getParisClock interprète un instant CEST (été)', () => {
  // 2026-07-15 12:00 UTC = 14:00 Europe/Paris (CEST, UTC+2)
  const clock = getParisClock(new Date('2026-07-15T12:00:00.000Z'));
  assert.equal(clock.date, '2026-07-15');
  assert.equal(clock.hhmm, '14:00');
  assert.equal(clock.minutesOfDay, 14 * 60);
});

test('getParisClock gère le passage CET→CEST (29 mars 2026)', () => {
  // 01:30 UTC = 02:30 CET juste avant le saut ; après 01:00 UTC → 03:00 CEST
  const before = getParisClock(new Date('2026-03-29T00:30:00.000Z'));
  assert.equal(before.date, '2026-03-29');
  assert.equal(before.hhmm, '01:30');

  const after = getParisClock(new Date('2026-03-29T01:30:00.000Z'));
  assert.equal(after.date, '2026-03-29');
  assert.equal(after.hhmm, '03:30');
});

test('isReminderDue évite le double envoi le même jour Paris', () => {
  const clock = getParisClock(new Date('2026-07-15T18:00:00.000Z')); // 20:00 Paris
  assert.equal(isReminderDue('20:00', clock, null), true);
  assert.equal(isReminderDue('20:00', clock, '2026-07-15'), false);
  assert.equal(isReminderDue('21:00', clock, null), false);
});
