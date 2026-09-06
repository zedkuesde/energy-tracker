import type { CSSProperties, PointerEvent } from 'react';
import { scoreFromClientX } from '../lib/scoreFromClientX';

type ScoreSliderProps = {
  id: string;
  label: string;
  tone: 'energy' | 'fatigue' | 'desire';
  optional?: boolean;
  value: number | null;
  onChange: (value: number) => void;
};

export function ScoreSlider({
  id,
  label,
  tone,
  optional = false,
  value,
  onChange,
}: ScoreSliderProps) {
  const progress = value === null ? 0 : (value / 10) * 100;
  const display = value === null ? '—' : String(value);
  const className = [
    'score-slider',
    value === null ? 'is-unset' : 'has-value',
  ].join(' ');

  function commitFromPointer(event: PointerEvent<HTMLInputElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = scoreFromClientX(event.clientX, rect);
    event.currentTarget.value = String(next);
    onChange(next);
  }

  return (
    <div className={`indicator indicator-${tone}`}>
      <div className="indicator-head">
        <label className="indicator-label" htmlFor={id}>
          {label}
          {optional ? (
            <span className="indicator-optional"> (facultatif)</span>
          ) : null}
        </label>
        <p className="indicator-value">
          <span className="indicator-current">{display}</span>
          <span className="indicator-scale"> / 10</span>
        </p>
      </div>
      <input
        id={id}
        className={className}
        type="range"
        min={0}
        max={10}
        step={1}
        value={value ?? 0}
        aria-valuetext={value === null ? 'non renseigné' : `${value} sur 10`}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        onPointerDown={commitFromPointer}
        onChange={(event) => {
          onChange(Number(event.currentTarget.value));
        }}
      />
    </div>
  );
}
