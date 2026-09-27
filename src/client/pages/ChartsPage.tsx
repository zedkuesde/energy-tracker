import { useState } from 'react';
import { DailyOverviewCharts } from '../components/EnergyChart';
import { PeriodSummary } from '../components/PeriodSummary';
import { RangeSelector } from '../components/RangeSelector';
import { StatusPanel } from '../components/StatusPanel';
import { useChartEntries } from '../hooks/useChartEntries';
import {
  dailyChartXDomain,
  lastFilledDailyPoint,
  toDailyChartPoints,
} from '../lib/chartData';
import { summarizePeriod } from '../lib/period-summary';
import type { RangeDays } from '../lib/range';

type ChartsPageProps = {
  now?: Date;
};

export function ChartsPage({ now }: ChartsPageProps) {
  const [range, setRange] = useState<RangeDays>(7);
  const { entries, entriesRange, loading, error, truncated, retry } =
    useChartEntries(range, now);
  const periodReady = entriesRange === range;
  const showLoadingPanel =
    !error && (!periodReady || (loading && entries.length === 0));
  const showData = periodReady && entries.length > 0;
  const showEmpty = periodReady && !loading && !error && entries.length === 0;
  const dailyPoints = showData ? toDailyChartPoints(entries) : [];
  const xDomain = dailyChartXDomain(dailyPoints);
  const summary = showData ? summarizePeriod(entries, range) : null;
  const initialActiveId = lastFilledDailyPoint(dailyPoints)?.id ?? null;

  return (
    <section className="page">
      <h1>Graphes</h1>
      <RangeSelector value={range} onChange={setRange} />

      {showLoadingPanel ? (
        <StatusPanel tone="loading">
          <p>Chargement des graphes…</p>
        </StatusPanel>
      ) : null}

      {loading && showData ? (
        <p className="hint" role="status">
          Chargement…
        </p>
      ) : null}

      {error ? (
        <StatusPanel tone="error" actionLabel="Réessayer" onAction={retry}>
          <p>Les graphes n’ont pas pu être chargés.</p>
        </StatusPanel>
      ) : null}

      {showEmpty || showData ? (
        <PeriodSummary range={range} entries={entries} />
      ) : null}

      {showData && xDomain ? (
        <DailyOverviewCharts
          points={dailyPoints}
          xDomain={xDomain}
          energyMean={summary?.energy?.mean ?? null}
          fatigueMean={summary?.fatigue?.mean ?? null}
          initialActiveId={initialActiveId}
        />
      ) : null}

      {periodReady && truncated ? (
        <StatusPanel>
          <p>La vue ne peut pas charger davantage pour le moment.</p>
        </StatusPanel>
      ) : null}
    </section>
  );
}
