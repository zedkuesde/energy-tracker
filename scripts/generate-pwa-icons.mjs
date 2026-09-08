import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const iconsDir = path.join(projectRoot, 'public/icons');
const svg = await readFile(path.join(iconsDir, 'icon.svg'));

await mkdir(iconsDir, { recursive: true });

async function writePng(size, filename) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, filename));
}

await writePng(192, 'icon-192.png');
await writePng(512, 'icon-512.png');
await writePng(180, 'apple-touch-icon.png');
