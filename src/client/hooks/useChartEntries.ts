import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEntries, type EnergyEntry } from '../lib/api/entries';
import { getRangeBounds, type RangeDays } from '../lib/range';

const PAGE_SIZE = 100;
const MAX_ENTRIES = 1000;

export function useChartEntries(range: RangeDays, now?: Date) {
  const [entries, setEntries] = useState<EnergyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    const id = requestId.current + 1;
    requestId.current = id;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { from, to } = getRangeBounds(range, now ?? new Date());
    const collected: EnergyEntry[] = [];
    const seen = new Set<string>();
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    let hitCap = false;

    try {
      while (collected.length < total && collected.length < MAX_ENTRIES) {
        const remaining = MAX_ENTRIES - collected.length;
        const response = await fetchEntries({
          from,
          to,
          limit: Math.min(PAGE_SIZE, remaining),
          offset,
          signal: controller.signal,
        });

        if (id !== requestId.current) {
          return;
        }

        total = response.pagination.total;
        if (response.data.length === 0) {
          break;
        }

        for (const entry of response.data) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            collected.push(entry);
          }
        }

        offset += response.data.length;

        if (collected.length >= MAX_ENTRIES && collected.length < total) {
          hitCap = true;
          break;
        }
      }

      if (id !== requestId.current) {
        return;
      }

      setEntries(collected);
      setTruncated(hitCap);
      setError(false);
      hasDataRef.current = collected.length > 0;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        return;
      }
      if (id !== requestId.current) {
        return;
      }
      setError(true);
      if (!hasDataRef.current) {
        setEntries([]);
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [now, range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial API
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    void load();
  }, [load]);

  return {
    entries,
    loading,
    error,
    truncated,
    retry,
  };
}
