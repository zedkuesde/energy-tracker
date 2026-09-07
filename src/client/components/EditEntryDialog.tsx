import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from 'react';
import type { Activity } from '../lib/activities';
import {
  buildPatchEntryBody,
  EntryFetchError,
  patchEntry,
  type EnergyEntry,
} from '../lib/api/entries';
import { formatParisDateTime } from '../lib/dates';
import { EntryFields } from './EntryFields';

const NETWORK_ERROR_MESSAGE =
  "Les modifications n'ont pas pu être enregistrées. Tes valeurs sont encore là.";
const API_ERROR_MESSAGE =
  "Cette saisie n'a pas pu être mise à jour. Tes valeurs sont encore là.";

type EditEntryDialogProps = {
  entry: EnergyEntry | null;
  onClose: () => void;
  onSaved: (entry: EnergyEntry) => void;
};

export function EditEntryDialog({
  entry,
  onClose,
  onSaved,
}: EditEntryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const titleId = useId();
  const open = entry !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      const heading = dialog.querySelector('h2');
      heading?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleCancel() {
    if (busyRef.current) {
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        handleCancel();
      }}
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
    >
      <h2 id={titleId} className="dialog-title" tabIndex={-1}>
        Modifier l’entrée
      </h2>
      {entry ? (
        <EditEntryForm
          key={entry.id}
          entry={entry}
          busyRef={busyRef}
          onCancel={handleCancel}
          onSaved={onSaved}
        />
      ) : null}
    </dialog>
  );
}

type EditEntryFormProps = {
  entry: EnergyEntry;
  busyRef: MutableRefObject<boolean>;
  onCancel: () => void;
  onSaved: (entry: EnergyEntry) => void;
};

function EditEntryForm({
  entry,
  busyRef,
  onCancel,
  onSaved,
}: EditEntryFormProps) {
  const inFlight = useRef(false);
  const [energy, setEnergy] = useState<number | null>(entry.energy);
  const [fatigue, setFatigue] = useState<number | null>(entry.fatigue);
  const [desireOpen, setDesireOpen] = useState(entry.desire !== null);
  const [desire, setDesire] = useState<number | null>(entry.desire);
  const [context, setContext] = useState(entry.context ?? '');
  const [activity, setActivity] = useState<Activity | null>(entry.activity);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = energy !== null && fatigue !== null && !saving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (energy === null || fatigue === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    busyRef.current = true;
    setSaving(true);
    setErrorMessage(null);

    const payload = buildPatchEntryBody(entry, {
      energy,
      fatigue,
      desire,
      context,
      activity,
    });

    try {
      const updated = await patchEntry(entry.id, payload);
      onSaved(updated);
    } catch (error) {
      if (error instanceof EntryFetchError && error.kind === 'network') {
        setErrorMessage(NETWORK_ERROR_MESSAGE);
      } else {
        setErrorMessage(API_ERROR_MESSAGE);
      }
    } finally {
      inFlight.current = false;
      busyRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="log-form dialog-form" onSubmit={handleSubmit}>
      <p className="dialog-when">
        <span className="field-label">Date et heure</span>
        <span className="dialog-when-value">
          {formatParisDateTime(entry.timestamp)}
        </span>
      </p>
      <EntryFields
        idPrefix="edit-"
        energy={energy}
        fatigue={fatigue}
        desire={desire}
        desireOpen={desireOpen}
        context={context}
        activity={activity}
        onEnergyChange={setEnergy}
        onFatigueChange={setFatigue}
        onDesireChange={setDesire}
        onDesireOpen={() => {
          setDesireOpen(true);
        }}
        onDesireRemove={() => {
          setDesireOpen(false);
          setDesire(null);
        }}
        onContextChange={setContext}
        onActivityChange={setActivity}
      />
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="dialog-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
        <button type="submit" className="primary-button" disabled={!canSubmit}>
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  );
}
