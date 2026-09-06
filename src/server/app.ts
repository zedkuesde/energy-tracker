import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { openDatabase } from './db.js';
import { runMigrations } from './migrate.js';
import { registerEntryRoutes } from './routes/entries.js';
import { registerHealthRoute } from './routes/health.js';
import { HttpError } from './types.js';

export type BuildAppOptions = {
  databasePath: string;
  applyMigrations?: boolean;
  logger?: boolean;
};

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const db = openDatabase(options.databasePath);
  if (options.applyMigrations) {
    runMigrations(db);
  }

  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: config.bodyLimitBytes,
  });

  app.addHook('onClose', async () => {
    db.close();
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;

    if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.status(413).send({
        error: {
          code: 'payload_too_large',
          message: 'Le corps de la requête est trop volumineux.',
        },
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'internal_error',
        message: 'Une erreur interne est survenue.',
      },
    });
  });

  registerHealthRoute(app);
  registerEntryRoutes(app, db);

  return app;
}
