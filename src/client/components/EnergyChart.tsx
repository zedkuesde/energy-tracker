import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from 'recharts';
import type { DailyChartPoint } from '../lib/chartData';
import { formatParisDate, formatParisDateShort } from '../lib/dates';
import {
  formatExactScore,
  formatMeanScore,
  observationLabel,
} from '../lib/period-summary';

export const ENERGY_COLOR = '#c49a3c';
export const FATIGUE_COLOR = '#6e4452';

type MetricKey = 'energy' | 'fatigue';

type DailyMetricChartProps = {
  title: string;
  points: DailyChartPoint[];
  dataKey: MetricKey;
  color: string;
  xDomain: [number, number];
  periodMean: number | null;
  onActiveIdChange: (id: string | null) => void;
};

function resolvePointIndex(state: MouseHandlerDataParam): number | null {
  const raw = state.activeTooltipIndex ?? state.activeIndex;
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    return Number(raw);
  }
  return null;
}

function dayScore(value: number, count: number): string {
  return count < 2 ? formatExactScore(value) : formatMeanScore(value);
}

export function ChartDayDetail({ point }: { point: DailyChartPoint }) {
  return (
    <div className="chart-detail">
      <p className="chart-detail-when">{formatParisDate(point.timestamp)}</p>
      {point.energy !== null ? (
        <p className="chart-detail-line">
          Énergie {dayScore(point.energy, point.count)}
        </p>
      ) : null}
      {point.fatigue !== null ? (
        <p className="chart-detail-line">
          Fatigue {dayScore(point.fatigue, point.count)}
        </p>
      ) : null}
      <p className="chart-detail-line chart-detail-count">
        {observationLabel(point.count)} ce jour
      </p>
    </div>
  );
}

export function DailyMetricChart({
  title,
  points,
  dataKey,
  color,
  xDomain,
  periodMean,
  onActiveIdChange,
}: DailyMetricChartProps) {
  function handleMouseMove(state: MouseHandlerDataParam) {
    const index = resolvePointIndex(state);
    if (index === null) {
      return;
    }
    const next = points[index];
    if (!next || next.count === 0) {
      return;
    }
    onActiveIdChange(next.id);
  }

  return (
    <div className="chart-series">
      <h2 className="chart-series-title">{title}</h2>
      <div className="chart-frame chart-frame-daily">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              onActiveIdChange(null);
            }}
          >
            <CartesianGrid stroke="#e4ddd2" vertical={false} />
            <XAxis
              dataKey="ms"
              type="number"
              domain={xDomain}
              tickFormatter={(value: number) => formatParisDateShort(value)}
              minTickGap={56}
              tick={{ fontSize: 12, fill: '#5e584e' }}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              width={28}
              tick={{ fontSize: 12, fill: '#5e584e' }}
            />
            <Tooltip
              content={() => null}
              cursor={{ stroke: '#e2d5c4', strokeWidth: 1 }}
              wrapperStyle={{ display: 'none' }}
            />
            {periodMean !== null ? (
              <ReferenceLine
                y={periodMean}
                stroke="#9a9084"
                strokeDasharray="4 4"
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
            ) : null}
            <Line
              type="monotone"
              dataKey={dataKey}
              name={title}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type DailyOverviewChartsProps = {
  points: DailyChartPoint[];
  xDomain: [number, number];
  energyMean: number | null;
  fatigueMean: number | null;
  initialActiveId: string | null;
};

export function DailyOverviewCharts({
  points,
  xDomain,
  energyMean,
  fatigueMean,
  initialActiveId,
}: DailyOverviewChartsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeId = hoveredId ?? initialActiveId;
  const activePoint = activeId
    ? (points.find((point) => point.id === activeId && point.count > 0) ?? null)
    : null;

  return (
    <div className="chart-block">
      <DailyMetricChart
        title="Énergie"
        points={points}
        dataKey="energy"
        color={ENERGY_COLOR}
        xDomain={xDomain}
        periodMean={energyMean}
        onActiveIdChange={setHoveredId}
      />
      <DailyMetricChart
        title="Fatigue"
        points={points}
        dataKey="fatigue"
        color={FATIGUE_COLOR}
        xDomain={xDomain}
        periodMean={fatigueMean}
        onActiveIdChange={setHoveredId}
      />
      {activePoint ? <ChartDayDetail point={activePoint} /> : null}
      <ul className="chart-legend" aria-label="Légende">
        <li>
          <span className="legend-swatch legend-energy" aria-hidden="true" />
          Énergie
        </li>
        <li>
          <span className="legend-swatch legend-fatigue" aria-hidden="true" />
          Fatigue
        </li>
        <li>
          <span
            className="legend-swatch legend-period-mean"
            aria-hidden="true"
          />
          Moyenne de la période
        </li>
      </ul>
    </div>
  );
}
