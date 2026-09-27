import webpush from 'web-push';
import type { VapidConfig } from '../config.js';
import type { PushSubscriptionRecord } from './store.js';

export const REMINDER_NOTIFICATION = {
  title: 'Energy Tracker',
  body: 'Petit rappel pour une saisie, si tu veux.',
  data: { url: '/' },
} as const;

export type PushSendResult =
  | { ok: true }
  | { ok: false; invalid: boolean; statusCode?: number; message: string };

export function configureWebPush(vapid: VapidConfig): void {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
}

export async function sendReminderPush(
  subscription: PushSubscriptionRecord,
  payload: typeof REMINDER_NOTIFICATION = REMINDER_NOTIFICATION,
): Promise<PushSendResult> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined;
    const message = error instanceof Error ? error.message : 'push_failed';
    const invalid = statusCode === 404 || statusCode === 410;
    return { ok: false, invalid, statusCode, message };
  }
}
