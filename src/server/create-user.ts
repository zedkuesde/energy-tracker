import { stdin, stderr } from 'node:process';
import { randomUUID } from 'node:crypto';
import * as readline from 'node:readline/promises';
import { config } from './config.js';
import { openDatabase, type SqliteDatabase } from './db.js';
import { createUserStore } from './auth/users.js';
import { hashPassword } from './auth/password.js';
import { normalizeEmail, validateNewPassword } from './validation/account.js';

export class CreateUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreateUserError';
  }
}

export async function createUser(
  db: SqliteDatabase,
  input: { email: string; password: string },
): Promise<void> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new CreateUserError('Email invalide.');
  }

  const passwordError = validateNewPassword(input.password);
  if (passwordError) {
    throw new CreateUserError(passwordError);
  }

  const users = createUserStore(db);
  const passwordHash = await hashPassword(input.password);

  try {
    users.insert({
      id: randomUUID(),
      email,
      password_hash: passwordHash,
      is_owner: 0,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CreateUserError('Un compte avec cet email existe déjà.');
    }
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

async function promptVisible(label: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stderr });
  try {
    return await rl.question(label);
  } finally {
    rl.close();
  }
}

async function promptHidden(label: string): Promise<string> {
  stderr.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return await new Promise((resolve, reject) => {
    let value = '';
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        cleanup();
        stderr.write('\n');
        resolve(value);
        return;
      }
      if (char === '\u0003') {
        cleanup();
        reject(new Error('Annulé.'));
        return;
      }
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on('data', onData);
  });
}

async function runCli(): Promise<void> {
  if (!stdin.isTTY) {
    stderr.write(
      'Cette commande nécessite un TTY. Utilise : docker compose exec -it energy-tracker npm run create-user\n',
    );
    process.exit(1);
  }

  const email = await promptVisible('Email : ');
  const password = await promptHidden('Mot de passe : ');
  const confirmation = await promptHidden('Confirmation du mot de passe : ');

  if (password !== confirmation) {
    stderr.write('Les mots de passe ne correspondent pas.\n');
    process.exit(1);
  }

  const db = openDatabase(config.databasePath);
  try {
    await createUser(db, { email, password });
    stderr.write('Compte créé.\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur inconnue';
    stderr.write(`${message}\n`);
    process.exit(1);
  } finally {
    db.close();
  }
}

function isCli(): boolean {
  const entry = process.argv[1];
  return Boolean(
    entry?.endsWith('create-user.ts') || entry?.endsWith('create-user.js'),
  );
}

if (isCli()) {
  await runCli();
}
