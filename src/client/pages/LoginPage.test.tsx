import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { LoginPage } from './LoginPage';

function anonymousSession() {
  return {
    ok: false,
    status: 401,
    json: async () => ({
      error: { code: 'unauthenticated', message: 'Authentification requise.' },
    }),
  } as Response;
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Page saisie</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        if (String(input) === '/api/auth/session') {
          return anonymousSession();
        }
        return { ok: false, status: 500 } as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('la route /login est accessible sans session', async () => {
    renderLogin();
    expect(
      await screen.findByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Energy Tracker' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
  });

  test('soumission réussie appelle login puis redirige vers /', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/auth/session') {
        return anonymousSession();
      }
      if (String(input) === '/api/auth/login' && init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { authenticated: true } }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    renderLogin();
    await screen.findByRole('heading', { name: 'Accès à Energy Tracker' });
    await user.type(screen.getByLabelText('Mot de passe'), 'secret-de-test');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Page saisie')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  test('mauvais mot de passe affiche une erreur calme', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/auth/session') {
        return anonymousSession();
      }
      if (String(input) === '/api/auth/login') {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: 'invalid_credentials',
              message: 'Identifiants invalides.',
            },
          }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    renderLogin();
    await screen.findByLabelText('Mot de passe');
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Identifiants invalides.',
    );
    expect(
      screen.getByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).toBeInTheDocument();
  });

  test('bouton désactivé pendant la requête', async () => {
    const user = userEvent.setup();
    let finishRequest: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/auth/session') {
        return anonymousSession();
      }
      if (String(input) === '/api/auth/login' && init?.method === 'POST') {
        return new Promise((resolve) => {
          finishRequest = resolve;
        });
      }
      return { ok: false, status: 500 } as Response;
    });

    renderLogin();
    await screen.findByLabelText('Mot de passe');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret-de-test');
    const submit = screen.getByRole('button', { name: 'Se connecter' });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Connexion…' })).toBeDisabled();
    });
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter((call) => String(call[0]) === '/api/auth/login'),
    ).toHaveLength(1);

    finishRequest?.({ ok: true, status: 200 } as Response);
    expect(await screen.findByText('Page saisie')).toBeInTheDocument();
  });

  test('aucun mot de passe n’est enregistré dans le stockage local', async () => {
    const user = userEvent.setup();
    renderLogin();
    await screen.findByLabelText('Mot de passe');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret-de-test');

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(localStorage)).not.toContain('secret-de-test');
    expect(JSON.stringify(sessionStorage)).not.toContain('secret-de-test');
  });
});
