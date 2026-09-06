import type { TooltipContentProps } from 'recharts';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint } from '../lib/chartData';
import { formatParisDateShort, formatParisTooltipStamp } from '../lib/dates';

type EnergyChartProps = {
  points: ChartPoint[];
  showDesire: boolean;
};

const ENERGY_COLOR = '#3f6f62';
const FATIGUE_COLOR = '#9a5a42';
const DESIRE_COLOR = '#5d6f82';

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-when">
        {formatParisTooltipStamp(point.timestamp)}
      </p>
      <p>Énergie : {point.energy} / 10</p>
      <p>Fatigue : {point.fatigue} / 10</p>
      {point.desire !== null ? <p>Envie : {point.desire} / 10</p> : null}
    </div>
  );
}

export function EnergyChart({ points, showDesire }: EnergyChartProps) {
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
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
          <Tooltip content={ChartTooltip} />
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
  );
}
