import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({
      databasePath: ':memory:',
      applyMigrations: true,
      logger: false,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('retourne 200 et un JSON minimal', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok' });
    assert.equal(Object.keys(response.json()).length, 1);
  });
});
