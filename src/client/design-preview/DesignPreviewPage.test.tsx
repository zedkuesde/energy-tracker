import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App, MvpApp } from '../App';

function json(ok: boolean, body: unknown, status = ok ? 200 : 401) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe('maquette /design-preview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('en développement, la route est publique et n’appelle pas l’API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/design-preview']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Aperçu visuel — aucune donnée réelle'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Comment tu te sens maintenant ?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Quelques secondes pour faire le point.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Energy Tracker' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Se déconnecter' }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('le sélecteur d’atelier affiche les cinq vues de maquette', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MemoryRouter initialEntries={['/design-preview']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Valeurs d’exemple — démo visuelle.'),
    ).toBeInTheDocument();

    const loisir = screen.getByRole('button', { name: 'Loisir' });
    expect(loisir).toHaveAttribute('aria-pressed', 'true');
    await user.click(loisir);
    expect(loisir).toHaveAttribute('aria-pressed', 'false');
    await user.click(loisir);
    expect(loisir).toHaveAttribute('aria-pressed', 'true');

    const atelier = screen.getByRole('navigation', {
      name: 'Écrans de maquette',
    });

    await user.click(
      within(atelier).getByRole('button', { name: 'Historique' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Historique' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Entrée enregistrée.')).toBeInTheDocument();
    expect(screen.getByText('18:40')).toBeInTheDocument();
    expect(screen.getAllByText('/ Énergie').length).toBeGreaterThan(0);
    expect(screen.getByText('Exemple d’état vide')).toBeInTheDocument();
    const noonMoment = screen.getByText('12:10').closest('article');
    expect(noonMoment).not.toBeNull();
    expect(
      within(noonMoment as HTMLElement).queryByText('/ Envie'),
    ).not.toBeInTheDocument();

    await user.click(within(atelier).getByRole('button', { name: 'Graphes' }));
    expect(
      screen.getByRole('heading', { name: 'Graphes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Exemple de graphe sur 7 jours/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Samedi 21:15')).toBeInTheDocument();
    expect(
      screen.queryByText('Observations ponctuelles — données fictives.'),
    ).not.toBeInTheDocument();

    await user.click(
      within(atelier).getByRole('button', { name: 'Connexion' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('');
    expect(screen.getByText('Identifiants invalides.')).toBeInTheDocument();

    await user.click(
      within(atelier).getByRole('button', { name: 'Dialogues' }),
    );
    expect(
      screen.queryByRole('heading', { name: 'Dialogues' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Modifier l’entrée' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Supprimer cette entrée ?' }),
    ).toBeInTheDocument();
  });

  test('hors développement, /design-preview sans session renvoie vers la connexion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        if (String(input) === '/api/auth/session') {
          return json(false, {
            error: {
              code: 'unauthenticated',
              message: 'Authentification requise.',
            },
          });
        }
        return json(false, {}, 500);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/design-preview']}>
        <MvpApp />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Aperçu visuel — aucune donnée réelle'),
    ).not.toBeInTheDocument();
  });
});
