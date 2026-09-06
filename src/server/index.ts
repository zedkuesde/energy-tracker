import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { buildApp } from './app.js';
import { config, projectRoot } from './config.js';

const isProduction = process.env.NODE_ENV === 'production';
const clientDir = path.join(projectRoot, 'dist/client');

const app = await buildApp({
  databasePath: config.databasePath,
  applyMigrations: false,
  logger: !isProduction,
});

if (isProduction) {
  if (!existsSync(path.join(clientDir, 'index.html'))) {
    throw new Error(
      'Build client introuvable dans dist/client. Exécute npm run build.',
    );
  }

  await app.register(fastifyStatic, {
    root: clientDir,
    index: 'index.html',
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || request.url.startsWith('/api')) {
      return reply.status(404).send({
        error: { code: 'not_found', message: 'Ressource introuvable.' },
      });
    }
    return reply.sendFile('index.html');
  });
}

const close = async () => {
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
};

process.once('SIGINT', () => {
  void close();
});
process.once('SIGTERM', () => {
  void close();
});

await app.listen({ port: config.port, host: config.host });
