import type { EnergyEntry } from './api/entries';

const PARIS = 'Europe/Paris';

const parisDayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const parisHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS,
  hour: 'numeric',
  hourCycle: 'h23',
});

export type ChartPoint = {
  id: string;
  timestamp: string;
  ms: number;
  energy: number;
  fatigue: number;
  desire: number | null;
};

export type DailyChartPoint = {
  id: string;
  dayKey: string;
  timestamp: string;
  ms: number;
  energy: number | null;
  fatigue: number | null;
  count: number;
};

export function sortEntriesAscending(entries: EnergyEntry[]): EnergyEntry[] {
  return [...entries].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp < right.timestamp ? -1 : 1;
    }
    return left.id < right.id ? -1 : 1;
  });
}

export function toChartPoints(entries: EnergyEntry[]): ChartPoint[] {
  return sortEntriesAscending(entries).map((entry) => ({
    id: entry.id,
    timestamp: entry.timestamp,
    ms: new Date(entry.timestamp).getTime(),
    energy: entry.energy,
    fatigue: entry.fatigue,
    desire: entry.desire,
  }));
}

export function shouldShowDesireLine(entries: EnergyEntry[]): boolean {
  let count = 0;
  for (const entry of entries) {
    if (entry.desire !== null) {
      count += 1;
      if (count >= 2) {
        return true;
      }
    }
  }
  return false;
}

/** Jour civil Europe/Paris au format YYYY-MM-DD. */
export function parisDayKey(value: string | number | Date): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : new Date(value);
  return parisDayKeyFormatter.format(date);
}

export function addParisCivilDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = String(utc.getUTCFullYear());
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Instant UTC représentatif (midi Paris) d’un jour civil Paris. */
export function parisDayMs(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map(Number);
  let lo = Date.UTC(year, month - 1, day - 1, 10, 0, 0);
  let hi = Date.UTC(year, month - 1, day + 1, 14, 0, 0);

  for (let i = 0; i < 48; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const key = parisDayKey(mid);
    if (key < dayKey) {
      lo = mid;
      continue;
    }
    if (key > dayKey) {
      hi = mid;
      continue;
    }
    const hour = Number(parisHourFormatter.format(mid));
    if (hour < 12) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return Math.floor((lo + hi) / 2);
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

type DayBucket = {
  energies: number[];
  fatigues: number[];
};

/**
 * Une valeur par jour civil Europe/Paris (moyenne des saisies).
 * Les jours sans saisie entre le premier et le dernier jour renseigné
 * sont présents avec energy/fatigue à null (trous, non reliés).
 */
export function toDailyChartPoints(entries: EnergyEntry[]): DailyChartPoint[] {
  if (entries.length === 0) {
    return [];
  }

  const buckets = new Map<string, DayBucket>();
  for (const entry of entries) {
    const key = parisDayKey(entry.timestamp);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { energies: [], fatigues: [] };
      buckets.set(key, bucket);
    }
    bucket.energies.push(entry.energy);
    bucket.fatigues.push(entry.fatigue);
  }

  const filledKeys = [...buckets.keys()].sort();
  const firstKey = filledKeys[0];
  const lastKey = filledKeys[filledKeys.length - 1];
  const points: DailyChartPoint[] = [];

  for (let key = firstKey; key <= lastKey; key = addParisCivilDays(key, 1)) {
    const ms = parisDayMs(key);
    const bucket = buckets.get(key);
    if (!bucket) {
      points.push({
        id: key,
        dayKey: key,
        timestamp: new Date(ms).toISOString(),
        ms,
        energy: null,
        fatigue: null,
        count: 0,
      });
      continue;
    }
    points.push({
      id: key,
      dayKey: key,
      timestamp: new Date(ms).toISOString(),
      ms,
      energy: average(bucket.energies),
      fatigue: average(bucket.fatigues),
      count: bucket.energies.length,
    });
  }

  return points;
}

export function dailyChartXDomain(
  points: DailyChartPoint[],
): [number, number] | null {
  if (points.length === 0) {
    return null;
  }
  return [points[0].ms, points[points.length - 1].ms];
}

export function lastFilledDailyPoint(
  points: DailyChartPoint[],
): DailyChartPoint | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point.count > 0) {
      return point;
    }
  }
  return null;
}
