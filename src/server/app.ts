import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerAuth } from './auth/register.js';
import {
  config,
  parseAuthConfig,
  parseVapidConfig,
  type AuthConfig,
  type VapidConfig,
} from './config.js';
import { openDatabase } from './db.js';
import { runMigrations } from './migrate.js';
import type { MigrationOptions } from './migrate-multi-account.js';
import {
  createReminderScheduler,
  type ReminderScheduler,
} from './reminders/scheduler.js';
import { createReminderStore } from './reminders/store.js';
import { registerEntryRoutes } from './routes/entries.js';
import { registerHealthRoute } from './routes/health.js';
import { registerReminderRoutes } from './routes/reminders.js';
import { HttpError } from './types.js';

export type BuildAppOptions = {
  databasePath: string;
  applyMigrations?: boolean;
  migration?: MigrationOptions;
  logger?: boolean;
  auth?: AuthConfig;
  vapid?: VapidConfig | null;
  startReminderScheduler?: boolean;
};

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const auth = options.auth ?? parseAuthConfig();
  const vapid =
    options.vapid !== undefined ? options.vapid : parseVapidConfig();
  const db = openDatabase(options.databasePath);
  if (options.applyMigrations) {
    runMigrations(db, options.migration);
  }

  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: config.bodyLimitBytes,
    trustProxy: auth.trustProxy,
  });
  app.decorate('sqlite', db);

  let reminderScheduler: ReminderScheduler | undefined;
  if (vapid && options.startReminderScheduler) {
    reminderScheduler = createReminderScheduler({
      store: createReminderStore(db),
      enabled: true,
      onError: (error) => {
        app.log.error(error);
      },
    });
    app.decorate('reminderScheduler', reminderScheduler);
  }

  app.addHook('onClose', async () => {
    reminderScheduler?.stop();
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

  await registerAuth(app, db, auth);
  registerHealthRoute(app);
  registerEntryRoutes(app, db);
  registerReminderRoutes(app, db, vapid);

  if (reminderScheduler) {
    app.addHook('onReady', async () => {
      reminderScheduler?.start();
    });
  }

  return app;
}
