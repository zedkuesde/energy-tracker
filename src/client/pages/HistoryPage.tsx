import { EntryList } from '../components/EntryList';
import { StatusPanel } from '../components/StatusPanel';
import { useEntryHistory } from '../hooks/useEntryHistory';

export function HistoryPage() {
  const {
    entries,
    loading,
    loadingMore,
    error,
    hasMore,
    retry,
    loadMore,
    retryMore,
  } = useEntryHistory();

  return (
    <section className="page">
      <h1>Historique</h1>
      <p className="lede">
        Tes observations, de la plus récente à la plus ancienne.
      </p>

      {loading ? (
        <StatusPanel tone="loading">
          <p>Chargement de l’historique…</p>
        </StatusPanel>
      ) : null}

      {!loading && error === 'initial' ? (
        <StatusPanel tone="error" actionLabel="Réessayer" onAction={retry}>
          <p>L’historique n’a pas pu être chargé.</p>
        </StatusPanel>
      ) : null}

      {!loading && error !== 'initial' && entries.length === 0 ? (
        <StatusPanel>
          <p>
            Aucune entrée pour le moment. Tu peux revenir ici après une première
            saisie.
          </p>
        </StatusPanel>
      ) : null}

      {!loading && entries.length > 0 ? <EntryList entries={entries} /> : null}

      {error === 'more' ? (
        <StatusPanel
          tone="error"
          actionLabel="Réessayer"
          onAction={retryMore}
          actionDisabled={loadingMore}
        >
          <p>
            La suite n’a pas pu être chargée. Tes entrées déjà affichées sont
            conservées.
          </p>
        </StatusPanel>
      ) : null}

      {hasMore && error !== 'more' && !loading ? (
        <button
          type="button"
          className="secondary-button load-more"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Chargement…' : 'Charger plus'}
        </button>
      ) : null}
    </section>
  );
}
