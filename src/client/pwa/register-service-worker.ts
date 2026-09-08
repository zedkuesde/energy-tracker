export function registerServiceWorker(enabled = import.meta.env.PROD): void {
  if (!enabled || !navigator.serviceWorker) {
    return;
  }

  void navigator.serviceWorker.register('/sw.js').catch(() => {
    // L’installation PWA reste optionnelle : l’app doit fonctionner sans SW.
  });
}
