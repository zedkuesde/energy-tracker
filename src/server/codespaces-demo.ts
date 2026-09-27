import { existsSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const CODESPACES_DEMO_EMAIL = 'demo@energy-tracker.local';
export const CODESPACES_DEMO_DB_RELATIVE = 'data/codespaces-demo.sqlite';
export const CODESPACES_DEMO_PASSWORD_SECRET = 'CODESPACES_DEMO_PASSWORD';
export const AUTH_SESSION_SECRET_NAME = 'AUTH_SESSION_SECRET';
export const MIN_SESSION_SECRET_LENGTH = 32;
export const DEMO_APP_PORT = 3000;

export class CodespacesDemoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodespacesDemoError';
  }
}

export function isGitHubCodespaces(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.CODESPACES === 'true';
}

export function assertGitHubCodespaces(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isGitHubCodespaces(env)) {
    throw new CodespacesDemoError(
      'Cette commande est uniquement autorisée dans GitHub Codespaces (variable CODESPACES=true).',
    );
  }
}

export function getCanonicalDemoDatabasePath(projectRoot: string): string {
  return path.resolve(projectRoot, CODESPACES_DEMO_DB_RELATIVE);
}

function assertNotSymlink(targetPath: string, label: string): void {
  if (!existsSync(targetPath)) {
    return;
  }
  if (lstatSync(targetPath).isSymbolicLink()) {
    throw new CodespacesDemoError(
      `${label} ne doit pas être un lien symbolique.`,
    );
  }
}

/**
 * Autorise uniquement data/codespaces-demo.sqlite sous la racine du dépôt.
 * Refuse chemins personnalisés, DATABASE_PATH tiers et liens symboliques.
 */
export function assertCanonicalDemoDatabasePath(
  projectRoot: string,
  candidatePath?: string,
): string {
  const canonical = getCanonicalDemoDatabasePath(projectRoot);
  const dataDir = path.dirname(canonical);

  if (candidatePath !== undefined) {
    const resolvedCandidate = path.resolve(candidatePath);
    if (resolvedCandidate !== canonical) {
      throw new CodespacesDemoError(
        `Chemin de base refusé. Seul ${CODESPACES_DEMO_DB_RELATIVE} sous la racine du dépôt est autorisé.`,
      );
    }
  }

  assertNotSymlink(dataDir, 'Le répertoire data/');
  assertNotSymlink(canonical, 'Le fichier de base de démonstration');

  if (existsSync(canonical)) {
    const realFile = realpathSync(canonical);
    if (realFile !== canonical) {
      throw new CodespacesDemoError(
        'Le fichier de base de démonstration ne résout pas vers le chemin canonique attendu.',
      );
    }
  }

  if (existsSync(dataDir)) {
    const realDataDir = realpathSync(dataDir);
    if (realDataDir !== dataDir) {
      throw new CodespacesDemoError(
        'Le répertoire data/ ne résout pas vers le chemin canonique attendu.',
      );
    }
  }

  return canonical;
}

export type MissingSecret = {
  name: string;
  howTo: string;
};

export function findMissingCodespacesSecrets(
  env: NodeJS.ProcessEnv = process.env,
): MissingSecret[] {
  const missing: MissingSecret[] = [];
  const password = env[CODESPACES_DEMO_PASSWORD_SECRET];
  if (password === undefined || password.trim() === '') {
    missing.push({
      name: CODESPACES_DEMO_PASSWORD_SECRET,
      howTo:
        'GitHub → Settings → Secrets and variables → Codespaces → New repository secret',
    });
  }

  const sessionSecret = env[AUTH_SESSION_SECRET_NAME];
  if (
    sessionSecret === undefined ||
    sessionSecret.trim().length < MIN_SESSION_SECRET_LENGTH
  ) {
    missing.push({
      name: AUTH_SESSION_SECRET_NAME,
      howTo:
        'GitHub → Settings → Secrets and variables → Codespaces → New repository secret (≥ 32 caractères ; npm run auth:secret)',
    });
  }

  return missing;
}

export function formatMissingSecretsMessage(missing: MissingSecret[]): string {
  return missing
    .map(
      (item) =>
        `Secret manquant ou invalide : ${item.name}. Configure-le ici : ${item.howTo}.`,
    )
    .join('\n');
}

export function assertCodespacesSecretsPresent(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const missing = findMissingCodespacesSecrets(env);
  if (missing.length > 0) {
    throw new CodespacesDemoError(formatMissingSecretsMessage(missing));
  }
}

export function buildCodespacesPreviewEnv(
  env: NodeJS.ProcessEnv,
  projectRoot: string,
  ownerPasswordHash: string,
): NodeJS.ProcessEnv {
  const databasePath = assertCanonicalDemoDatabasePath(projectRoot);
  return {
    ...env,
    DATABASE_PATH: databasePath,
    APP_PORT: String(DEMO_APP_PORT),
    APP_HOST: '0.0.0.0',
    AUTH_COOKIE_SECURE: 'true',
    TRUST_PROXY: 'true',
    AUTH_OWNER_EMAIL: CODESPACES_DEMO_EMAIL,
    AUTH_PASSWORD_HASH: ownerPasswordHash,
    NODE_ENV: 'production',
  };
}

export function codespacesPreviewUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const name = env.CODESPACE_NAME?.trim();
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN?.trim();
  if (!name || !domain) {
    return null;
  }
  return `https://${name}-${DEMO_APP_PORT}.${domain}`;
}

export function demoDatabaseSidecarPaths(databasePath: string): string[] {
  return [`${databasePath}-wal`, `${databasePath}-shm`];
}
