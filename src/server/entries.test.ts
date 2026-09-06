import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

async function createApp(): Promise<FastifyInstance> {
  return buildApp({
    databasePath: ':memory:',
    applyMigrations: true,
    logger: false,
  });
}

describe('POST /api/entries et GET /api/entries', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createEntry(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/entries',
      payload,
    });
  }

  test('création valide', async () => {
    const response = await createEntry({ energy: 6, fatigue: 4 });
    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.data.energy, 6);
    assert.equal(body.data.fatigue, 4);
    assert.equal(body.data.desire, null);
    assert.equal(body.data.context, null);
    assert.equal(body.data.activity, null);
    assert.equal(typeof body.data.id, 'string');
    assert.match(
      body.data.timestamp,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    assert.match(
      body.data.created_at,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    assert.equal(body.data.created_at, body.data.updated_at);
  });

  test('energy absente refusée', async () => {
    const response = await createEntry({ fatigue: 4 });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'validation_error');
  });

  test('fatigue absente refusée', async () => {
    const response = await createEntry({ energy: 6 });
    assert.equal(response.statusCode, 400);
  });

  test('energy hors de 0 à 10 refusée', async () => {
    const tooHigh = await createEntry({ energy: 11, fatigue: 4 });
    const tooLow = await createEntry({ energy: -1, fatigue: 4 });
    assert.equal(tooHigh.statusCode, 400);
    assert.equal(tooLow.statusCode, 400);
  });

  test('fatigue hors de 0 à 10 refusée', async () => {
    const response = await createEntry({ energy: 6, fatigue: 10.5 });
    assert.equal(response.statusCode, 400);
  });

  test('desire hors de 0 à 10 refusée', async () => {
    const response = await createEntry({ energy: 6, fatigue: 4, desire: 12 });
    assert.equal(response.statusCode, 400);
  });

  test('desire absente acceptée', async () => {
    const response = await createEntry({ energy: 6, fatigue: 4 });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.desire, null);
  });

  test('context absent accepté', async () => {
    const response = await createEntry({ energy: 6, fatigue: 4 });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.context, null);
  });

  test('context vide converti en null', async () => {
    const response = await createEntry({
      energy: 6,
      fatigue: 4,
      context: '   ',
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.context, null);
  });

  test('context avec espaces superflus normalisé', async () => {
    const response = await createEntry({
      energy: 6,
      fatigue: 4,
      context: '  marche   rapide  ',
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.context, 'marche rapide');
  });

  test('context supérieur à 280 caractères refusé', async () => {
    const response = await createEntry({
      energy: 6,
      fatigue: 4,
      context: 'a'.repeat(281),
    });
    assert.equal(response.statusCode, 400);
  });

  test('activity absente acceptée', async () => {
    const response = await createEntry({ energy: 6, fatigue: 4 });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.activity, null);
  });

  test('activity invalide refusée', async () => {
    const response = await createEntry({
      energy: 6,
      fatigue: 4,
      activity: 'napping',
    });
    assert.equal(response.statusCode, 400);
  });

  test('timestamp absent généré en UTC', async () => {
    const before = Date.now();
    const response = await createEntry({ energy: 6, fatigue: 4 });
    const after = Date.now();
    assert.equal(response.statusCode, 201);
    const timestamp = response.json().data.timestamp as string;
    assert.match(timestamp, /Z$/);
    const parsed = Date.parse(timestamp);
    assert.ok(parsed >= before - 1000);
    assert.ok(parsed <= after + 1000);
  });

  test('timestamp ISO UTC accepté', async () => {
    const response = await createEntry({
      energy: 6,
      fatigue: 4,
      timestamp: '2026-09-06T15:45:00.000Z',
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.timestamp, '2026-09-06T15:45:00.000Z');
  });

  test('timestamp avec offset explicite accepté et normalisé en UTC', async () => {
    const response = await createEntry({
      energy: 6,
      fatigue: 4,
      timestamp: '2026-09-06T17:45:00+02:00',
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.timestamp, '2026-09-06T15:45:00.000Z');
  });

  test('timestamp sans fuseau explicite refusé', async () => {
    const response = await createEntry({
      energy: 6,
      fatigue: 4,
      timestamp: '2026-09-06T15:45:00',
    });
    assert.equal(response.statusCode, 400);
  });

  test('GET /api/entries retourne les entrées dans le bon ordre', async () => {
    await createEntry({
      energy: 1,
      fatigue: 1,
      timestamp: '2026-09-06T10:00:00.000Z',
    });
    await createEntry({
      energy: 3,
      fatigue: 3,
      timestamp: '2026-09-06T12:00:00.000Z',
    });
    await createEntry({
      energy: 2,
      fatigue: 2,
      timestamp: '2026-09-06T11:00:00.000Z',
    });

    const response = await app.inject({ method: 'GET', url: '/api/entries' });
    assert.equal(response.statusCode, 200);
    const energies = response
      .json()
      .data.map((entry: { energy: number }) => entry.energy);
    assert.deepEqual(energies, [3, 2, 1]);
  });

  test('pagination avec limit et offset', async () => {
    await createEntry({
      energy: 1,
      fatigue: 1,
      timestamp: '2026-09-06T10:00:00.000Z',
    });
    await createEntry({
      energy: 2,
      fatigue: 2,
      timestamp: '2026-09-06T11:00:00.000Z',
    });
    await createEntry({
      energy: 3,
      fatigue: 3,
      timestamp: '2026-09-06T12:00:00.000Z',
    });

    const page1 = await app.inject({
      method: 'GET',
      url: '/api/entries?limit=2&offset=0',
    });
    const page2 = await app.inject({
      method: 'GET',
      url: '/api/entries?limit=2&offset=2',
    });

    assert.equal(page1.statusCode, 200);
    assert.equal(page1.json().data.length, 2);
    assert.equal(page1.json().pagination.total, 3);
    assert.equal(page1.json().pagination.limit, 2);
    assert.equal(page1.json().pagination.offset, 0);
    assert.equal(page2.json().data.length, 1);
    assert.equal(page2.json().pagination.offset, 2);
  });

  test('limit supérieur à 100 refusé', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/entries?limit=101',
    });
    assert.equal(response.statusCode, 400);
  });

  test('offset invalide refusé', async () => {
    const negative = await app.inject({
      method: 'GET',
      url: '/api/entries?offset=-1',
    });
    const textual = await app.inject({
      method: 'GET',
      url: '/api/entries?offset=abc',
    });
    assert.equal(negative.statusCode, 400);
    assert.equal(textual.statusCode, 400);
  });

  test('bornes from et to inclusives', async () => {
    await createEntry({
      energy: 1,
      fatigue: 1,
      timestamp: '2026-09-06T10:00:00.000Z',
    });
    await createEntry({
      energy: 2,
      fatigue: 2,
      timestamp: '2026-09-06T11:00:00.000Z',
    });
    await createEntry({
      energy: 3,
      fatigue: 3,
      timestamp: '2026-09-06T12:00:00.000Z',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/entries?from=2026-09-06T10:00:00.000Z&to=2026-09-06T11:00:00.000Z',
    });
    assert.equal(response.statusCode, 200);
    const energies = response
      .json()
      .data.map((entry: { energy: number }) => entry.energy);
    assert.deepEqual(energies, [2, 1]);
    assert.equal(response.json().pagination.total, 2);
  });

  test('from > to refusé', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/entries?from=2026-09-06T12:00:00.000Z&to=2026-09-06T10:00:00.000Z',
    });
    assert.equal(response.statusCode, 400);
  });

  test('aucune donnée retourne une liste vide et total 0', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/entries' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      data: [],
      pagination: { limit: 50, offset: 0, total: 0 },
    });
  });
});
