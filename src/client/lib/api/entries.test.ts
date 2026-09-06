import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchEntries } from './entries';

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
