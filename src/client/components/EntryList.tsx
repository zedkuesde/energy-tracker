import type { EnergyEntry } from '../lib/api/entries';
import { EntryCard } from './EntryCard';

type EntryListProps = {
  entries: EnergyEntry[];
};

export function EntryList({ entries }: EntryListProps) {
  return (
    <ul className="entry-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <EntryCard entry={entry} />
        </li>
      ))}
    </ul>
  );
}
