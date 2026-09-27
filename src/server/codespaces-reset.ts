import { stderr, stdout } from 'node:process';
import {
  CodespacesDemoError,
  CODESPACES_DEMO_DB_RELATIVE,
} from './codespaces-demo.js';
import { resetCodespacesDemoDatabase } from './codespaces-demo-reset.js';
import { projectRoot } from './config.js';

export function parseResetConfirmArgs(argv: string[]): boolean {
  return argv.includes('--confirm');
}

export function runCodespacesResetCli(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): void {
  const confirm = parseResetConfirmArgs(argv);
  const result = resetCodespacesDemoDatabase({
    projectRoot,
    env,
    confirm,
  });

  if (result.removed.length === 0) {
    stdout.write(
      `Aucune base de démonstration à supprimer (${CODESPACES_DEMO_DB_RELATIVE}).\n`,
    );
    return;
  }

  stdout.write('Base de démonstration Codespaces supprimée :\n');
  for (const file of result.removed) {
    stdout.write(`- ${file}\n`);
  }
  stdout.write('Relance ensuite : npm run codespaces:preview\n');
}

function isCli(): boolean {
  const entry = process.argv[1];
  return Boolean(
    entry?.endsWith('codespaces-reset.ts') ||
    entry?.endsWith('codespaces-reset.js'),
  );
}

if (isCli()) {
  try {
    runCodespacesResetCli();
  } catch (error) {
    const message =
      error instanceof CodespacesDemoError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'erreur inconnue';
    stderr.write(`${message}\n`);
    process.exit(1);
  }
}
