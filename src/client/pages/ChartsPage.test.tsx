import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { EnergyEntry } from '../lib/api/entries';
import { ChartsPage } from './ChartsPage';

const NOW = new Date('2026-09-06T18:00:00.000Z');

function entry(
  id: string,
  timestamp: string,
  extras: Partial<EnergyEntry> = {},
): EnergyEntry {
  return {
    id,
    timestamp,
    energy: 6,
    fatigue: 4,
    desire: null,
    context: null,
    activity: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...extras,
  };
}

function ok(data: EnergyEntry[], total = data.length, offset = 0, limit = 100) {
  return {
    ok: true,
    json: async () => ({
      data,
      pagination: { limit, offset, total },
    }),
  };
}

function lastUrl() {
  const calls = vi.mocked(fetch).mock.calls;
  return String(calls[calls.length - 1][0]);
}

describe('ChartsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('utilise 7 jours par défaut et envoie from et to', async () => {
    vi.mocked(fetch).mockResolvedValue(ok([]) as Response);

    render(<ChartsPage now={NOW} />);

    await screen.findByText('Aucune entrée sur cette période.');
    expect(lastUrl()).toContain('from=2026-08-30T18%3A00%3A00.000Z');
    expect(lastUrl()).toContain('to=2026-09-06T18%3A00%3A00.000Z');
    expect(lastUrl()).toContain('limit=100');
  });

  test('change vers 30 et 90 jours', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(ok([]) as Response);

    render(<ChartsPage now={NOW} />);
    await screen.findByText('Aucune entrée sur cette période.');

    await user.click(screen.getByRole('radio', { name: '30 jours' }));
    await waitFor(() => {
      expect(lastUrl()).toContain('from=2026-08-07T18%3A00%3A00.000Z');
    });

    await user.click(screen.getByRole('radio', { name: '90 jours' }));
    await waitFor(() => {
      expect(lastUrl()).toContain('from=2026-06-08T18%3A00%3A00.000Z');
    });
  });

  test('affiche un état vide sans donnée', async () => {
    vi.mocked(fetch).mockResolvedValue(ok([]) as Response);
    render(<ChartsPage now={NOW} />);
    expect(
      await screen.findByText('Aucune entrée sur cette période.'),
    ).toBeInTheDocument();
  });

  test('affiche un état adapté pour une seule donnée', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('a', '2026-09-06T12:00:00.000Z')]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    expect(
      await screen.findByText(/Une observation est affichée/),
    ).toBeInTheDocument();
    expect(screen.getByText('Énergie')).toBeInTheDocument();
    expect(screen.getByText('Fatigue')).toBeInTheDocument();
    expect(screen.queryByText('Envie')).not.toBeInTheDocument();
  });

  test('affiche la courbe envie à partir de 2 valeurs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T10:00:00.000Z', { desire: 3 }),
        entry('b', '2026-09-06T12:00:00.000Z', { desire: 8 }),
      ]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    expect(await screen.findByText('Envie')).toBeInTheDocument();
  });

  test('masque la courbe envie s’il y a moins de 2 valeurs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T10:00:00.000Z', { desire: 3 }),
        entry('b', '2026-09-06T12:00:00.000Z'),
      ]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    await screen.findByText('Énergie');
    expect(screen.queryByText('Envie')).not.toBeInTheDocument();
  });

  test('affiche une erreur et permet de réessayer', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        ok([entry('a', '2026-09-06T12:00:00.000Z')]) as Response,
      );

    render(<ChartsPage now={NOW} />);

    expect(
      await screen.findByText('Les graphes n’ont pas pu être chargés.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Énergie')).toBeInTheDocument();
  });

  test('s’arrête si une page est vide et signale le plafond de 1000', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      const offset = Number(
        new URL(url, 'http://local.test').searchParams.get('offset'),
      );
      const page = Array.from({ length: 100 }, (_, index) =>
        entry(
          `id-${offset}-${index}`,
          new Date(Date.UTC(2026, 7, 1, 0, 0, offset + index)).toISOString(),
        ),
      );
      return ok(page, 1500, offset) as Response;
    });

    render(<ChartsPage now={NOW} />);

    expect(
      await screen.findByText(
        'La vue ne peut pas charger davantage pour le moment.',
      ),
    ).toBeInTheDocument();
  });
});
