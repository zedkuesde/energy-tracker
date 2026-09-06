import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { config, projectRoot } from './config.js';
import { openDatabase, type SqliteDatabase } from './db.js';

const MIGRATIONS_DIR = path.join(projectRoot, 'migrations');

function ensureMigrationsTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

export function runMigrations(db: SqliteDatabase): string[] {
  ensureMigrationsTable(db);

  const appliedRows = db
    .prepare('SELECT id FROM schema_migrations')
    .all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));
  const newlyApplied: string[] = [];

  for (const fileName of listMigrationFiles()) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
      ).run(fileName, new Date().toISOString());
    });

    try {
      apply();
      newlyApplied.push(fileName);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'erreur inconnue';
      throw new Error(`Migration échouée (${fileName}): ${message}`, {
        cause: error,
      });
    }
  }

  return newlyApplied;
}

function isCli(): boolean {
  const entry = process.argv[1];
  return Boolean(
    entry?.endsWith('migrate.ts') || entry?.endsWith('migrate.js'),
  );
}

if (isCli()) {
  const db = openDatabase(config.databasePath);
  try {
    const applied = runMigrations(db);
    if (applied.length === 0) {
      console.log('Aucune migration à appliquer.');
    } else {
      console.log(`Migrations appliquées: ${applied.join(', ')}`);
    }
  } finally {
    db.close();
  }
}
