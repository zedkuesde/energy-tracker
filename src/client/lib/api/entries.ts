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

export type PatchEntryPayload = {
  energy: number;
  fatigue: number;
  desire?: number | null;
  context?: string | null;
  activity?: Activity | null;
};

export type EntryResponse = {
  data: EnergyEntry;
};

export function buildPatchEntryBody(
  original: EnergyEntry,
  values: {
    energy: number;
    fatigue: number;
    desire: number | null;
    context: string;
    activity: Activity | null;
  },
): PatchEntryPayload {
  const body: PatchEntryPayload = {
    energy: values.energy,
    fatigue: values.fatigue,
  };

  const context =
    values.context.trim().length === 0 ? null : values.context.trim();

  if (values.desire !== null) {
    body.desire = values.desire;
  } else if (original.desire !== null) {
    body.desire = null;
  }

  if (context !== null) {
    body.context = context;
  } else if (original.context !== null) {
    body.context = null;
  }

  if (values.activity !== null) {
    body.activity = values.activity;
  } else if (original.activity !== null) {
    body.activity = null;
  }

  return body;
}

async function requestJson(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new EntryFetchError('network');
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

  const response = await requestJson(url, { signal: query.signal });

  if (!response.ok) {
    throw new EntryFetchError('api');
  }

  return (await response.json()) as ListEntriesResponse;
}

export async function fetchEntry(id: string): Promise<EnergyEntry> {
  const response = await requestJson(`/api/entries/${id}`);
  if (!response.ok) {
    throw new EntryFetchError('api');
  }
  const body = (await response.json()) as EntryResponse;
  return body.data;
}

export async function patchEntry(
  id: string,
  payload: PatchEntryPayload,
): Promise<EnergyEntry> {
  const response = await requestJson(`/api/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new EntryFetchError('api');
  }
  const body = (await response.json()) as EntryResponse;
  return body.data;
}

export async function deleteEntry(id: string): Promise<void> {
  const response = await requestJson(`/api/entries/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new EntryFetchError('api');
  }
}
