import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LogPage } from './LogPage';

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

describe('LogPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('le bouton Enregistrer est désactivé sans énergie ou sans fatigue', () => {
    render(<LogPage />);
    expect(
      screen.getByText('Quelques secondes pour faire le point.'),
    ).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Enregistrer' });
    expect(submit).toBeDisabled();

    setScore('Énergie', 120);
    expect(submit).toBeDisabled();
  });

  test('le bouton Enregistrer est activé lorsque énergie et fatigue sont définies', () => {
    render(<LogPage />);
    setScore('Énergie', 120);
    setScore('Fatigue', 80);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  test('l’envie est absente au chargement', () => {
    render(<LogPage />);
    expect(
      screen.getByRole('button', { name: 'Ajouter l’envie' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('slider', { name: /Envie/ }),
    ).not.toBeInTheDocument();
  });

  test('on peut ajouter puis retirer l’envie', async () => {
    const user = userEvent.setup();
    render(<LogPage />);

    await user.click(screen.getByRole('button', { name: 'Ajouter l’envie' }));
    expect(screen.getByRole('slider', { name: /Envie/ })).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Retirer' }));
    expect(
      screen.queryByRole('slider', { name: /Envie/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ajouter l’envie' }),
    ).toBeInTheDocument();
  });

  test('le contexte reste facultatif', () => {
    render(<LogPage />);
    const context = screen.getByLabelText(/Contexte/);
    expect(context).toHaveValue('');
    expect(screen.getByText('0 / 280')).toBeInTheDocument();
  });

  test('une activité se sélectionne et se désélectionne', async () => {
    const user = userEvent.setup();
    render(<LogPage />);
    const rest = screen.getByRole('button', { name: 'Repos' });

    await user.click(rest);
    expect(rest).toHaveAttribute('aria-pressed', 'true');

    await user.click(rest);
    expect(rest).toHaveAttribute('aria-pressed', 'false');
  });

  test('le payload envoyé est conforme à l’API', async () => {
    const user = userEvent.setup();
    render(<LogPage />);
    setScore('Énergie', 120);
    setScore('Fatigue', 80);
    await user.click(screen.getByRole('button', { name: 'Ajouter l’envie' }));
    setScore(/Envie/, 100);
    await user.type(screen.getByLabelText(/Contexte/), 'Après une pause');
    await user.click(screen.getByRole('button', { name: 'Travail' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    expect(fetch).toHaveBeenCalledWith('/api/entries', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        energy: 6,
        fatigue: 4,
        desire: 5,
        context: 'Après une pause',
        activity: 'work',
      }),
    });
  });

  test('succès : confirmation et réinitialisation', async () => {
    const user = userEvent.setup();
    render(<LogPage />);
    setScore('Énergie', 120);
    setScore('Fatigue', 80);
    await user.type(screen.getByLabelText(/Contexte/), 'Note');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Enregistré.');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(screen.getByLabelText(/Contexte/)).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Ajouter l’envie' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  test('erreur API : message clair et valeurs conservées', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      }),
    );
    const user = userEvent.setup();
    render(<LogPage />);
    setScore('Énergie', 120);
    setScore('Fatigue', 80);
    await user.type(screen.getByLabelText(/Contexte/), 'Note conservée');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Cette saisie n'a pas pu être enregistrée. Tes valeurs sont encore là.",
    );
    expect(screen.getByLabelText(/Contexte/)).toHaveValue('Note conservée');
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  test('erreur réseau : message clair et valeurs conservées', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const user = userEvent.setup();
    render(<LogPage />);
    setScore('Énergie', 120);
    setScore('Fatigue', 80);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "L'enregistrement n'a pas abouti. Tes valeurs sont encore là.",
    );
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('empêche un double envoi pendant la requête', async () => {
    let finishRequest:
      ((value: { ok: boolean; status: number }) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            finishRequest = resolve;
          }),
      ),
    );
    const user = userEvent.setup();
    render(<LogPage />);
    setScore('Énergie', 120);
    setScore('Fatigue', 80);

    const submit = screen.getByRole('button', { name: 'Enregistrer' });
    await user.click(submit);
    await user.click(submit);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Enregistrement…' }),
    ).toBeDisabled();

    finishRequest?.({ ok: true, status: 201 });
    expect(await screen.findByRole('status')).toHaveTextContent('Enregistré.');
  });
});
