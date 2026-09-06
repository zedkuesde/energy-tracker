import { useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditEntryDialog } from '../components/EditEntryDialog';
import { EntryList } from '../components/EntryList';
import { StatusPanel } from '../components/StatusPanel';
import { useEntryHistory } from '../hooks/useEntryHistory';
import {
  deleteEntry,
  EntryFetchError,
  type EnergyEntry,
} from '../lib/api/entries';

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
    replaceEntry,
    removeEntry,
  } = useEntryHistory();
  const [editing, setEditing] = useState<EnergyEntry | null>(null);
  const [deleting, setDeleting] = useState<EnergyEntry | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastActionRef = useRef<HTMLButtonElement | null>(null);
  const deleteInFlight = useRef(false);

  function restoreFocus() {
    lastActionRef.current?.focus();
  }

  function openEdit(entry: EnergyEntry, trigger: HTMLButtonElement) {
    lastActionRef.current = trigger;
    setNotice(null);
    setEditing(entry);
  }

  function openDelete(entry: EnergyEntry, trigger: HTMLButtonElement) {
    lastActionRef.current = trigger;
    setNotice(null);
    setDeleteError(null);
    setDeleting(entry);
  }

  async function confirmDelete() {
    if (!deleting || deleteInFlight.current) {
      return;
    }
    deleteInFlight.current = true;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      await deleteEntry(deleting.id);
      removeEntry(deleting.id);
      setDeleting(null);
      setNotice('Entrée supprimée.');
      restoreFocus();
    } catch (caught) {
      if (caught instanceof EntryFetchError && caught.kind === 'network') {
        setDeleteError(
          "La suppression n'a pas abouti. L’entrée est encore là.",
        );
      } else {
        setDeleteError(
          "Cette entrée n'a pas pu être supprimée. Tu peux réessayer.",
        );
      }
    } finally {
      deleteInFlight.current = false;
      setDeletingBusy(false);
    }
  }

  return (
    <section className="page">
      <h1>Historique</h1>
      <p className="lede">
        Tes observations, de la plus récente à la plus ancienne.
      </p>

      {notice ? (
        <p className="form-status history-notice" role="status">
          {notice}
        </p>
      ) : null}

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

      {!loading && entries.length > 0 ? (
        <EntryList entries={entries} onEdit={openEdit} onDelete={openDelete} />
      ) : null}

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

      <EditEntryDialog
        entry={editing}
        onClose={() => {
          setEditing(null);
          restoreFocus();
        }}
        onSaved={(updated) => {
          replaceEntry(updated);
          setEditing(null);
          setNotice('Modifications enregistrées.');
          restoreFocus();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer cette entrée ?"
        confirmLabel="Supprimer"
        confirmBusyLabel="Suppression…"
        busy={deletingBusy}
        errorMessage={deleteError}
        onCancel={() => {
          if (!deletingBusy) {
            setDeleting(null);
            setDeleteError(null);
            restoreFocus();
          }
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      >
        <p>Cette action est définitive.</p>
      </ConfirmDialog>
    </section>
  );
}
