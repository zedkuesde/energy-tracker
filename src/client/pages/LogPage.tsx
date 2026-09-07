import { useRef, useState, type FormEvent } from 'react';
import { EntryFields } from '../components/EntryFields';
import type { Activity } from '../lib/activities';
import {
  buildCreateEntryBody,
  createEntry,
  EntrySaveError,
} from '../lib/createEntry';

const NETWORK_ERROR_MESSAGE =
  "L'enregistrement n'a pas abouti. Tes valeurs sont encore là.";
const API_ERROR_MESSAGE =
  "Cette saisie n'a pas pu être enregistrée. Tes valeurs sont encore là.";

export function LogPage() {
  const [energy, setEnergy] = useState<number | null>(null);
  const [fatigue, setFatigue] = useState<number | null>(null);
  const [desireOpen, setDesireOpen] = useState(false);
  const [desire, setDesire] = useState<number | null>(null);
  const [context, setContext] = useState('');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const canSubmit = energy !== null && fatigue !== null && !saving;

  function resetForm() {
    setEnergy(null);
    setFatigue(null);
    setDesireOpen(false);
    setDesire(null);
    setContext('');
    setActivity(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (energy === null || fatigue === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = buildCreateEntryBody({
      energy,
      fatigue,
      desire,
      context,
      activity,
    });

    try {
      await createEntry(payload);
      resetForm();
      setSuccessMessage('Enregistré.');
    } catch (error) {
      if (error instanceof EntrySaveError && error.kind === 'network') {
        setErrorMessage(NETWORK_ERROR_MESSAGE);
      } else {
        setErrorMessage(API_ERROR_MESSAGE);
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <h1>Comment tu te sens maintenant ?</h1>
      <p className="lede">Quelques secondes pour faire le point.</p>
      <form className="log-form" onSubmit={handleSubmit}>
        <EntryFields
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

        {successMessage ? (
          <p className="form-status" role="status">
            {successMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button type="submit" className="primary-button" disabled={!canSubmit}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </section>
  );
}
