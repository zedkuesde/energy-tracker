export function HistoryPage() {
  return (
    <section className="page">
      <h1>Historique</h1>
      <p className="lede">
        Tes observations apparaîtront ici, de la plus récente à la plus
        ancienne.
      </p>
      <div className="empty-state">
        <p>Aucune entrée pour le moment.</p>
        <p className="hint">
          Tes observations s’afficheront ici, sans tableau.
        </p>
      </div>
    </section>
  );
}
