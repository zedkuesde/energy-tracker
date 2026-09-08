import { afterEach, describe, expect, test, vi } from 'vitest';
import { registerServiceWorker } from './register-service-worker';

describe('registerServiceWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('n’enregistre rien hors production', () => {
    const register = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { register },
    });

    registerServiceWorker(false);

    expect(register).not.toHaveBeenCalled();
  });

  test('enregistre /sw.js en production quand l’API est disponible', () => {
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { register },
    });

    registerServiceWorker(true);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  test('ne lève pas si serviceWorker est absent', () => {
    vi.stubGlobal('navigator', { serviceWorker: undefined });

    expect(() => registerServiceWorker(true)).not.toThrow();
  });
});
