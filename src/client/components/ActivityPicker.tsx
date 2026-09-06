import { ACTIVITIES, type Activity } from '../lib/activities';

type ActivityPickerProps = {
  idPrefix?: string;
  value: Activity | null;
  onChange: (value: Activity | null) => void;
};

export function ActivityPicker({
  idPrefix = 'activity',
  value,
  onChange,
}: ActivityPickerProps) {
  const labelId = `${idPrefix}-label`;
  return (
    <div className="field">
      <p className="field-label" id={labelId}>
        Activité
        <span className="indicator-optional"> (facultatif)</span>
      </p>
      <div className="activity-row" role="group" aria-labelledby={labelId}>
        {ACTIVITIES.map((item) => {
          const selected = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={selected ? 'chip chip-active' : 'chip'}
              aria-pressed={selected}
              onClick={() => {
                onChange(selected ? null : item.value);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
