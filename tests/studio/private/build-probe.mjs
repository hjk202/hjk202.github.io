import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'vite';

export default async function buildProbe() {
  const directory = fileURLToPath(new URL('../../../.cache/studio/private-probe/web/', import.meta.url));
  await build({
    configFile: false, publicDir: false, logLevel: 'silent',
    build: { outDir: directory, emptyOutDir: true, sourcemap: false,
      lib: { entry: fileURLToPath(new URL('./probe-entry.ts', import.meta.url)), formats: ['es'], fileName: () => 'main.js' } },
  });
  fs.writeFileSync(directory + '/index.html', '<!doctype html><html><meta charset="utf-8"><title>Non-sensitive private prototype</title><h1>Private memory prototype</h1><!--studio-session--><script type="module" src="/studio-assets/main.js"></script></html>');
  fs.writeFileSync(directory + '/style.css', '');
}
