import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { openDatabase, resolveDatabasePath } from './db.js';

export async function backupDatabase(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  const resolvedDest = path.resolve(destinationPath);
  if (!resolvedDest.endsWith('.sqlite')) {
    throw new Error(
      'La destination de sauvegarde doit se terminer par .sqlite.',
    );
  }

  mkdirSync(path.dirname(resolvedDest), { recursive: true });

  const db = openDatabase(sourcePath);
  try {
    await db.backup(resolvedDest);
  } finally {
    db.close();
  }
}

export function restoreDatabase(
  backupPath: string,
  databasePath: string,
): void {
  const resolvedBackup = path.resolve(backupPath);
  const resolvedDest = resolveDatabasePath(databasePath);

  if (resolvedDest === ':memory:') {
    throw new Error('Impossible de restaurer une base en mémoire.');
  }

  mkdirSync(path.dirname(resolvedDest), { recursive: true });
  copyFileSync(resolvedBackup, resolvedDest);
  rmSync(`${resolvedDest}-wal`, { force: true });
  rmSync(`${resolvedDest}-shm`, { force: true });
}

function isCli(): boolean {
  const entry = process.argv[1];
  return Boolean(entry?.endsWith('backup.ts') || entry?.endsWith('backup.js'));
}

if (isCli()) {
  const destination = process.argv[2];
  if (!destination) {
    console.error('Usage: node dist/server/backup.js <destination.sqlite>');
    process.exit(1);
  }

  await backupDatabase(config.databasePath, destination);
  console.log('Sauvegarde SQLite écrite.');
}
