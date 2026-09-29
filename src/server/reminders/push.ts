import webpush from 'web-push';
import type { VapidConfig } from '../config.js';
import { SMART_PUSH_TTL_SECONDS } from './low-energy-followup.js';
import type { PushSubscriptionRecord } from './store.js';

export const REMINDER_NOTIFICATION = {
  title: 'Energy Tracker',
  body: 'Petit rappel pour une saisie, si tu veux.',
  data: { url: '/' },
} as const;

export const LOW_ENERGY_NOTIFICATION = {
  title: 'Relance énergie',
  body: 'Comment évolue ton énergie ? Tu peux faire une nouvelle saisie.',
  data: { url: '/' },
} as const;

export const ABSENCE_NOTIFICATION = {
  title: 'Rappel du jour',
  body: 'Tu n’as pas encore noté ton énergie aujourd’hui.',
  data: { url: '/' },
} as const;

export type ReminderPayload =
  | typeof REMINDER_NOTIFICATION
  | typeof LOW_ENERGY_NOTIFICATION
  | typeof ABSENCE_NOTIFICATION;

export type PushSendOptions = {
  TTL?: number;
};

export type PushSendResult =
  | { ok: true }
  | { ok: false; invalid: boolean; statusCode?: number; message: string };

export function configureWebPush(vapid: VapidConfig): void {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
}

export async function sendReminderPush(
  subscription: PushSubscriptionRecord,
  payload: ReminderPayload = REMINDER_NOTIFICATION,
  options?: PushSendOptions,
): Promise<PushSendResult> {
  try {
    if (options && options.TTL !== undefined) {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(payload),
        { TTL: options.TTL },
      );
    } else {
      // Fixed V1 path: no options object → library default TTL (~4 weeks).
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
    }
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

export function payloadForKind(
  kind: 'fixed' | 'low_energy' | 'absence',
): ReminderPayload {
  if (kind === 'low_energy') {
    return LOW_ENERGY_NOTIFICATION;
  }
  if (kind === 'absence') {
    return ABSENCE_NOTIFICATION;
  }
  return REMINDER_NOTIFICATION;
}

export function pushOptionsForKind(
  kind: 'fixed' | 'low_energy' | 'absence',
): PushSendOptions | undefined {
  if (kind === 'fixed') {
    return undefined;
  }
  return { TTL: SMART_PUSH_TTL_SECONDS };
}
