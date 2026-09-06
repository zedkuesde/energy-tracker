import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { EnergyEntry } from '../lib/api/entries';
import { HistoryPage } from './HistoryPage';

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

function ok(data: EnergyEntry[], total = data.length, offset = 0) {
  return {
    ok: true,
    json: async () => ({
      data,
      pagination: { limit: 50, offset, total },
    }),
  };
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('charge et affiche plusieurs entrées dans l’ordre décroissant', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('newer', '2026-09-06T16:00:00.000Z', { energy: 8, fatigue: 2 }),
        entry('older', '2026-09-06T10:00:00.000Z', { energy: 5, fatigue: 6 }),
      ]) as Response,
    );

    render(<HistoryPage />);

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('8 / 10');
    expect(cards[1]).toHaveTextContent('5 / 10');
    expect(cards[0].compareDocumentPosition(cards[1])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test('convertit un timestamp UTC vers Europe/Paris', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('summer', '2026-07-15T12:00:00.000Z')]) as Response,
    );

    render(<HistoryPage />);

    expect(await screen.findByText(/15 juillet 2026/)).toBeInTheDocument();
    expect(screen.getByText(/14:00/)).toBeInTheDocument();
  });

  test('affiche desire, context et activity seulement lorsqu’ils existent', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('full', '2026-09-06T12:00:00.000Z', {
          desire: 7,
          context: 'Après une réunion',
          activity: 'work',
        }),
        entry('bare', '2026-09-06T11:00:00.000Z'),
      ]) as Response,
    );

    render(<HistoryPage />);

    const cards = await screen.findAllByRole('article');
    expect(cards[0]).toHaveTextContent('Envie');
    expect(cards[0]).toHaveTextContent('7 / 10');
    expect(cards[0]).toHaveTextContent('Travail');
    expect(cards[0]).toHaveTextContent('Après une réunion');
    expect(cards[1]).not.toHaveTextContent('Envie');
    expect(cards[1]).not.toHaveTextContent('Travail');
    expect(cards[1]).not.toHaveTextContent('Après une réunion');
  });

  test('affiche un état vide', async () => {
    vi.mocked(fetch).mockResolvedValue(ok([]) as Response);

    render(<HistoryPage />);

    expect(
      await screen.findByText(
        'Aucune entrée pour le moment. Tu peux revenir ici après une première saisie.',
      ),
    ).toBeInTheDocument();
  });

  test('affiche une erreur et permet de réessayer', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        ok([entry('a', '2026-09-06T12:00:00.000Z')]) as Response,
      );

    render(<HistoryPage />);

    expect(
      await screen.findByText('L’historique n’a pas pu être chargé.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('article')).toBeInTheDocument();
  });

  test('affiche Charger plus si pagination.total est supérieur aux entrées affichées', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('a', '2026-09-06T12:00:00.000Z')], 80) as Response,
    );

    render(<HistoryPage />);

    expect(
      await screen.findByRole('button', { name: 'Charger plus' }),
    ).toBeInTheDocument();
  });

  test('ajoute les nouvelles entrées sans doublon', async () => {
    const user = userEvent.setup();
    const first = entry('a', '2026-09-06T12:00:00.000Z', { energy: 8 });
    const overlap = entry('a', '2026-09-06T12:00:00.000Z', { energy: 8 });
    const extra = entry('b', '2026-09-06T11:00:00.000Z', { energy: 3 });

    vi.mocked(fetch)
      .mockResolvedValueOnce(ok([first], 2, 0) as Response)
      .mockResolvedValueOnce(ok([overlap, extra], 2, 1) as Response);

    render(<HistoryPage />);
    expect(await screen.findAllByRole('article')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Charger plus' }));

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain('offset=1');
  });

  test('conserve les entrées déjà affichées si Charger plus échoue', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        ok(
          [entry('a', '2026-09-06T12:00:00.000Z', { energy: 9 })],
          3,
        ) as Response,
      )
      .mockRejectedValueOnce(new Error('offline'));

    render(<HistoryPage />);
    expect(await screen.findByText('9 / 10')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Charger plus' }));

    expect(
      await screen.findByText(/La suite n’a pas pu être chargée/),
    ).toBeInTheDocument();
    expect(screen.getByText('9 / 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled();
  });
});
