import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchSession, login, logout } from './auth';

describe('api auth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('login envoie l’email et le mot de passe en JSON same-origin', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { authenticated: true } }),
    } as Response);

    await login('lucas@example.test', 'secret-de-test');
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      credentials: 'same-origin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lucas@example.test',
        password: 'secret-de-test',
      }),
    });
  });

  test('fetchSession retourne false sur 401', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);
    await expect(fetchSession()).resolves.toBe(false);
  });

  test('logout appelle POST /api/auth/logout', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);
    await logout();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
      credentials: 'same-origin',
      method: 'POST',
    });
  });
});
