export const ACTIVITIES = [
  'rest',
  'work',
  'transport',
  'leisure',
  'creative',
  'sport',
  'other',
] as const;

export type Activity = (typeof ACTIVITIES)[number];

export type EnergyEntry = {
  id: string;
  timestamp: string;
  energy: number;
  fatigue: number;
  desire: number | null;
  context: string | null;
  activity: Activity | null;
  created_at: string;
  updated_at: string;
};

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    sessionId?: string;
  }
  interface FastifyInstance {
    sqlite: import('./db.js').SqliteDatabase;
  }
}

export function isActivity(value: string): value is Activity {
  return (ACTIVITIES as readonly string[]).includes(value);
}
