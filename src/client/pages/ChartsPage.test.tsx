import { render, screen, waitFor, within } from '@testing-library/react';
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

function summary() {
  return screen.getByRole('region', { name: 'Résumé de la période' });
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

    expect(
      await screen.findByText(
        'Pas encore d’observation sur les 7 derniers jours.',
      ),
    ).toBeInTheDocument();
    expect(lastUrl()).toContain('from=2026-08-30T18%3A00%3A00.000Z');
    expect(lastUrl()).toContain('to=2026-09-06T18%3A00%3A00.000Z');
    expect(lastUrl()).toContain('limit=100');
    expect(lastUrl()).not.toContain('userId');
    expect(lastUrl()).not.toContain('user_id');
  });

  test('change vers 30 et 90 jours', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(ok([]) as Response);

    render(<ChartsPage now={NOW} />);
    await screen.findByText(
      'Pas encore d’observation sur les 7 derniers jours.',
    );

    await user.click(screen.getByRole('radio', { name: '30 jours' }));
    await waitFor(() => {
      expect(lastUrl()).toContain('from=2026-08-07T18%3A00%3A00.000Z');
    });
    expect(
      await screen.findByText(
        'Pas encore d’observation sur les 30 derniers jours.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '90 jours' }));
    await waitFor(() => {
      expect(lastUrl()).toContain('from=2026-06-08T18%3A00%3A00.000Z');
    });
    expect(
      await screen.findByText(
        'Pas encore d’observation sur les 90 derniers jours.',
      ),
    ).toBeInTheDocument();
  });

  test('affiche un état vide sans donnée ni moyenne à zéro', async () => {
    vi.mocked(fetch).mockResolvedValue(ok([]) as Response);
    render(<ChartsPage now={NOW} />);
    expect(
      await screen.findByText(
        'Pas encore d’observation sur les 7 derniers jours.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/0,0 \/ 10/)).not.toBeInTheDocument();
    expect(screen.queryByText(/moyenne/)).not.toBeInTheDocument();
  });

  test('affiche un état adapté pour une seule donnée', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T12:00:00.000Z', { energy: 7, fatigue: 4 }),
      ]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    const region = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(within(region).getByText('Sur 7 jours')).toBeInTheDocument();
    expect(within(region).getByText('1 observation')).toBeInTheDocument();
    expect(within(region).getByText('Énergie 7 / 10')).toBeInTheDocument();
    expect(within(region).getByText('Fatigue 4 / 10')).toBeInTheDocument();
    expect(within(region).queryByText(/moyenne/)).not.toBeInTheDocument();
    expect(within(region).queryByText(/Envie/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Une observation est affichée.'),
    ).not.toBeInTheDocument();
    const legend = screen.getByRole('list', { name: 'Légende' });
    expect(within(legend).getByText('Énergie')).toBeInTheDocument();
    expect(within(legend).getByText('Fatigue')).toBeInTheDocument();
    expect(within(legend).queryByText('Envie')).not.toBeInTheDocument();
  });

  test('affiche les moyennes dès deux observations et suit la période', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('from=2026-08-07')) {
        return ok([
          entry('c', '2026-08-20T10:00:00.000Z', { energy: 2, fatigue: 8 }),
          entry('d', '2026-08-21T10:00:00.000Z', { energy: 4, fatigue: 6 }),
        ]) as Response;
      }
      return ok([
        entry('a', '2026-09-06T10:00:00.000Z', { energy: 8, fatigue: 1 }),
        entry('b', '2026-09-06T12:00:00.000Z', { energy: 8, fatigue: 1 }),
      ]) as Response;
    });

    render(<ChartsPage now={NOW} />);

    const first = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(within(first).getByText('Sur 7 jours')).toBeInTheDocument();
    expect(within(first).getByText('2 observations')).toBeInTheDocument();
    expect(
      within(first).getByText('Énergie moyenne 8,0 / 10'),
    ).toBeInTheDocument();
    expect(
      within(first).getByText('Fatigue moyenne 1,0 / 10'),
    ).toBeInTheDocument();
    expect(within(first).queryByText(/Envie/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '30 jours' }));
    const second = await screen.findByText('Sur 30 jours');
    const region = second.closest('[aria-label="Résumé de la période"]');
    expect(region).not.toBeNull();
    expect(
      within(region as HTMLElement).getByText('Énergie moyenne 3,0 / 10'),
    ).toBeInTheDocument();
  });

  test('n’affiche pas l’ancien résumé sous le titre de la nouvelle période', async () => {
    const user = userEvent.setup();
    let resolveNinety: ((value: Response) => void) | undefined;
    const ninetyPromise = new Promise<Response>((resolve) => {
      resolveNinety = resolve;
    });

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('from=2026-06-08')) {
        return ninetyPromise;
      }
      return ok([
        entry('a', '2026-09-06T10:00:00.000Z', { energy: 8, fatigue: 1 }),
        entry('b', '2026-09-06T12:00:00.000Z', { energy: 8, fatigue: 1 }),
      ]) as Response;
    });

    render(<ChartsPage now={NOW} />);
    const initial = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(
      within(initial).getByText('Énergie moyenne 8,0 / 10'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '90 jours' }));

    expect(
      await screen.findByText('Chargement des graphes…'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Résumé de la période' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Sur 90 jours')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Énergie moyenne 8,0 / 10'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Légende' }),
    ).not.toBeInTheDocument();

    resolveNinety?.(
      ok([
        entry('c', '2026-07-01T10:00:00.000Z', { energy: 2, fatigue: 9 }),
        entry('d', '2026-07-02T10:00:00.000Z', { energy: 2, fatigue: 9 }),
      ]) as Response,
    );

    const next = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(within(next).getByText('Sur 90 jours')).toBeInTheDocument();
    expect(
      within(next).getByText('Énergie moyenne 2,0 / 10'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Énergie moyenne 8,0 / 10'),
    ).not.toBeInTheDocument();
  });

  test('affiche la courbe envie à partir de 2 valeurs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T10:00:00.000Z', { desire: 3 }),
        entry('b', '2026-09-06T12:00:00.000Z', { desire: 8 }),
      ]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    const region = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(
      within(region).getByText('Envie moyenne 5,5 / 10'),
    ).toBeInTheDocument();
    const legend = await screen.findByRole('list', { name: 'Légende' });
    expect(within(legend).getByText('Envie')).toBeInTheDocument();
  });

  test('masque la légende Envie s’il y a moins de 2 valeurs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T10:00:00.000Z', { desire: 3 }),
        entry('b', '2026-09-06T12:00:00.000Z'),
      ]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    const region = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(
      within(region).getByText('Envie 3 / 10 · 1 observation'),
    ).toBeInTheDocument();
    expect(within(region).queryByText(/Envie moyenne/)).not.toBeInTheDocument();
    const legend = await screen.findByRole('list', { name: 'Légende' });
    expect(within(legend).getByText('Énergie')).toBeInTheDocument();
    expect(within(legend).queryByText('Envie')).not.toBeInTheDocument();
  });

  test('détail Envie possible sans légende si une seule valeur désir', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T10:00:00.000Z'),
        entry('b', '2026-09-06T12:00:00.000Z', { desire: 7 }),
      ]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    const region = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(
      within(region).getByText('Envie 7 / 10 · 1 observation'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Envie 7 / 10')).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: 'Légende' });
    expect(within(legend).queryByText('Envie')).not.toBeInTheDocument();
  });

  test('n’invente pas de valeur d’envie dans le détail', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T12:00:00.000Z', { energy: 5, fatigue: 2 }),
      ]) as Response,
    );

    render(<ChartsPage now={NOW} />);

    const region = await screen.findByRole('region', {
      name: 'Résumé de la période',
    });
    expect(within(region).getByText('Énergie 5 / 10')).toBeInTheDocument();
    expect(within(region).getByText('Fatigue 2 / 10')).toBeInTheDocument();
    expect(within(region).queryByText(/Envie/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Énergie 5 / 10').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Fatigue 2 / 10').length).toBeGreaterThan(1);
    expect(screen.queryByText(/Envie/)).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole('region', { name: 'Résumé de la période' }),
    ).not.toBeInTheDocument();

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
    expect(
      within(summary()).getByText('1000 observations'),
    ).toBeInTheDocument();
  });
});
