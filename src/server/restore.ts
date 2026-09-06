import { config } from './config.js';
import { restoreDatabase } from './backup.js';

function isCli(): boolean {
  const entry = process.argv[1];
  return Boolean(
    entry?.endsWith('restore.ts') || entry?.endsWith('restore.js'),
  );
}

if (isCli()) {
  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error('Usage: node dist/server/restore.js <sauvegarde.sqlite>');
    process.exit(1);
  }

  restoreDatabase(backupPath, config.databasePath);
  console.log('Base SQLite restaurée.');
}
