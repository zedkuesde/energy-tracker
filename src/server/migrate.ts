import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { config, projectRoot } from './config.js';
import { openDatabase, type SqliteDatabase } from './db.js';
import {
  applyMultiAccountMigration,
  MULTI_ACCOUNT_MIGRATION_ID,
  resolveOwnerBootstrap,
  type MigrationOptions,
} from './migrate-multi-account.js';

const MIGRATIONS_DIR = path.join(projectRoot, 'migrations');

function ensureMigrationsTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function listSqlMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

type MigrationStep = {
  id: string;
  apply: (db: SqliteDatabase, options?: MigrationOptions) => void;
};

function listMigrationSteps(): MigrationStep[] {
  const sqlSteps: MigrationStep[] = listSqlMigrationFiles().map((fileName) => ({
    id: fileName,
    apply(db) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
      db.exec(sql);
    },
  }));

  const programmaticSteps: MigrationStep[] = [
    {
      id: MULTI_ACCOUNT_MIGRATION_ID,
      apply(db, options) {
        applyMultiAccountMigration(db, resolveOwnerBootstrap(options));
      },
    },
  ];

  return [...sqlSteps, ...programmaticSteps].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

export function runMigrations(
  db: SqliteDatabase,
  options?: MigrationOptions,
): string[] {
  ensureMigrationsTable(db);

  const appliedRows = db
    .prepare('SELECT id FROM schema_migrations')
    .all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));
  const newlyApplied: string[] = [];

  for (const step of listMigrationSteps()) {
    if (applied.has(step.id)) {
      continue;
    }

    const apply = db.transaction(() => {
      step.apply(db, options);
      db.prepare(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
      ).run(step.id, new Date().toISOString());
    });

    try {
      apply();
      newlyApplied.push(step.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'erreur inconnue';
      throw new Error(`Migration échouée (${step.id}): ${message}`, {
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
