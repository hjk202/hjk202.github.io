import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { test } from 'node:test';
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? files(path) : [path];
});
test('module source files never import another module', () => {
  const root = resolve('src/modules');
  for (const file of files(root)) {
    const owner = file.slice(root.length + 1).split(sep)[0];
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
      if (!specifier.startsWith('.')) continue;
      const target = resolve(dirname(file), specifier);
      if (target.startsWith(`${root}${sep}`)) assert.equal(target.slice(root.length + 1).split(sep)[0], owner, file);
    }
  }
});
test('browser entry imports only public types, matching and logical URLs', () => {
  const source = readFileSync('src/shell/home/spotlight.ts', 'utf8');
  assert.doesNotMatch(source, /\.server|node:fs|import\.meta\.glob|modules\/[a-z]/);
  const search = readFileSync('src/core/search/search.ts', 'utf8');
  assert.doesNotMatch(search, /\.server|node:fs|import\.meta\.glob|modules\/[a-z]/);
});
