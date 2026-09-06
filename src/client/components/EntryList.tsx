import type { EnergyEntry } from '../lib/api/entries';
import { EntryCard } from './EntryCard';

type EntryListProps = {
  entries: EnergyEntry[];
  onEdit: (entry: EnergyEntry, trigger: HTMLButtonElement) => void;
  onDelete: (entry: EnergyEntry, trigger: HTMLButtonElement) => void;
};

export function EntryList({ entries, onEdit, onDelete }: EntryListProps) {
  return (
    <ul className="entry-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <EntryCard entry={entry} onEdit={onEdit} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}
