import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('assets PWA', () => {
  test('manifest.json expose les champs requis pour l’installation', () => {
    const manifest = JSON.parse(readProjectFile('public/manifest.json')) as {
      name: string;
      short_name: string;
      lang: string;
      start_url: string;
      scope: string;
      display: string;
      background_color: string;
      theme_color: string;
      icons: Array<{
        src: string;
        sizes: string;
        type: string;
        purpose: string;
      }>;
    };

    expect(manifest.name).toBe('Energy Tracker');
    expect(manifest.short_name).toBe('Energy');
    expect(manifest.lang).toBe('fr');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#eee4d6');
    expect(manifest.theme_color).toBe('#eee4d6');
    expect(manifest.icons).toEqual([
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ]);
  });

  test('les icônes PNG existent et commencent par la signature PNG', () => {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const files = [
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/icons/apple-touch-icon.png',
    ];

    for (const file of files) {
      const absolute = path.join(projectRoot, file);
      expect(existsSync(absolute), file).toBe(true);
      const bytes = readFileSync(absolute);
      expect(bytes.subarray(0, 4).equals(pngSignature), file).toBe(true);
    }
  });

  test('index.html contient les balises d’installation iOS et le manifeste', () => {
    const html = readProjectFile('index.html');

    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.json"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="/icons/apple-touch-icon.png"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="theme-color" content="#eee4d6"');
  });

  test('le service worker est pass-through, sans cache ni interception fetch', () => {
    const sw = readProjectFile('public/sw.js');

    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('activate'");
    expect(sw).toContain('skipWaiting');
    expect(sw).toContain('clients.claim');
    expect(sw).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(sw).not.toMatch(/\bonfetch\b/);
    expect(sw).not.toMatch(/\bcaches\b/);
  });
});
