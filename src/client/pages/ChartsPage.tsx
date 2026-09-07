import { useState } from 'react';
import { EnergyChart } from '../components/EnergyChart';
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
  const { entries, loading, error, truncated, retry } = useChartEntries(
    range,
    now,
  );
  const points = toChartPoints(entries);
  const showDesire = shouldShowDesireLine(entries);

  return (
    <section className="page">
      <h1>Graphes</h1>
      <RangeSelector value={range} onChange={setRange} />

      {loading && entries.length === 0 ? (
        <StatusPanel tone="loading">
          <p>Chargement des graphes…</p>
        </StatusPanel>
      ) : null}

      {loading && entries.length > 0 ? (
        <p className="hint" role="status">
          Chargement…
        </p>
      ) : null}

      {error ? (
        <StatusPanel tone="error" actionLabel="Réessayer" onAction={retry}>
          <p>Les graphes n’ont pas pu être chargés.</p>
        </StatusPanel>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <StatusPanel>
          <p>Aucune entrée sur cette période.</p>
        </StatusPanel>
      ) : null}

      {entries.length > 0 ? (
        <div className="chart-block">
          {entries.length === 1 ? (
            <p className="hint">Une observation est affichée.</p>
          ) : null}
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

      {truncated ? (
        <StatusPanel>
          <p>La vue ne peut pas charger davantage pour le moment.</p>
        </StatusPanel>
      ) : null}
    </section>
  );
}
