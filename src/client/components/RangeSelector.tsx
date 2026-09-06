import type { KeyboardEvent } from 'react';
import { RANGE_DAYS, type RangeDays } from '../lib/range';

type RangeSelectorProps = {
  value: RangeDays;
  onChange: (value: RangeDays) => void;
};

const LABELS: Record<RangeDays, string> = {
  7: '7 jours',
  30: '30 jours',
  90: '90 jours',
};

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = RANGE_DAYS.indexOf(value);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(RANGE_DAYS[(index + 1) % RANGE_DAYS.length]);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(RANGE_DAYS[(index - 1 + RANGE_DAYS.length) % RANGE_DAYS.length]);
    }
  }

  return (
    <div
      className="range-row"
      role="radiogroup"
      aria-label="Période"
      onKeyDown={handleKeyDown}
    >
      {RANGE_DAYS.map((days) => {
        const selected = days === value;
        return (
          <button
            key={days}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'chip chip-active' : 'chip'}
            onClick={() => {
              onChange(days);
            }}
          >
            {LABELS[days]}
          </button>
        );
      })}
    </div>
  );
}
