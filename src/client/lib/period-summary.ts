import type { EnergyEntry } from './api/entries';
import type { RangeDays } from './range';

export type PeriodMetric = {
  count: number;
  mean: number;
};

export type PeriodSummaryData = {
  rangeDays: RangeDays;
  observationCount: number;
  energy: PeriodMetric | null;
  fatigue: PeriodMetric | null;
  desire: PeriodMetric | null;
};

type SummaryEntry = Pick<EnergyEntry, 'energy' | 'fatigue' | 'desire'>;

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function summarizePeriod(
  entries: readonly SummaryEntry[],
  rangeDays: RangeDays,
): PeriodSummaryData {
  const observationCount = entries.length;
  if (observationCount === 0) {
    return {
      rangeDays,
      observationCount: 0,
      energy: null,
      fatigue: null,
      desire: null,
    };
  }

  const desireValues = entries
    .map((entry) => entry.desire)
    .filter((value): value is number => value !== null);

  return {
    rangeDays,
    observationCount,
    energy: {
      count: observationCount,
      mean: average(entries.map((entry) => entry.energy)),
    },
    fatigue: {
      count: observationCount,
      mean: average(entries.map((entry) => entry.fatigue)),
    },
    desire:
      desireValues.length === 0
        ? null
        : {
            count: desireValues.length,
            mean: average(desireValues),
          },
  };
}

export function formatExactScore(value: number): string {
  return `${value} / 10`;
}

export function formatMeanScore(mean: number): string {
  const rounded = Math.round(mean * 10) / 10;
  return `${rounded.toFixed(1).replace('.', ',')} / 10`;
}

export function periodHeading(rangeDays: RangeDays): string {
  return `Sur ${rangeDays} jours`;
}

export function periodEmptyMessage(rangeDays: RangeDays): string {
  return `Pas encore d’observation sur les ${rangeDays} derniers jours.`;
}

export function observationLabel(count: number): string {
  return count === 1 ? '1 observation' : `${count} observations`;
}
