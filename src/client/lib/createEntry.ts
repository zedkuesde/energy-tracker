import type { Activity } from './activities';

export type CreateEntryPayload = {
  energy: number;
  fatigue: number;
  desire?: number;
  context?: string;
  activity?: Activity;
};

export class EntrySaveError extends Error {
  readonly kind: 'network' | 'api';

  constructor(kind: 'network' | 'api') {
    super(kind === 'network' ? 'network' : 'api');
    this.name = 'EntrySaveError';
    this.kind = kind;
  }
}

export function buildCreateEntryBody(input: {
  energy: number;
  fatigue: number;
  desire: number | null;
  context: string;
  activity: Activity | null;
}): CreateEntryPayload {
  const body: CreateEntryPayload = {
    energy: input.energy,
    fatigue: input.fatigue,
  };

  if (input.desire !== null) {
    body.desire = input.desire;
  }

  const context = input.context.trim();
  if (context.length > 0) {
    body.context = context;
  }

  if (input.activity !== null) {
    body.activity = input.activity;
  }

  return body;
}

export async function createEntry(payload: CreateEntryPayload): Promise<void> {
  let response: Response;

  try {
    response = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new EntrySaveError('network');
  }

  if (!response.ok) {
    throw new EntrySaveError('api');
  }
}
