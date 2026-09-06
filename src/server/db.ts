import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { projectRoot } from './config.js';

export type SqliteDatabase = Database.Database;

export function resolveDatabasePath(databasePath: string): string {
  if (databasePath === ':memory:') {
    return databasePath;
  }
  return path.isAbsolute(databasePath)
    ? databasePath
    : path.resolve(projectRoot, databasePath);
}

export function openDatabase(databasePath: string): SqliteDatabase {
  const resolvedPath = resolveDatabasePath(databasePath);
  if (resolvedPath !== ':memory:') {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}
