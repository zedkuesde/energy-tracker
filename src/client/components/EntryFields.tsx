import type { Activity } from '../lib/activities';
import { ActivityPicker } from './ActivityPicker';
import { ScoreSlider } from './ScoreSlider';

const CONTEXT_MAX_LENGTH = 280;

type EntryFieldsProps = {
  idPrefix?: string;
  energy: number | null;
  fatigue: number | null;
  desire: number | null;
  desireOpen: boolean;
  context: string;
  activity: Activity | null;
  onEnergyChange: (value: number) => void;
  onFatigueChange: (value: number) => void;
  onDesireChange: (value: number) => void;
  onDesireOpen: () => void;
  onDesireRemove: () => void;
  onContextChange: (value: string) => void;
  onActivityChange: (value: Activity | null) => void;
};

export function EntryFields({
  idPrefix = '',
  energy,
  fatigue,
  desire,
  desireOpen,
  context,
  activity,
  onEnergyChange,
  onFatigueChange,
  onDesireChange,
  onDesireOpen,
  onDesireRemove,
  onContextChange,
  onActivityChange,
}: EntryFieldsProps) {
  const energyId = `${idPrefix}energy`;
  const fatigueId = `${idPrefix}fatigue`;
  const desireId = `${idPrefix}desire`;
  const contextId = `${idPrefix}context`;

  return (
    <>
      <div className="indicator-list">
        <ScoreSlider
          id={energyId}
          label="Énergie"
          tone="energy"
          value={energy}
          onChange={onEnergyChange}
        />
        <ScoreSlider
          id={fatigueId}
          label="Fatigue"
          tone="fatigue"
          value={fatigue}
          onChange={onFatigueChange}
        />
        {desireOpen ? (
          <>
            <ScoreSlider
              id={desireId}
              label="Envie"
              tone="desire"
              optional
              value={desire}
              onChange={onDesireChange}
            />
            <button
              type="button"
              className="text-button"
              onClick={onDesireRemove}
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
              onClick={onDesireOpen}
            >
              Ajouter l’envie
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor={contextId}>
          Contexte
          <span className="indicator-optional"> (facultatif)</span>
        </label>
        <textarea
          id={contextId}
          className="context-input"
          rows={3}
          maxLength={CONTEXT_MAX_LENGTH}
          value={context}
          onChange={(event) => {
            onContextChange(event.currentTarget.value);
          }}
        />
        <p className="char-count">
          {context.length} / {CONTEXT_MAX_LENGTH}
        </p>
      </div>

      <ActivityPicker
        idPrefix={`${idPrefix}activity`}
        value={activity}
        onChange={onActivityChange}
      />
    </>
  );
}
