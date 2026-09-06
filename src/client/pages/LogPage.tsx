const indicators = [
  { id: 'energy', label: 'Énergie', tone: 'energy', optional: false },
  { id: 'fatigue', label: 'Fatigue', tone: 'fatigue', optional: false },
  { id: 'desire', label: 'Envie', tone: 'desire', optional: true },
] as const;

export function LogPage() {
  return (
    <section className="page">
      <h1>Comment tu te sens maintenant ?</h1>
      <p className="lede">
        Énergie, fatigue, envie. À toi de voir ce qui est utile.
      </p>
      <div className="indicator-list">
        {indicators.map((indicator) => (
          <div
            key={indicator.id}
            className={`indicator indicator-${indicator.tone}`}
          >
            <div className="indicator-head">
              <p className="indicator-label">
                {indicator.label}
                {indicator.optional ? (
                  <span className="indicator-optional"> (facultatif)</span>
                ) : null}
              </p>
              <p className="indicator-value">
                <span className="indicator-current">—</span>
                <span className="indicator-scale"> / 10</span>
              </p>
            </div>
            <div className="slider-visual" aria-hidden="true">
              <span className="slider-track" />
              <span className="slider-thumb" />
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="primary-button" disabled>
        Enregistrer
      </button>
    </section>
  );
}
