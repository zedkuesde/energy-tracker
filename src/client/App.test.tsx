import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

function json(ok: boolean, body: unknown, status = ok ? 200 : 401) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App authentification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('route applicative sans session redirige vers /login', async () => {
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

    renderAt('/');
    expect(
      await screen.findByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).toBeInTheDocument();
  });

  test('accès direct à /history sans session redirige vers /login', async () => {
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

    renderAt('/history');
    expect(
      await screen.findByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Historique' }),
    ).not.toBeInTheDocument();
  });

  test('route applicative avec session valide s’affiche', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        if (String(input) === '/api/auth/session') {
          return json(true, { data: { authenticated: true } });
        }
        return json(false, {}, 500);
      }),
    );

    renderAt('/');
    expect(
      await screen.findByRole('heading', {
        name: 'Comment tu te sens maintenant ?',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Se déconnecter' }),
    ).toBeInTheDocument();
  });

  test('logout appelle l’API, vide l’état et redirige vers /login', async () => {
    const user = userEvent.setup();
    let authenticated = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/auth/session') {
          return authenticated
            ? json(true, { data: { authenticated: true } })
            : json(false, {
                error: {
                  code: 'unauthenticated',
                  message: 'Authentification requise.',
                },
              });
        }
        if (url === '/api/auth/logout' && init?.method === 'POST') {
          authenticated = false;
          return { ok: true, status: 204 };
        }
        if (url.startsWith('/api/entries')) {
          return json(true, {
            data: [
              {
                id: 'a',
                timestamp: '2026-09-06T16:00:00.000Z',
                energy: 6,
                fatigue: 4,
                desire: null,
                context: 'note sensible',
                activity: null,
                created_at: '2026-09-06T16:00:00.000Z',
                updated_at: '2026-09-06T16:00:00.000Z',
              },
            ],
            pagination: { limit: 50, offset: 0, total: 1 },
          });
        }
        return json(false, {}, 500);
      }),
    );

    renderAt('/history');
    expect(await screen.findByText('note sensible')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(
      await screen.findByRole('heading', { name: 'Accès à Energy Tracker' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('note sensible')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
  });
});
