import type { ReminderStore } from './store.js';
import { sendReminderPush } from './push.js';

export type ReminderSchedulerOptions = {
  store: ReminderStore;
  intervalMs?: number;
  enabled?: boolean;
  now?: () => Date;
  send?: typeof sendReminderPush;
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
      const due = options.store.listDueReminders(now());
      for (const reminder of due) {
        let delivered = false;
        for (const subscription of reminder.subscriptions) {
          const result = await send(subscription);
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
          options.store.markReminderSent(reminder.userId, now());
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
