import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../db.js';
import type { EnergyEntry } from '../types.js';
import { HttpError } from '../types.js';
import {
  applyEntryPatch,
  parseCreateEntryBody,
  parseEntryId,
  parseListEntriesQuery,
  parsePatchEntryBody,
} from '../validation/entry.js';

type EntryRow = EnergyEntry;

export function registerEntryRoutes(
  app: FastifyInstance,
  db: SqliteDatabase,
): void {
  const insert = db.prepare(`
    INSERT INTO energy_entries (
      id, timestamp, energy, fatigue, desire, context, activity, created_at, updated_at
    ) VALUES (
      @id, @timestamp, @energy, @fatigue, @desire, @context, @activity, @created_at, @updated_at
    )
  `);

  const selectPage = db.prepare(`
    SELECT id, timestamp, energy, fatigue, desire, context, activity, created_at, updated_at
    FROM energy_entries
    WHERE (@from IS NULL OR timestamp >= @from)
      AND (@to IS NULL OR timestamp <= @to)
    ORDER BY timestamp DESC, id DESC
    LIMIT @limit OFFSET @offset
  `);

  const countPage = db.prepare(`
    SELECT COUNT(*) AS total
    FROM energy_entries
    WHERE (@from IS NULL OR timestamp >= @from)
      AND (@to IS NULL OR timestamp <= @to)
  `);

  const selectById = db.prepare(`
    SELECT id, timestamp, energy, fatigue, desire, context, activity, created_at, updated_at
    FROM energy_entries
    WHERE id = @id
  `);

  const updateById = db.prepare(`
    UPDATE energy_entries
    SET
      timestamp = @timestamp,
      energy = @energy,
      fatigue = @fatigue,
      desire = @desire,
      context = @context,
      activity = @activity,
      updated_at = @updated_at
    WHERE id = @id
  `);

  const deleteById = db.prepare(`
    DELETE FROM energy_entries
    WHERE id = @id
  `);

  function getEntryOrThrow(id: string): EnergyEntry {
    const row = selectById.get({ id }) as EntryRow | undefined;
    if (!row) {
      throw new HttpError(404, 'not_found', 'Entrée introuvable.');
    }
    return row;
  }

  app.post('/api/entries', async (request, reply) => {
    const input = parseCreateEntryBody(request.body);
    const now = new Date().toISOString();
    const entry: EnergyEntry = {
      id: randomUUID(),
      timestamp: input.timestamp,
      energy: input.energy,
      fatigue: input.fatigue,
      desire: input.desire,
      context: input.context,
      activity: input.activity,
      created_at: now,
      updated_at: now,
    };

    try {
      insert.run(entry);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('constraint')
      ) {
        throw new HttpError(
          400,
          'validation_error',
          'Les données sont invalides.',
        );
      }
      throw error;
    }

    return reply.status(201).send({ data: entry });
  });

  app.get('/api/entries', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const parsed = parseListEntriesQuery(query);
    const rows = selectPage.all({
      from: parsed.from,
      to: parsed.to,
      limit: parsed.limit,
      offset: parsed.offset,
    }) as EntryRow[];
    const { total } = countPage.get({
      from: parsed.from,
      to: parsed.to,
    }) as { total: number };

    return reply.send({
      data: rows,
      pagination: {
        limit: parsed.limit,
        offset: parsed.offset,
        total,
      },
    });
  });

  app.get('/api/entries/:id', async (request, reply) => {
    const { id: rawId } = request.params as { id?: string };
    const id = parseEntryId(rawId);
    const entry = getEntryOrThrow(id);
    return reply.send({ data: entry });
  });

  app.patch('/api/entries/:id', async (request, reply) => {
    const { id: rawId } = request.params as { id?: string };
    const id = parseEntryId(rawId);
    const existing = getEntryOrThrow(id);
    const patch = parsePatchEntryBody(request.body);
    const merged = applyEntryPatch(existing, patch);
    const updated_at = new Date().toISOString();
    const entry: EnergyEntry = {
      ...merged,
      id: existing.id,
      created_at: existing.created_at,
      updated_at,
    };

    try {
      const result = updateById.run({
        id: entry.id,
        timestamp: entry.timestamp,
        energy: entry.energy,
        fatigue: entry.fatigue,
        desire: entry.desire,
        context: entry.context,
        activity: entry.activity,
        updated_at: entry.updated_at,
      });
      if (result.changes !== 1) {
        throw new HttpError(404, 'not_found', 'Entrée introuvable.');
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('constraint')
      ) {
        throw new HttpError(
          400,
          'validation_error',
          'Les données sont invalides.',
        );
      }
      throw error;
    }

    return reply.send({ data: entry });
  });

  app.delete('/api/entries/:id', async (request, reply) => {
    const { id: rawId } = request.params as { id?: string };
    const id = parseEntryId(rawId);
    getEntryOrThrow(id);
    const result = deleteById.run({ id });
    if (result.changes !== 1) {
      throw new HttpError(404, 'not_found', 'Entrée introuvable.');
    }
    return reply.status(204).send();
  });
}
