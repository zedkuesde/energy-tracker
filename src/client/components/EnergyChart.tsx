import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from 'recharts';
import type { ChartPoint } from '../lib/chartData';
import { formatParisDateShort, formatParisWeekdayTime } from '../lib/dates';

type EnergyChartProps = {
  points: ChartPoint[];
  showDesire: boolean;
};

const ENERGY_COLOR = '#c49a3c';
const FATIGUE_COLOR = '#6e4452';
const DESIRE_COLOR = '#6a7d6e';

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

function ChartDetail({ point }: { point: ChartPoint }) {
  return (
    <div className="chart-detail">
      <p className="chart-detail-when">
        {formatParisWeekdayTime(point.timestamp)}
      </p>
      <p className="chart-detail-line">Énergie {point.energy} / 10</p>
      <p className="chart-detail-line">Fatigue {point.fatigue} / 10</p>
      {point.desire !== null ? (
        <p className="chart-detail-line">Envie {point.desire} / 10</p>
      ) : null}
    </div>
  );
}

export function EnergyChart({ points, showDesire }: EnergyChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredPoint = hoveredId
    ? (points.find((point) => point.id === hoveredId) ?? null)
    : null;
  const activePoint = hoveredPoint ?? points.at(-1) ?? null;

  function handleMouseMove(state: MouseHandlerDataParam) {
    const index = resolvePointIndex(state);
    if (index === null) {
      return;
    }
    const next = points[index];
    if (!next) {
      return;
    }
    setHoveredId((current) => (current === next.id ? current : next.id));
  }

  return (
    <>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              setHoveredId(null);
            }}
          >
            <CartesianGrid stroke="#e4ddd2" vertical={false} />
            <XAxis
              dataKey="ms"
              type="number"
              domain={['dataMin', 'dataMax']}
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
            <Line
              type="monotone"
              dataKey="energy"
              name="Énergie"
              stroke={ENERGY_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="fatigue"
              name="Fatigue"
              stroke={FATIGUE_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            {showDesire ? (
              <Line
                type="monotone"
                dataKey="desire"
                name="Envie"
                stroke={DESIRE_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {activePoint ? <ChartDetail point={activePoint} /> : null}
    </>
  );
}
