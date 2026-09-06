import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BODY_LIMIT_BYTES = 16 * 1024;
const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_PATH = './data/energy-tracker.sqlite';

export function findProjectRoot(fromDir: string): string {
  let current = fromDir;
  while (!existsSync(path.join(current, 'package.json'))) {
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Racine du projet introuvable (package.json).');
    }
    current = parent;
  }
  return current;
}

export const projectRoot = findProjectRoot(
  path.dirname(fileURLToPath(import.meta.url)),
);

function loadEnvFile(): void {
  const envPath = path.join(projectRoot, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PORT;
  }
  return parsed;
}

export const config = {
  port: parsePort(process.env.APP_PORT),
  databasePath: process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
  bodyLimitBytes: BODY_LIMIT_BYTES,
  host: '127.0.0.1',
};
