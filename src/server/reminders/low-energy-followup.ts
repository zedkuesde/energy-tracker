import { getParisClock, parseHhmmToMinutes } from './paris-time.js';

/** Minutes of day (Paris) → follow-up minutes of day. */
const FOLLOWUP_POINTS: ReadonlyArray<readonly [number, number]> = [
  [8 * 60, 9 * 60],
  [9 * 60, 10 * 60],
  [10 * 60, 11 * 60],
  [11 * 60, 12 * 60],
  [12 * 60, 14 * 60],
  [13 * 60, 15 * 60],
  [14 * 60, 16 * 60],
  [15 * 60, 16 * 60],
  [16 * 60, 17 * 60 + 30],
  [17 * 60, 18 * 60 + 30],
  [18 * 60, 20 * 60],
  [19 * 60, 21 * 60],
  [20 * 60, 21 * 60],
];

const DAY_START = 8 * 60;
const DAY_END = 21 * 60;

/**
 * Computes the low-energy follow-up instant (UTC) for an entry timestamp.
 * Returns null before 08:00 or from 21:00 Paris inclusive.
 * Between table points: linear interpolation, rounded to the nearest minute.
 * Segment [20:00, 21:00) maps to 21:00.
 */
export function computeLowEnergyFollowUpAt(
  entryTimestamp: Date,
): Date | null {
  const clock = getParisClock(entryTimestamp);
  const t = clock.minutesOfDay;

  if (t < DAY_START || t >= DAY_END) {
    return null;
  }

  let targetMinutes: number;
  if (t >= 20 * 60 && t < DAY_END) {
    targetMinutes = 21 * 60;
  } else {
    let i = 0;
    while (
      i < FOLLOWUP_POINTS.length - 1 &&
      FOLLOWUP_POINTS[i + 1]![0] <= t
    ) {
      i += 1;
    }
    const [t0, y0] = FOLLOWUP_POINTS[i]!;
    if (t === t0 || i === FOLLOWUP_POINTS.length - 1) {
      targetMinutes = y0;
    } else {
      const [t1, y1] = FOLLOWUP_POINTS[i + 1]!;
      const ratio = (t - t0) / (t1 - t0);
      targetMinutes = Math.round(y0 + ratio * (y1 - y0));
    }
  }

  return parisDateTimeToUtc(clock.date, targetMinutes);
}

/** Build a UTC Date for a Paris civil date + minutes-of-day. */
export function parisDateTimeToUtc(
  parisDate: string,
  minutesOfDay: number,
): Date {
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const asUtcGuess = new Date(
    `${parisDate}T${pad(hour)}:${pad(minute)}:00.000Z`,
  );

  // Iteratively correct for Paris offset (CET/CEST).
  for (let i = 0; i < 3; i += 1) {
    const clock = getParisClock(asUtcGuess);
    const want = hour * 60 + minute;
    const diff = want - clock.minutesOfDay;
    if (diff === 0 && clock.date === parisDate) {
      return asUtcGuess;
    }
    // Also correct day slip near midnight.
    let dayAdjust = 0;
    if (clock.date < parisDate) {
      dayAdjust = 24 * 60;
    } else if (clock.date > parisDate) {
      dayAdjust = -24 * 60;
    }
    asUtcGuess.setUTCMinutes(asUtcGuess.getUTCMinutes() + diff + dayAdjust);
  }
  return asUtcGuess;
}

export const LOW_ENERGY_GRACE_MS = 15 * 60 * 1000;
export const ABSENCE_HHMM = '19:00';
export const ABSENCE_END_HHMM = '19:15';
export const SMART_PUSH_TTL_SECONDS = 900;

export function isLowEnergyFollowUpInWindow(
  fireAtIso: string,
  now: Date,
): boolean {
  const fireAt = new Date(fireAtIso);
  if (Number.isNaN(fireAt.getTime())) {
    return false;
  }
  const fireClock = getParisClock(fireAt);
  const nowClock = getParisClock(now);
  if (fireClock.date !== nowClock.date) {
    return false;
  }
  const t = now.getTime();
  return t >= fireAt.getTime() && t <= fireAt.getTime() + LOW_ENERGY_GRACE_MS;
}

export function isAbsenceInWindow(now: Date): boolean {
  const clock = getParisClock(now);
  const start = parseHhmmToMinutes(ABSENCE_HHMM)!;
  const end = parseHhmmToMinutes(ABSENCE_END_HHMM)!;
  // Inclusive through 19:15:00.000 — use instant bounds for consistency with D1.
  const windowStart = parisDateTimeToUtc(clock.date, start);
  const windowEnd = parisDateTimeToUtc(clock.date, end);
  const t = now.getTime();
  return t >= windowStart.getTime() && t <= windowEnd.getTime();
}

export function compareEntriesRecency(
  a: { timestamp: string; created_at: string; id: string },
  b: { timestamp: string; created_at: string; id: string },
): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp < b.timestamp ? -1 : 1;
  }
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

export function isEntryMoreRecentThan(
  candidate: { timestamp: string; created_at: string; id: string },
  reference: { timestamp: string; created_at: string; id: string },
): boolean {
  return compareEntriesRecency(candidate, reference) > 0;
}
