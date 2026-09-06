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
      <p className="lede">
        Énergie et fatigue dans le temps, sans interprétation automatique.
      </p>
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
          <p className="hint">Elles apparaîtront ici après une saisie.</p>
        </StatusPanel>
      ) : null}

      {entries.length > 0 ? (
        <div className="chart-block">
          <h2 className="chart-title">Observations ponctuelles</h2>
          <p className="chart-description">
            Chaque point est une saisie. Énergie et fatigue restent deux axes
            indépendants. Aucune moyenne ni conseil n’est calculé.
          </p>
          {entries.length === 1 ? (
            <p className="hint">
              Une observation est affichée. Plusieurs points aideront à voir une
              évolution.
            </p>
          ) : null}
          <EnergyChart points={points} showDesire={showDesire} />
          <ul className="chart-legend">
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
