import type { EnergyEntry } from './api/entries';

export type ChartPoint = {
  id: string;
  timestamp: string;
  ms: number;
  energy: number;
  fatigue: number;
  desire: number | null;
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
