import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeLowEnergyFollowUpAt,
  isAbsenceInWindow,
  isEntryMoreRecentThan,
  isLowEnergyFollowUpInWindow,
  parisDateTimeToUtc,
} from './low-energy-followup.js';
import { getParisClock } from './paris-time.js';

function parisLocalIso(parisDate: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return parisDateTimeToUtc(parisDate, h * 60 + m);
}

test('computeLowEnergyFollowUpAt : table et interpolation', () => {
  const d = '2026-07-15';
  const cases: Array<[string, string | null]> = [
    ['07:59', null],
    ['08:00', '09:00'],
    ['12:00', '14:00'],
    ['16:00', '17:30'],
    ['16:30', '18:00'],
    ['19:30', '21:00'],
    ['20:00', '21:00'],
    ['20:30', '21:00'],
    ['21:00', null],
    ['22:00', null],
  ];
  for (const [entryHhmm, expected] of cases) {
    const entry = parisLocalIso(d, entryHhmm);
    const fire = computeLowEnergyFollowUpAt(entry);
    if (expected === null) {
      assert.equal(fire, null, `entry ${entryHhmm}`);
    } else {
      assert.ok(fire, `entry ${entryHhmm}`);
      assert.equal(getParisClock(fire!).hhmm, expected, `entry ${entryHhmm}`);
      assert.equal(getParisClock(fire!).date, d);
    }
  }
});

test('fenêtre relance : bornes inclusives 15 min, même jour Paris', () => {
  const fireAt = parisLocalIso('2026-07-15', '18:00');
  const fireIso = fireAt.toISOString();
  assert.equal(isLowEnergyFollowUpInWindow(fireIso, fireAt), true);
  assert.equal(
    isLowEnergyFollowUpInWindow(
      fireIso,
      new Date(fireAt.getTime() + 15 * 60 * 1000),
    ),
    true,
  );
  assert.equal(
    isLowEnergyFollowUpInWindow(
      fireIso,
      new Date(fireAt.getTime() + 15 * 60 * 1000 + 1),
    ),
    false,
  );
  assert.equal(
    isLowEnergyFollowUpInWindow(
      fireIso,
      parisLocalIso('2026-07-16', '18:00'),
    ),
    false,
  );
});

test('fenêtre absence : 19:00–19:15 inclus Europe/Paris', () => {
  assert.equal(isAbsenceInWindow(parisLocalIso('2026-07-15', '18:59')), false);
  assert.equal(isAbsenceInWindow(parisLocalIso('2026-07-15', '19:00')), true);
  assert.equal(isAbsenceInWindow(parisLocalIso('2026-07-15', '19:15')), true);
  assert.equal(
    isAbsenceInWindow(new Date(parisLocalIso('2026-07-15', '19:15').getTime() + 1)),
    false,
  );
  assert.equal(isAbsenceInWindow(parisLocalIso('2026-07-15', '19:16')), false);
});

test('ordre de récence : timestamp puis created_at puis id', () => {
  const older = {
    id: 'b',
    timestamp: '2026-07-15T10:00:00.000Z',
    created_at: '2026-07-15T12:00:00.000Z',
  };
  const newerTs = {
    id: 'a',
    timestamp: '2026-07-15T11:00:00.000Z',
    created_at: '2026-07-15T11:00:00.000Z',
  };
  assert.equal(isEntryMoreRecentThan(newerTs, older), true);
  assert.equal(isEntryMoreRecentThan(older, newerTs), false);

  const sameTsNewerCreated = {
    id: 'a',
    timestamp: '2026-07-15T10:00:00.000Z',
    created_at: '2026-07-15T13:00:00.000Z',
  };
  assert.equal(isEntryMoreRecentThan(sameTsNewerCreated, older), true);
});
