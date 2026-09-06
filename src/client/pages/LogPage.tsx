import { useRef, useState, type FormEvent } from 'react';
import { ActivityPicker } from '../components/ActivityPicker';
import { ScoreSlider } from '../components/ScoreSlider';
import type { Activity } from '../lib/activities';
import {
  buildCreateEntryBody,
  createEntry,
  EntrySaveError,
} from '../lib/createEntry';

const CONTEXT_MAX_LENGTH = 280;

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
      <p className="lede">
        Énergie, fatigue, envie. À toi de voir ce qui est utile.
      </p>
      <form className="log-form" onSubmit={handleSubmit}>
        <div className="indicator-list">
          <ScoreSlider
            id="energy"
            label="Énergie"
            tone="energy"
            value={energy}
            onChange={setEnergy}
          />
          <ScoreSlider
            id="fatigue"
            label="Fatigue"
            tone="fatigue"
            value={fatigue}
            onChange={setFatigue}
          />
          {desireOpen ? (
            <>
              <ScoreSlider
                id="desire"
                label="Envie"
                tone="desire"
                optional
                value={desire}
                onChange={setDesire}
              />
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setDesireOpen(false);
                  setDesire(null);
                }}
              >
                Retirer
              </button>
            </>
          ) : (
            <div className="indicator indicator-desire desire-collapsed">
              <p className="indicator-label">
                Envie
                <span className="indicator-optional"> (facultatif)</span>
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setDesireOpen(true);
                }}
              >
                Ajouter l’envie
              </button>
            </div>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="context">
            Contexte
            <span className="indicator-optional"> (facultatif)</span>
          </label>
          <textarea
            id="context"
            className="context-input"
            rows={3}
            maxLength={CONTEXT_MAX_LENGTH}
            value={context}
            onChange={(event) => {
              setContext(event.currentTarget.value);
            }}
          />
          <p className="char-count">
            {context.length} / {CONTEXT_MAX_LENGTH}
          </p>
        </div>

        <ActivityPicker value={activity} onChange={setActivity} />

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
