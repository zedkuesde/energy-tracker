import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  buildPatchEntryBody,
  deleteEntry,
  fetchEntries,
  fetchEntry,
  patchEntry,
  type EnergyEntry,
} from './entries';

function sample(overrides: Partial<EnergyEntry> = {}): EnergyEntry {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    timestamp: '2026-09-06T16:00:00.000Z',
    energy: 6,
    fatigue: 4,
    desire: null,
    context: null,
    activity: null,
    created_at: '2026-09-06T16:00:01.000Z',
    updated_at: '2026-09-06T16:00:01.000Z',
    ...overrides,
  };
}

describe('fetchEntries', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 50, offset: 0, total: 0 },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('envoie from, to, limit et offset', async () => {
    await fetchEntries({
      from: '2026-08-30T18:00:00.000Z',
      to: '2026-09-06T18:00:00.000Z',
      limit: 100,
      offset: 0,
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/entries?from=2026-08-30T18%3A00%3A00.000Z&to=2026-09-06T18%3A00%3A00.000Z&limit=100&offset=0',
      expect.objectContaining({}),
    );
  });
});

describe('buildPatchEntryBody', () => {
  test('envoie énergie et fatigue, omet les facultatifs déjà absents', () => {
    expect(
      buildPatchEntryBody(sample(), {
        energy: 8,
        fatigue: 2,
        desire: null,
        context: '',
        activity: null,
      }),
    ).toEqual({ energy: 8, fatigue: 2 });
  });

  test('envoie desire/context/activity nuls seulement s’ils sont retirés', () => {
    expect(
      buildPatchEntryBody(
        sample({ desire: 5, context: 'note', activity: 'work' }),
        {
          energy: 6,
          fatigue: 4,
          desire: null,
          context: '   ',
          activity: null,
        },
      ),
    ).toEqual({
      energy: 6,
      fatigue: 4,
      desire: null,
      context: null,
      activity: null,
    });
  });

  test('n’envoie pas de timestamp ni de chaîne vide', () => {
    const body = buildPatchEntryBody(sample({ context: 'hello' }), {
      energy: 6,
      fatigue: 4,
      desire: null,
      context: 'nouveau',
      activity: 'rest',
    });
    expect(body).toEqual({
      energy: 6,
      fatigue: 4,
      context: 'nouveau',
      activity: 'rest',
    });
    expect(JSON.stringify(body)).not.toContain('undefined');
    expect(JSON.stringify(body)).not.toContain('timestamp');
  });
});

describe('fetchEntry, patchEntry, deleteEntry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('fetchEntry lit GET /api/entries/:id', async () => {
    const entry = sample();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: entry }),
      }),
    );
    await expect(fetchEntry(entry.id)).resolves.toEqual(entry);
    expect(fetch).toHaveBeenCalledWith(
      `/api/entries/${entry.id}`,
      expect.objectContaining({}),
    );
  });

  test('patchEntry envoie PATCH JSON', async () => {
    const entry = sample({ energy: 8 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: entry }),
      }),
    );
    await expect(
      patchEntry(entry.id, { energy: 8, fatigue: 4 }),
    ).resolves.toEqual(entry);
    expect(fetch).toHaveBeenCalledWith(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ energy: 8, fatigue: 4 }),
    });
  });

  test('deleteEntry envoie DELETE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    );
    await deleteEntry('11111111-2222-4333-8444-555555555555');
    expect(fetch).toHaveBeenCalledWith(
      '/api/entries/11111111-2222-4333-8444-555555555555',
      { method: 'DELETE' },
    );
  });
});
