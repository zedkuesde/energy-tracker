import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { SESSION_COOKIE_NAME } from './config.js';
import { createTestApp, loginCookie } from './test-support.js';

let app: FastifyInstance;
let cookie: string;

function inject(opts: Parameters<FastifyInstance['inject']>[0]) {
  return app.inject({
    ...opts,
    cookies: { [SESSION_COOKIE_NAME]: cookie },
  });
}

async function setupAuthenticatedApp(): Promise<void> {
  app = await createTestApp();
  cookie = await loginCookie(app);
}

describe('POST /api/entries et GET /api/entries', () => {
  beforeEach(async () => {
    await setupAuthenticatedApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createEntry(payload: Record<string, unknown>) {
    return inject({
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

    const response = await inject({ method: 'GET', url: '/api/entries' });
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

    const page1 = await inject({
      method: 'GET',
      url: '/api/entries?limit=2&offset=0',
    });
    const page2 = await inject({
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
    const response = await inject({
      method: 'GET',
      url: '/api/entries?limit=101',
    });
    assert.equal(response.statusCode, 400);
  });

  test('offset invalide refusé', async () => {
    const negative = await inject({
      method: 'GET',
      url: '/api/entries?offset=-1',
    });
    const textual = await inject({
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

    const response = await inject({
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
    const response = await inject({
      method: 'GET',
      url: '/api/entries?from=2026-09-06T12:00:00.000Z&to=2026-09-06T10:00:00.000Z',
    });
    assert.equal(response.statusCode, 400);
  });

  test('aucune donnée retourne une liste vide et total 0', async () => {
    const response = await inject({ method: 'GET', url: '/api/entries' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      data: [],
      pagination: { limit: 50, offset: 0, total: 0 },
    });
  });
});

describe('GET PATCH DELETE /api/entries/:id', () => {
  beforeEach(async () => {
    await setupAuthenticatedApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createEntry(payload: Record<string, unknown>) {
    return inject({
      method: 'POST',
      url: '/api/entries',
      payload,
    });
  }

  const missingId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  test('GET retourne une entrée existante', async () => {
    const created = await createEntry({
      energy: 6,
      fatigue: 4,
      desire: 3,
      context: 'pause',
      activity: 'rest',
    });
    const id = created.json().data.id as string;

    const response = await inject({
      method: 'GET',
      url: `/api/entries/${id}`,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, id);
    assert.equal(response.json().data.energy, 6);
    assert.equal(response.json().data.context, 'pause');
  });

  test('GET retourne 404 pour un UUID inexistant', async () => {
    const response = await inject({
      method: 'GET',
      url: `/api/entries/${missingId}`,
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, 'not_found');
  });

  test('GET retourne 400 pour un ID invalide', async () => {
    const malformed = await inject({
      method: 'GET',
      url: '/api/entries/not-a-uuid',
    });
    const uuidV1 = await inject({
      method: 'GET',
      url: '/api/entries/6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    });
    assert.equal(malformed.statusCode, 400);
    assert.equal(uuidV1.statusCode, 400);
    assert.equal(malformed.json().error.code, 'validation_error');
  });

  test('PATCH met à jour énergie et fatigue', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;

    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { energy: 8, fatigue: 2 },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.energy, 8);
    assert.equal(response.json().data.fatigue, 2);
  });

  test('PATCH préserve les champs non fournis', async () => {
    const created = await createEntry({
      energy: 6,
      fatigue: 4,
      desire: 7,
      context: 'réunion',
      activity: 'work',
      timestamp: '2026-09-06T16:00:00.000Z',
    });
    const id = created.json().data.id as string;

    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { energy: 9 },
    });
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.equal(data.energy, 9);
    assert.equal(data.fatigue, 4);
    assert.equal(data.desire, 7);
    assert.equal(data.context, 'réunion');
    assert.equal(data.activity, 'work');
    assert.equal(data.timestamp, '2026-09-06T16:00:00.000Z');
  });

  test('PATCH avec desire: null retire l’envie', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4, desire: 5 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { desire: null },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.desire, null);
  });

  test('PATCH avec context: null retire le contexte', async () => {
    const created = await createEntry({
      energy: 6,
      fatigue: 4,
      context: 'note',
    });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { context: null },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.context, null);
  });

  test('PATCH avec activity: null retire l’activité', async () => {
    const created = await createEntry({
      energy: 6,
      fatigue: 4,
      activity: 'sport',
    });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { activity: null },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.activity, null);
  });

  test('PATCH normalise le contexte', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { context: '  marche   rapide  ' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.context, 'marche rapide');
  });

  test('PATCH rejette un body vide', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: {},
    });
    assert.equal(response.statusCode, 400);
  });

  test('PATCH rejette les champs inconnus', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { energy: 7, extra: true },
    });
    assert.equal(response.statusCode, 400);
    const forbidden = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { created_at: '2026-09-06T16:00:00.000Z' },
    });
    assert.equal(forbidden.statusCode, 400);
  });

  test('PATCH rejette les valeurs hors 0–10', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const energy = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { energy: 11 },
    });
    const desire = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { desire: -1 },
    });
    assert.equal(energy.statusCode, 400);
    assert.equal(desire.statusCode, 400);
  });

  test('PATCH rejette une activité invalide', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { activity: 'napping' },
    });
    assert.equal(response.statusCode, 400);
  });

  test('PATCH rejette un timestamp sans fuseau', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { timestamp: '2026-09-06T15:45:00' },
    });
    assert.equal(response.statusCode, 400);
  });

  test('PATCH normalise un timestamp avec offset en UTC', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${id}`,
      payload: { timestamp: '2026-09-06T17:45:00+02:00' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.timestamp, '2026-09-06T15:45:00.000Z');
  });

  test('PATCH met à jour updated_at sans modifier created_at', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const original = created.json().data;
    const before = Date.now();
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${original.id}`,
      payload: { energy: 5 },
    });
    const after = Date.now();
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.equal(data.created_at, original.created_at);
    assert.match(
      data.updated_at,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    const updated = Date.parse(data.updated_at);
    assert.ok(updated >= before - 1000);
    assert.ok(updated <= after + 1000);
    assert.ok(data.updated_at >= original.updated_at);
  });

  test('PATCH retourne 404 pour une entrée inexistante', async () => {
    const response = await inject({
      method: 'PATCH',
      url: `/api/entries/${missingId}`,
      payload: { energy: 5 },
    });
    assert.equal(response.statusCode, 404);
  });

  test('DELETE retourne 204 et supprime l’entrée', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    const response = await inject({
      method: 'DELETE',
      url: `/api/entries/${id}`,
    });
    assert.equal(response.statusCode, 204);
    assert.equal(response.body, '');
  });

  test('l’entrée supprimée n’apparaît plus dans GET /api/entries', async () => {
    const created = await createEntry({ energy: 6, fatigue: 4 });
    const id = created.json().data.id as string;
    await inject({ method: 'DELETE', url: `/api/entries/${id}` });
    const list = await inject({ method: 'GET', url: '/api/entries' });
    assert.equal(list.json().data.length, 0);
    assert.equal(list.json().pagination.total, 0);
    const missing = await inject({
      method: 'GET',
      url: `/api/entries/${id}`,
    });
    assert.equal(missing.statusCode, 404);
  });

  test('DELETE retourne 404 pour un UUID inexistant', async () => {
    const response = await inject({
      method: 'DELETE',
      url: `/api/entries/${missingId}`,
    });
    assert.equal(response.statusCode, 404);
  });

  test('DELETE retourne 400 pour un ID invalide', async () => {
    const response = await inject({
      method: 'DELETE',
      url: '/api/entries/not-a-uuid',
    });
    assert.equal(response.statusCode, 400);
  });
});
