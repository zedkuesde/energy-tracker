import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiled = path.join(root, 'dist/server/migrate.js');
const args = existsSync(compiled)
  ? [compiled]
  : ['--import', 'tsx', path.join(root, 'src/server/migrate.ts')];

const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
