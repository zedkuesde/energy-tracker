import { useState } from 'react';
import { EnergyChart } from '../components/EnergyChart';
import { PeriodSummary } from '../components/PeriodSummary';
import { RangeSelector } from '../components/RangeSelector';
import { StatusPanel } from '../components/StatusPanel';
import { useChartEntries } from '../hooks/useChartEntries';
import { shouldShowDesireLine, toChartPoints } from '../lib/chartData';
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
  const points = toChartPoints(entries);
  const showDesire = shouldShowDesireLine(entries);

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

      {showData ? (
        <div className="chart-block">
          <EnergyChart points={points} showDesire={showDesire} />
          <ul className="chart-legend" aria-label="Légende">
            <li>
              <span
                className="legend-swatch legend-energy"
                aria-hidden="true"
              />
              Énergie
            </li>
            <li>
              <span
                className="legend-swatch legend-fatigue"
                aria-hidden="true"
              />
              Fatigue
            </li>
            {showDesire ? (
              <li>
                <span
                  className="legend-swatch legend-desire"
                  aria-hidden="true"
                />
                Envie
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {periodReady && truncated ? (
        <StatusPanel>
          <p>La vue ne peut pas charger davantage pour le moment.</p>
        </StatusPanel>
      ) : null}
    </section>
  );
}
