import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEntries, type EnergyEntry } from '../lib/api/entries';

const PAGE_SIZE = 50;

export function useEntryHistory() {
  const [entries, setEntries] = useState<EnergyEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<'initial' | 'more' | null>(null);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetchEntries({
        limit: PAGE_SIZE,
        offset,
        signal: controller.signal,
      });

      setError(null);
      setTotal(response.pagination.total);
      setEntries((current) => {
        if (!append) {
          return response.data;
        }
        const seen = new Set(current.map((entry) => entry.id));
        const next = [...current];
        for (const entry of response.data) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            next.push(entry);
          }
        }
        return next;
      });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        return;
      }
      setError(append ? 'more' : 'initial');
    } finally {
      if (!controller.signal.aborted) {
        inFlight.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial API
    void loadPage(0, false);
    return () => {
      inFlight.current = false;
      abortRef.current?.abort();
    };
  }, [loadPage]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    void loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    setError(null);
    void loadPage(entries.length, true);
  }, [entries.length, loadPage]);

  const retryMore = useCallback(() => {
    setLoadingMore(true);
    setError(null);
    void loadPage(entries.length, true);
  }, [entries.length, loadPage]);

  return {
    entries,
    total,
    loading,
    loadingMore,
    error,
    hasMore: total > entries.length,
    retry,
    loadMore,
    retryMore,
  };
}
