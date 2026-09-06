export function ChartsPage() {
  return (
    <section className="page">
      <h1>Graphes</h1>
      <p className="lede">
        Énergie et fatigue dans le temps, sans interprétation automatique.
      </p>
      <div className="range-row" role="group" aria-label="Période">
        <button type="button" className="chip chip-active" disabled>
          7 jours
        </button>
        <button type="button" className="chip" disabled>
          30 jours
        </button>
        <button type="button" className="chip" disabled>
          90 jours
        </button>
      </div>
      <div className="empty-state">
        <p>Pas encore de courbe à afficher.</p>
        <p className="hint">Elles apparaîtront avec tes observations.</p>
      </div>
    </section>
  );
}
