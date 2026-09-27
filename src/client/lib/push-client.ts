function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export type PushSupport =
  | { supported: false; reason: 'unsupported' }
  | { supported: false; reason: 'insecure' }
  | { supported: true };

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'unsupported' };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: 'insecure' };
  }
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return { supported: false, reason: 'unsupported' };
  }
  return { supported: true };
}

export function notificationPermission():
  NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function ensurePushSubscription(
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}

export function subscriptionToPayload(subscription: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('Abonnement push incomplet.');
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh, auth },
  };
}
