import { getActivityLabel } from '../lib/activities';
import type { EnergyEntry } from '../lib/api/entries';
import { formatParisDate, formatParisTime } from '../lib/dates';

type EntryCardProps = {
  entry: EnergyEntry;
  onEdit: (entry: EnergyEntry, trigger: HTMLButtonElement) => void;
  onDelete: (entry: EnergyEntry, trigger: HTMLButtonElement) => void;
};

export function EntryCard({ entry, onEdit, onDelete }: EntryCardProps) {
  const showDesire = entry.desire !== null;

  return (
    <article className="entry-card">
      <p className="entry-date">{formatParisDate(entry.timestamp)}</p>
      <p className="entry-time">{formatParisTime(entry.timestamp)}</p>
      <dl
        className={
          showDesire ? 'entry-scores' : 'entry-scores entry-scores-two'
        }
      >
        <div>
          <dt>Énergie</dt>
          <dd className="entry-energy">{entry.energy}</dd>
        </div>
        <div>
          <dt>Fatigue</dt>
          <dd className="entry-fatigue">{entry.fatigue}</dd>
        </div>
        {showDesire ? (
          <div>
            <dt>Envie</dt>
            <dd className="entry-desire">{entry.desire}</dd>
          </div>
        ) : null}
      </dl>
      {entry.activity ? (
        <p className="entry-activity">{getActivityLabel(entry.activity)}</p>
      ) : null}
      {entry.context ? <p className="entry-context">{entry.context}</p> : null}
      <div className="entry-actions">
        <button
          type="button"
          className="text-button"
          onClick={(event) => {
            onEdit(entry, event.currentTarget);
          }}
        >
          Modifier
        </button>
        <button
          type="button"
          className="text-button entry-delete"
          onClick={(event) => {
            onDelete(entry, event.currentTarget);
          }}
        >
          Supprimer
        </button>
      </div>
    </article>
  );
}
