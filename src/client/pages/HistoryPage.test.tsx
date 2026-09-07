import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

function jsonOk(data: EnergyEntry) {
  return {
    ok: true,
    json: async () => ({ data }),
  };
}

function mockSliderRect(element: HTMLElement, width = 200) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 44,
    width,
    height: 44,
    toJSON() {
      return {};
    },
  });
}

function setScore(name: string | RegExp, clientX: number) {
  const slider = screen.getByRole('slider', { name });
  mockSliderRect(slider);
  fireEvent.pointerDown(slider, { clientX });
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    expect(cards[0].querySelector('.entry-energy')).toHaveTextContent('8');
    expect(cards[1].querySelector('.entry-energy')).toHaveTextContent('5');
    expect(cards[0].compareDocumentPosition(cards[1])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test('convertit un timestamp UTC vers Europe/Paris', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('summer', '2026-07-15T12:00:00.000Z')]) as Response,
    );

    render(<HistoryPage />);

    expect(await screen.findByText(/15 juillet/)).toBeInTheDocument();
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
    expect(cards[0].querySelector('.entry-desire')).toHaveTextContent('7');
    expect(cards[0]).toHaveTextContent('Travail');
    expect(cards[0]).toHaveTextContent('Après une réunion');
    expect(cards[0].querySelectorAll('.entry-scores > div')).toHaveLength(3);
    expect(cards[1]).not.toHaveTextContent('Envie');
    expect(cards[1].querySelector('.entry-desire')).toBeNull();
    expect(cards[1].querySelectorAll('.entry-scores > div')).toHaveLength(2);
    expect(cards[1]).toHaveTextContent('Énergie');
    expect(cards[1]).toHaveTextContent('Fatigue');
    expect(cards[1]).not.toHaveTextContent('Travail');
    expect(cards[1]).not.toHaveTextContent('Après une réunion');
  });

  test('n’affiche aucune colonne Envie lorsque desire est null', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('bare', '2026-09-06T16:40:00.000Z', {
          energy: 7,
          fatigue: 4,
          desire: null,
        }),
      ]) as Response,
    );

    render(<HistoryPage />);

    const card = await screen.findByRole('article');
    const scores = card.querySelector('.entry-scores');
    expect(scores).toHaveClass('entry-scores-two');
    expect(scores?.children).toHaveLength(2);
    expect(within(card).queryByText('Envie')).not.toBeInTheDocument();
    expect(card.querySelector('.entry-desire')).toBeNull();
    expect(within(card).getByText('Énergie')).toBeInTheDocument();
    expect(within(card).getByText('Fatigue')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('/ 10');
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
    expect(await screen.findByText('9')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Charger plus' }));

    expect(
      await screen.findByText(/La suite n’a pas pu être chargée/),
    ).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled();
  });

  test('affiche les actions Modifier et Supprimer', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('a', '2026-09-06T12:00:00.000Z')]) as Response,
    );

    render(<HistoryPage />);

    expect(
      await screen.findByRole('button', { name: 'Modifier' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Supprimer' }),
    ).toBeInTheDocument();
  });

  test('Modifier ouvre le panneau prérempli, sans envie si elle était absente', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      ok([
        entry('a', '2026-09-06T16:00:00.000Z', {
          energy: 8,
          fatigue: 2,
          context: 'pause',
          activity: 'rest',
        }),
      ]) as Response,
    );

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Modifier' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Modifier l’entrée',
    });
    expect(within(dialog).getByRole('slider', { name: 'Énergie' })).toHaveValue(
      '8',
    );
    expect(within(dialog).getByRole('slider', { name: 'Fatigue' })).toHaveValue(
      '2',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Ajouter l’envie' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('slider', { name: /Envie/ }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Contexte/)).toHaveValue('pause');
    expect(
      within(dialog).getByRole('button', { name: 'Repos' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByText(/6 septembre 2026/)).toBeInTheDocument();
  });

  test('modification réussie : PATCH, confirmation et carte mise à jour', async () => {
    const user = userEvent.setup();
    const original = entry('a', '2026-09-06T16:00:00.000Z', {
      energy: 6,
      fatigue: 4,
    });
    const updated = {
      ...original,
      energy: 8,
      fatigue: 4,
      updated_at: '2026-09-06T16:05:00.000Z',
    };

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const method = init?.method ?? 'GET';
      if (method === 'PATCH') {
        return jsonOk(updated) as Response;
      }
      return ok([original]) as Response;
    });

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Modifier' }));
    setScore('Énergie', 160);
    await user.click(
      screen.getByRole('button', { name: 'Enregistrer les modifications' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Modifications enregistrées.',
    );
    expect(
      screen.getByRole('article').querySelector('.entry-energy'),
    ).toHaveTextContent('8');
    const patchCall = vi
      .mocked(fetch)
      .mock.calls.find((call) => call[1]?.method === 'PATCH');
    expect(patchCall?.[0]).toBe('/api/entries/a');
    expect(patchCall?.[1]).toEqual({
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ energy: 8, fatigue: 4 }),
    });
    expect(JSON.stringify(patchCall?.[1]?.body)).not.toContain('timestamp');
  });

  test('erreur PATCH : valeurs conservées et message affiché', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      if (init?.method === 'PATCH') {
        return { ok: false, status: 500 } as Response;
      }
      return ok([
        entry('a', '2026-09-06T16:00:00.000Z', { context: 'note conservée' }),
      ]) as Response;
    });

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Modifier' }));
    const context = screen.getByLabelText(/Contexte/);
    await user.clear(context);
    await user.type(context, 'nouvelle note');
    await user.click(
      screen.getByRole('button', { name: 'Enregistrer les modifications' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Cette saisie n'a pas pu être mise à jour. Tes valeurs sont encore là.",
    );
    expect(screen.getByLabelText(/Contexte/)).toHaveValue('nouvelle note');
    expect(
      screen.getByRole('button', { name: 'Enregistrer les modifications' }),
    ).toBeEnabled();
  });

  test('Annuler la modification ne lance aucun PATCH', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('a', '2026-09-06T16:00:00.000Z')]) as Response,
    );

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Modifier' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Modifier l’entrée' }),
      ).not.toBeInTheDocument();
    });
    expect(
      vi.mocked(fetch).mock.calls.every((call) => call[1]?.method !== 'PATCH'),
    ).toBe(true);
  });

  test('Supprimer ouvre une confirmation et Annuler ne fait aucun DELETE', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('a', '2026-09-06T16:00:00.000Z')]) as Response,
    );

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));

    const dialog = (await screen.findByRole('dialog', {
      name: 'Supprimer cette entrée ?',
    })) as HTMLDialogElement;
    expect(dialog).toHaveTextContent('Cette action est définitive.');
    expect(dialog).toHaveAttribute('open');
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    await waitFor(() => {
      expect(dialog).not.toHaveAttribute('open');
    });
    expect(dialog.open).toBe(false);
    expect(
      screen.queryByRole('dialog', { name: 'Supprimer cette entrée ?' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.every((call) => call[1]?.method !== 'DELETE'),
    ).toBe(true);
  });

  test('confirmation Supprimer appelle DELETE et retire la carte', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      if (init?.method === 'DELETE') {
        return { ok: true, status: 204 } as Response;
      }
      return ok([entry('a', '2026-09-06T16:00:00.000Z')], 1) as Response;
    });

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));
    const dialog = (await screen.findByRole('dialog', {
      name: 'Supprimer cette entrée ?',
    })) as HTMLDialogElement;
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Entrée supprimée.',
    );
    expect(dialog).not.toHaveAttribute('open');
    expect(dialog.open).toBe(false);
    expect(
      screen.queryByRole('dialog', { name: 'Supprimer cette entrée ?' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/entries/a', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
  });

  test('erreur DELETE : carte conservée et erreur affichée', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      if (init?.method === 'DELETE') {
        return { ok: false, status: 500 } as Response;
      }
      return ok([entry('a', '2026-09-06T16:00:00.000Z')]) as Response;
    });

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));
    const dialog = (await screen.findByRole('dialog', {
      name: 'Supprimer cette entrée ?',
    })) as HTMLDialogElement;
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Cette entrée n'a pas pu être supprimée. Tu peux réessayer.",
    );
    expect(dialog).toHaveAttribute('open');
    expect(dialog.open).toBe(true);
    expect(
      screen.getByRole('dialog', { name: 'Supprimer cette entrée ?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Supprimer' }),
    ).toBeEnabled();
  });

  test('aucune suppression sans confirmation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('a', '2026-09-06T16:00:00.000Z')]) as Response,
    );

    render(<HistoryPage />);
    await screen.findByRole('article');

    expect(
      vi.mocked(fetch).mock.calls.every((call) => call[1]?.method !== 'DELETE'),
    ).toBe(true);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  test('Escape ferme le dialogue de confirmation et réinitialise l’état', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      ok([entry('a', '2026-09-06T16:00:00.000Z')]) as Response,
    );

    render(<HistoryPage />);
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));
    const dialog = (await screen.findByRole('dialog', {
      name: 'Supprimer cette entrée ?',
    })) as HTMLDialogElement;
    expect(dialog.open).toBe(true);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(dialog.open).toBe(false);
    });
    expect(dialog).not.toHaveAttribute('open');
    expect(
      screen.queryByRole('dialog', { name: 'Supprimer cette entrée ?' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.every((call) => call[1]?.method !== 'DELETE'),
    ).toBe(true);
  });
});
