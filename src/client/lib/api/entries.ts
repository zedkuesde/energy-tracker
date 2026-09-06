import type { Activity } from '../activities';

export type EnergyEntry = {
  id: string;
  timestamp: string;
  energy: number;
  fatigue: number;
  desire: number | null;
  context: string | null;
  activity: Activity | null;
  created_at: string;
  updated_at: string;
};

export type ListEntriesResponse = {
  data: EnergyEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type ListEntriesQuery = {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
};

export class EntryFetchError extends Error {
  readonly kind: 'network' | 'api';

  constructor(kind: 'network' | 'api') {
    super(kind === 'network' ? 'network' : 'api');
    this.name = 'EntryFetchError';
    this.kind = kind;
  }
}

export async function fetchEntries(
  query: ListEntriesQuery = {},
): Promise<ListEntriesResponse> {
  const params = new URLSearchParams();
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set('offset', String(query.offset));
  }

  const search = params.toString();
  const url = search.length > 0 ? `/api/entries?${search}` : '/api/entries';

  let response: Response;
  try {
    response = await fetch(url, { signal: query.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new EntryFetchError('network');
  }

  if (!response.ok) {
    throw new EntryFetchError('api');
  }

  return (await response.json()) as ListEntriesResponse;
}
