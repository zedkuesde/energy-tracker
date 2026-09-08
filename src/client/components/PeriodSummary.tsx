import {
  formatExactScore,
  formatMeanScore,
  observationLabel,
  periodEmptyMessage,
  periodHeading,
  summarizePeriod,
  type PeriodMetric,
} from '../lib/period-summary';
import type { EnergyEntry } from '../lib/api/entries';
import type { RangeDays } from '../lib/range';

type PeriodSummaryProps = {
  range: RangeDays;
  entries: EnergyEntry[];
};

type MetricTone = 'energy' | 'fatigue' | 'desire';

function metricLine(
  name: string,
  metric: PeriodMetric,
  observationCount: number,
): { text: string; note: string | null } {
  const factual = metric.count < 2;
  const score = factual
    ? formatExactScore(metric.mean)
    : formatMeanScore(metric.mean);
  const label = factual ? name : `${name} moyenne`;
  const note =
    metric.count !== observationCount ? observationLabel(metric.count) : null;
  return { text: `${label} ${score}`, note };
}

function MetricItem({
  tone,
  name,
  metric,
  observationCount,
}: {
  tone: MetricTone;
  name: string;
  metric: PeriodMetric;
  observationCount: number;
}) {
  const line = metricLine(name, metric, observationCount);
  return (
    <li className={`period-summary-metric period-summary-metric-${tone}`}>
      <span className="period-summary-swatch" aria-hidden="true" />
      <span>
        {line.text}
        {line.note ? ` · ${line.note}` : null}
      </span>
    </li>
  );
}

export function PeriodSummary({ range, entries }: PeriodSummaryProps) {
  const summary = summarizePeriod(entries, range);

  if (summary.observationCount === 0) {
    return (
      <section className="period-summary" aria-label="Résumé de la période">
        <p className="period-summary-empty">{periodEmptyMessage(range)}</p>
      </section>
    );
  }

  return (
    <section className="period-summary" aria-label="Résumé de la période">
      <p className="period-summary-heading">{periodHeading(range)}</p>
      <p className="period-summary-count">
        {observationLabel(summary.observationCount)}
      </p>
      <ul className="period-summary-metrics">
        {summary.energy ? (
          <MetricItem
            tone="energy"
            name="Énergie"
            metric={summary.energy}
            observationCount={summary.observationCount}
          />
        ) : null}
        {summary.fatigue ? (
          <MetricItem
            tone="fatigue"
            name="Fatigue"
            metric={summary.fatigue}
            observationCount={summary.observationCount}
          />
        ) : null}
        {summary.desire ? (
          <MetricItem
            tone="desire"
            name="Envie"
            metric={summary.desire}
            observationCount={summary.observationCount}
          />
        ) : null}
      </ul>
    </section>
  );
}
