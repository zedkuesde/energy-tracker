export type ReminderSettings = {
  enabled: boolean;
  timeHhmm: string;
  lowEnergyEnabled: boolean;
  absenceEnabled: boolean;
  timezone: string;
  subscriptionCount: number;
  pushConfigured: boolean;
  vapidPublicKey: string | null;
};

export type ReminderErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export class ReminderRequestError extends Error {
  readonly kind: 'network' | 'api';
  readonly code?: string;
  readonly status?: number;

  constructor(
    kind: 'network' | 'api',
    options: { code?: string; status?: number; message?: string } = {},
  ) {
    super(options.message ?? kind);
    this.name = 'ReminderRequestError';
    this.kind = kind;
    this.code = options.code;
    this.status = options.status;
  }
}

const sameOrigin: RequestInit = {
  credentials: 'same-origin',
};

async function readError(
  response: Response,
): Promise<ReminderErrorBody['error']> {
  try {
    const body = (await response.json()) as ReminderErrorBody;
    if (body?.error?.code && body.error.message) {
      return body.error;
    }
  } catch {
    // ignore
  }
  return {
    code: 'api_error',
    message: 'La requête n’a pas abouti.',
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...sameOrigin, ...init });
  } catch {
    throw new ReminderRequestError('network');
  }

  if (!response.ok) {
    const error = await readError(response);
    throw new ReminderRequestError('api', {
      code: error.code,
      status: response.status,
      message: error.message,
    });
  }

  return (await response.json()) as T;
}

export async function fetchReminders(): Promise<ReminderSettings> {
  const body = await requestJson<{ data: ReminderSettings }>('/api/reminders');
  return body.data;
}

export async function saveReminders(input: {
  enabled: boolean;
  timeHhmm: string;
  lowEnergyEnabled: boolean;
  absenceEnabled: boolean;
}): Promise<ReminderSettings> {
  const body = await requestJson<{ data: ReminderSettings }>('/api/reminders', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function subscribePush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  await requestJson('/api/reminders/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await requestJson('/api/reminders/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
}
