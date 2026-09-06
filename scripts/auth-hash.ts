import { stdin, stderr } from 'node:process';
import argon2 from 'argon2';

async function readPassword(): Promise<string> {
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks)
      .toString('utf8')
      .replace(/\r?\n$/, '');
  }

  stderr.write('Mot de passe : ');
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return await new Promise((resolve, reject) => {
    let password = '';
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        cleanup();
        stderr.write('\n');
        resolve(password);
        return;
      }
      if (char === '\u0003') {
        cleanup();
        reject(new Error('Annulé.'));
        return;
      }
      if (char === '\u007f' || char === '\b') {
        password = password.slice(0, -1);
        return;
      }
      password += char;
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on('data', onData);
  });
}

const password = await readPassword();
if (!password) {
  stderr.write('Mot de passe vide.\n');
  process.exit(1);
}

process.stdout.write(
  `${await argon2.hash(password, { type: argon2.argon2id })}\n`,
);
