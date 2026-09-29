import type { ReminderStore } from './store.js';
import {
  payloadForKind,
  pushOptionsForKind,
  sendReminderPush,
  type PushSendOptions,
  type ReminderPayload,
} from './push.js';

export type ReminderSendFn = (
  subscription: Parameters<typeof sendReminderPush>[0],
  payload?: ReminderPayload,
  options?: PushSendOptions,
) => ReturnType<typeof sendReminderPush>;

export type ReminderSchedulerOptions = {
  store: ReminderStore;
  intervalMs?: number;
  enabled?: boolean;
  now?: () => Date;
  send?: ReminderSendFn;
  onError?: (error: unknown) => void;
};

export type ReminderScheduler = {
  tick: () => Promise<{ sentUsers: number; removedSubscriptions: number }>;
  start: () => void;
  stop: () => void;
};

const DEFAULT_INTERVAL_MS = 60_000;

export function createReminderScheduler(
  options: ReminderSchedulerOptions,
): ReminderScheduler {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options.enabled ?? true;
  const now = options.now ?? (() => new Date());
  const send = options.send ?? sendReminderPush;
  const onError = options.onError ?? (() => undefined);

  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;

  async function tick(): Promise<{
    sentUsers: number;
    removedSubscriptions: number;
  }> {
    if (!enabled) {
      return { sentUsers: 0, removedSubscriptions: 0 };
    }
    if (running) {
      return { sentUsers: 0, removedSubscriptions: 0 };
    }
    running = true;
    let sentUsers = 0;
    let removedSubscriptions = 0;

    try {
      const instant = now();
      const due = options.store.listDueReminders(instant);
      for (const reminder of due) {
        let delivered = false;
        const payload = payloadForKind(reminder.kind);
        const pushOptions = pushOptionsForKind(reminder.kind);
        for (const subscription of reminder.subscriptions) {
          const result = await send(subscription, payload, pushOptions);
          if (result.ok) {
            delivered = true;
            continue;
          }
          if (result.invalid) {
            options.store.removeSubscriptionById(subscription.id);
            removedSubscriptions += 1;
          }
        }
        if (delivered) {
          const losers = options.store.listCollisionLosers(
            reminder.userId,
            reminder,
            instant,
          );
          options.store.markKindSent(reminder.userId, reminder.kind, instant);
          for (const loser of losers) {
            options.store.markKindSent(reminder.userId, loser, instant);
          }
          sentUsers += 1;
        }
      }
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }

    return { sentUsers, removedSubscriptions };
  }

  function start(): void {
    if (!enabled || timer) {
      return;
    }
    void tick();
    timer = setInterval(() => {
      void tick();
    }, intervalMs);
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  return { tick, start, stop };
}
