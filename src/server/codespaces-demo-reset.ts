import { existsSync, rmSync } from 'node:fs';
import {
  assertCanonicalDemoDatabasePath,
  assertGitHubCodespaces,
  CodespacesDemoError,
  demoDatabaseSidecarPaths,
  getCanonicalDemoDatabasePath,
} from './codespaces-demo.js';

export type ResetDemoDatabaseOptions = {
  projectRoot: string;
  env?: NodeJS.ProcessEnv;
  confirm: boolean;
  /** Chemin candidat optionnel — doit être le chemin canonique s’il est fourni. */
  candidatePath?: string;
};

export type ResetDemoDatabaseResult = {
  databasePath: string;
  removed: string[];
};

/**
 * Supprime uniquement data/codespaces-demo.sqlite et ses -wal/-shm.
 * Exige Codespaces + confirmation explicite. N'est jamais appelé au démarrage.
 */
export function resetCodespacesDemoDatabase(
  options: ResetDemoDatabaseOptions,
): ResetDemoDatabaseResult {
  assertGitHubCodespaces(options.env);
  if (!options.confirm) {
    throw new CodespacesDemoError(
      'Confirmation manquante. Relance avec : npm run codespaces:reset -- --confirm',
    );
  }

  const databasePath = assertCanonicalDemoDatabasePath(
    options.projectRoot,
    options.candidatePath ?? getCanonicalDemoDatabasePath(options.projectRoot),
  );

  const targets = [databasePath, ...demoDatabaseSidecarPaths(databasePath)];
  const removed: string[] = [];
  for (const target of targets) {
    if (!existsSync(target)) {
      continue;
    }
    rmSync(target, { force: true });
    removed.push(target);
  }

  return { databasePath, removed };
}
