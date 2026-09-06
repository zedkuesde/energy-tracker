import { HttpError, isActivity, type Activity } from '../types.js';
import { parseUtcInstant } from './timestamp.js';

export type CreateEntryInput = {
  timestamp: string;
  energy: number;
  fatigue: number;
  desire: number | null;
  context: string | null;
  activity: Activity | null;
};

function isScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 10
  );
}

function normalizeOptionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new HttpError(
      400,
      'validation_error',
      `${field} doit être une chaîne.`,
    );
  }
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeContext(value: unknown): string | null {
  const text = normalizeOptionalText(value, 'context');
  if (text === null) {
    return null;
  }
  const collapsed = text.replace(/\s+/g, ' ');
  if (collapsed.length > 280) {
    throw new HttpError(
      400,
      'validation_error',
      'context ne peut pas dépasser 280 caractères.',
    );
  }
  return collapsed;
}

export function parseCreateEntryBody(body: unknown): CreateEntryInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(
      400,
      'validation_error',
      'Le corps doit être un objet JSON.',
    );
  }

  const payload = body as Record<string, unknown>;

  if (!('energy' in payload)) {
    throw new HttpError(400, 'validation_error', 'energy est obligatoire.');
  }
  if (!('fatigue' in payload)) {
    throw new HttpError(400, 'validation_error', 'fatigue est obligatoire.');
  }
  if (!isScore(payload.energy)) {
    throw new HttpError(
      400,
      'validation_error',
      'energy doit être un entier entre 0 et 10.',
    );
  }
  if (!isScore(payload.fatigue)) {
    throw new HttpError(
      400,
      'validation_error',
      'fatigue doit être un entier entre 0 et 10.',
    );
  }

  let desire: number | null = null;
  if (payload.desire !== undefined && payload.desire !== null) {
    if (!isScore(payload.desire)) {
      throw new HttpError(
        400,
        'validation_error',
        'desire doit être un entier entre 0 et 10.',
      );
    }
    desire = payload.desire;
  }

  const context = normalizeContext(payload.context);

  let activity: Activity | null = null;
  if (payload.activity !== undefined && payload.activity !== null) {
    if (typeof payload.activity !== 'string') {
      throw new HttpError(400, 'validation_error', 'activity est invalide.');
    }
    const normalizedActivity = payload.activity.trim();
    if (normalizedActivity.length > 0) {
      if (!isActivity(normalizedActivity)) {
        throw new HttpError(400, 'validation_error', 'activity est invalide.');
      }
      activity = normalizedActivity;
    }
  }

  const now = new Date().toISOString();
  let timestamp = now;
  if (payload.timestamp !== undefined && payload.timestamp !== null) {
    if (
      typeof payload.timestamp !== 'string' ||
      payload.timestamp.trim() === ''
    ) {
      throw new HttpError(
        400,
        'validation_error',
        'timestamp doit être une date ISO 8601 avec fuseau explicite (Z ou offset).',
      );
    }
    const parsed = parseUtcInstant(payload.timestamp.trim());
    if (!parsed) {
      throw new HttpError(
        400,
        'validation_error',
        'timestamp doit être une date ISO 8601 avec fuseau explicite (Z ou offset).',
      );
    }
    timestamp = parsed;
  }

  return {
    timestamp,
    energy: payload.energy,
    fatigue: payload.fatigue,
    desire,
    context,
    activity,
  };
}

function parseBoundedInt(
  raw: string | undefined,
  field: string,
  fallback: number,
  min: number,
  max?: number,
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  if (!/^-?\d+$/.test(raw)) {
    throw new HttpError(
      400,
      'validation_error',
      `${field} doit être un entier.`,
    );
  }
  const value = Number(raw);
  if (value < min || (max !== undefined && value > max)) {
    const bounds =
      max === undefined
        ? `supérieur ou égal à ${min}`
        : `compris entre ${min} et ${max}`;
    throw new HttpError(
      400,
      'validation_error',
      `${field} doit être ${bounds}.`,
    );
  }
  return value;
}

export type ListEntriesQuery = {
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
};

export function parseListEntriesQuery(
  query: Record<string, string | undefined>,
): ListEntriesQuery {
  const limit = parseBoundedInt(query.limit, 'limit', 50, 1, 100);
  const offset = parseBoundedInt(query.offset, 'offset', 0, 0);

  const parseBound = (
    raw: string | undefined,
    field: string,
  ): string | null => {
    if (raw === undefined || raw === '') {
      return null;
    }
    const parsed = parseUtcInstant(raw);
    if (!parsed) {
      throw new HttpError(
        400,
        'validation_error',
        `${field} doit être une date ISO 8601 avec fuseau explicite (Z ou offset).`,
      );
    }
    return parsed;
  };

  const from = parseBound(query.from, 'from');
  const to = parseBound(query.to, 'to');

  if (from && to && from > to) {
    throw new HttpError(
      400,
      'validation_error',
      'from ne peut pas être postérieur à to.',
    );
  }

  return { from, to, limit, offset };
}
