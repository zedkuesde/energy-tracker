import { spawn } from 'node:child_process';
import { stderr, stdout } from 'node:process';
import { hashPassword } from './auth/password.js';
import { validateNewPassword } from './validation/account.js';
import {
  assertCanonicalDemoDatabasePath,
  assertCodespacesSecretsPresent,
  assertGitHubCodespaces,
  AUTH_SESSION_SECRET_NAME,
  buildCodespacesPreviewEnv,
  CodespacesDemoError,
  CODESPACES_DEMO_EMAIL,
  CODESPACES_DEMO_PASSWORD_SECRET,
  codespacesPreviewUrl,
  DEMO_APP_PORT,
} from './codespaces-demo.js';
import { seedCodespacesDemoEntries } from './codespaces-demo-seed.js';
import { projectRoot } from './config.js';
import { openDatabase } from './db.js';
import { runMigrations } from './migrate.js';

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Commande interrompue (${signal}).`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Commande échouée (${command} ${args.join(' ')}).`));
        return;
      }
      resolve();
    });
  });
}

function printPreviewInstructions(env: NodeJS.ProcessEnv): void {
  const url = codespacesPreviewUrl(env);
  stdout.write('\nPrévisualisation prête.\n');
  if (url) {
    stdout.write(`Ouvre l’URL privée HTTPS : ${url}\n`);
  } else {
    stdout.write(
      `Ouvre le port privé ${DEMO_APP_PORT} (Ports → Open in Browser).\n`,
    );
  }
  stdout.write(
    `Compte démo : ${CODESPACES_DEMO_EMAIL} (mot de passe = secret ${CODESPACES_DEMO_PASSWORD_SECRET}).\n\n`,
  );
}

export async function runCodespacesPreview(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  assertGitHubCodespaces(env);
  assertCodespacesSecretsPresent(env);

  const password = env[CODESPACES_DEMO_PASSWORD_SECRET] ?? '';
  const passwordError = validateNewPassword(password);
  if (passwordError) {
    throw new CodespacesDemoError(
      `Secret invalide : ${CODESPACES_DEMO_PASSWORD_SECRET}. ${passwordError}`,
    );
  }

  const sessionSecret = env[AUTH_SESSION_SECRET_NAME]?.trim() ?? '';
  if (sessionSecret.length < 32) {
    throw new CodespacesDemoError(
      `Secret manquant ou invalide : ${AUTH_SESSION_SECRET_NAME}. Configure-le ici : GitHub → Settings → Secrets and variables → Codespaces.`,
    );
  }

  const ownerPasswordHash = await hashPassword(password);
  const previewEnv = buildCodespacesPreviewEnv(
    env,
    projectRoot,
    ownerPasswordHash,
  );
  const databasePath = assertCanonicalDemoDatabasePath(projectRoot);

  // Migrations + seed uniquement après validation des secrets.
  const db = openDatabase(databasePath);
  try {
    const applied = runMigrations(db, {
      ownerEmail: CODESPACES_DEMO_EMAIL,
      ownerPasswordHash,
    });
    if (applied.length === 0) {
      stdout.write('Aucune migration à appliquer.\n');
    } else {
      stdout.write(`Migrations appliquées: ${applied.join(', ')}\n`);
    }

    const seed = seedCodespacesDemoEntries(db);
    if (seed.skipped) {
      stdout.write('Seed démo déjà présent — aucune insertion.\n');
    } else {
      stdout.write(`Seed démo : ${seed.inserted} entrées créées.\n`);
    }
  } finally {
    db.close();
  }

  const childEnv = { ...previewEnv };
  delete childEnv[CODESPACES_DEMO_PASSWORD_SECRET];
  delete childEnv.AUTH_PASSWORD_HASH;

  stdout.write('Build de l’application…\n');
  await runCommand('npm', ['run', 'build'], childEnv);

  printPreviewInstructions(childEnv);

  await runCommand('npm', ['start'], childEnv);
}

function isCli(): boolean {
  const entry = process.argv[1];
  return Boolean(
    entry?.endsWith('codespaces-preview.ts') ||
    entry?.endsWith('codespaces-preview.js'),
  );
}

if (isCli()) {
  try {
    await runCodespacesPreview();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur inconnue';
    stderr.write(`${message}\n`);
    process.exit(1);
  }
}
