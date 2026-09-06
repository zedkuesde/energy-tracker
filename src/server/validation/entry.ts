import { HttpError, isActivity, type Activity } from '../types.js';
import { parseUtcInstant } from './timestamp.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PATCH_FIELDS = new Set([
  'timestamp',
  'energy',
  'fatigue',
  'desire',
  'context',
  'activity',
]);

export type CreateEntryInput = {
  timestamp: string;
  energy: number;
  fatigue: number;
  desire: number | null;
  context: string | null;
  activity: Activity | null;
};

export type PatchEntryInput = {
  timestamp?: string;
  energy?: number;
  fatigue?: number;
  desire?: number | null;
  context?: string | null;
  activity?: Activity | null;
};

export function parseEntryId(id: unknown): string {
  if (typeof id !== 'string' || !UUID_V4.test(id)) {
    throw new HttpError(
      400,
      'validation_error',
      'id doit être un UUID v4 valide.',
    );
  }
  return id;
}

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
    timestamp = parseRequiredTimestamp(payload.timestamp);
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

export function parsePatchEntryBody(body: unknown): PatchEntryInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(
      400,
      'validation_error',
      'Le corps doit être un objet JSON.',
    );
  }

  const payload = body as Record<string, unknown>;
  const keys = Object.keys(payload);
  if (keys.length === 0) {
    throw new HttpError(
      400,
      'validation_error',
      'Le corps doit contenir au moins un champ modifiable.',
    );
  }

  for (const key of keys) {
    if (!PATCH_FIELDS.has(key)) {
      throw new HttpError(
        400,
        'validation_error',
        'Le corps contient un champ non autorisé.',
      );
    }
  }

  const patch: PatchEntryInput = {};

  if ('energy' in payload) {
    if (!isScore(payload.energy)) {
      throw new HttpError(
        400,
        'validation_error',
        'energy doit être un entier entre 0 et 10.',
      );
    }
    patch.energy = payload.energy;
  }

  if ('fatigue' in payload) {
    if (!isScore(payload.fatigue)) {
      throw new HttpError(
        400,
        'validation_error',
        'fatigue doit être un entier entre 0 et 10.',
      );
    }
    patch.fatigue = payload.fatigue;
  }

  if ('desire' in payload) {
    if (payload.desire === null) {
      patch.desire = null;
    } else if (!isScore(payload.desire)) {
      throw new HttpError(
        400,
        'validation_error',
        'desire doit être un entier entre 0 et 10.',
      );
    } else {
      patch.desire = payload.desire;
    }
  }

  if ('context' in payload) {
    patch.context = normalizeContext(payload.context);
  }

  if ('activity' in payload) {
    if (payload.activity === null) {
      patch.activity = null;
    } else if (typeof payload.activity !== 'string') {
      throw new HttpError(400, 'validation_error', 'activity est invalide.');
    } else {
      const normalizedActivity = payload.activity.trim();
      if (normalizedActivity.length === 0) {
        patch.activity = null;
      } else if (!isActivity(normalizedActivity)) {
        throw new HttpError(400, 'validation_error', 'activity est invalide.');
      } else {
        patch.activity = normalizedActivity;
      }
    }
  }

  if ('timestamp' in payload) {
    patch.timestamp = parseRequiredTimestamp(payload.timestamp);
  }

  return patch;
}

export function applyEntryPatch<T extends CreateEntryInput>(
  existing: T,
  patch: PatchEntryInput,
): T {
  const next = { ...existing, ...patch };
  if (!isScore(next.energy) || !isScore(next.fatigue)) {
    throw new HttpError(
      400,
      'validation_error',
      'energy et fatigue sont obligatoires.',
    );
  }
  return next;
}

function parseRequiredTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(
      400,
      'validation_error',
      'timestamp doit être une date ISO 8601 avec fuseau explicite (Z ou offset).',
    );
  }
  const parsed = parseUtcInstant(value.trim());
  if (!parsed) {
    throw new HttpError(
      400,
      'validation_error',
      'timestamp doit être une date ISO 8601 avec fuseau explicite (Z ou offset).',
    );
  }
  return parsed;
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
