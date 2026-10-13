import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout, clearTimeout } from 'node:timers';
import { URL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import process from 'node:process';
import { log } from 'node:console';
import { chromium, webkit } from '@playwright/test';

const snapshot = (directory) => Object.fromEntries(readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? Object.entries(snapshot(path)) : [[path, createHash('sha256').update(readFileSync(path)).digest('hex')]];
}));
const before = snapshot('src');
const isolatedRoot = resolve('.cache', `mobile-${Date.now()}`);
const astro = resolve('node_modules/astro', JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8')).bin.astro);
const records = [];
for (const count of [4, 5, 6, 7]) {
  const isolated = join(isolatedRoot, String(count));
  mkdirSync(isolated, { recursive: true });
  cpSync('src', join(isolated, 'src'), { recursive: true });
  if (existsSync('public')) cpSync('public', join(isolated, 'public'), { recursive: true });
  for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) cpSync(file, join(isolated, file));
  const first = join(isolated, 'src/modules/think/module.ts');
  writeFileSync(first, readFileSync(first, 'utf8').replace("name: 'Think'", "name: 'Mathematical Observatory'"));
  for (const [index, id] of ['observatory', 'workshop', 'travel'].slice(0, count - 4).entries()) {
    const extra = join(isolated, 'src/modules', id);
    mkdirSync(extra);
    for (const file of readdirSync('tests/fixtures/observatory')) {
      const name = id[0].toUpperCase() + id.slice(1);
      const content = readFileSync(join('tests/fixtures/observatory', file), 'utf8').replaceAll('observatory', id).replace('order: 4', `order: ${4 + index}`).replace("name: 'Observatory'", `name: '${name}'`);
      writeFileSync(join(extra, file.replace(/\.fixture$/, '')), content);
    }
  }
  execFileSync(process.execPath, [astro, 'build', '--base', '/personal-space/'], { cwd: isolated, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  const server = spawn(process.execPath, [resolve('tests/serve.mjs')], { env: { ...process.env, E2E_DIST: join(isolated, 'dist'), E2E_BASE_PATH: '/personal-space/', E2E_PORT: '4413' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((accept, reject) => {
      const timeout = setTimeout(() => reject(new Error('Mobile probe server did not start')), 10_000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.stdout.once('data', () => { clearTimeout(timeout); accept(); });
      server.stderr.on('data', (data) => log(data.toString()));
    });
    for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, reducedMotion: 'reduce' });
        await page.goto('http://127.0.0.1:4413/personal-space/');
        const metrics = await page.locator('[data-compass-link]').evaluateAll((links) => links.map((link) => {
          const document = link.ownerDocument;
          const box = (element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          const label = link.querySelector('.compass-touch-label div');
          const text = document.createRange(); text.selectNodeContents(label);
          return { id: link.dataset.module, node: box(link.querySelector('.compass-target')), label: box(label), text: box(text) };
        }));
        assert.equal(metrics.length, count);
        await page.screenshot({ path: join(isolatedRoot, `${count}-${name}.png`), animations: 'disabled' });
        for (const item of metrics) {
          assert.ok(item.node.width >= 44 && item.node.height >= 44, `${name}: ${item.id} node too small`);
          assert.ok(item.label.height >= 44, `${name}: ${item.id} label too small`);
          assert.ok(item.text.left >= 0 && item.text.right <= 320 && item.text.top >= item.label.top && item.text.bottom <= item.label.bottom, `${name}: ${item.id} text clipped: ${JSON.stringify(item)}`);
        }
        for (let a = 0; a < metrics.length; a++) for (let b = a + 1; b < metrics.length; b++) {
          for (const firstBox of [metrics[a].node, metrics[a].label]) for (const secondBox of [metrics[b].node, metrics[b].label]) {
            const intersection = Math.min(firstBox.right, secondBox.right) - Math.max(firstBox.left, secondBox.left) > 0 && Math.min(firstBox.bottom, secondBox.bottom) - Math.max(firstBox.top, secondBox.top) > 0;
            assert.ok(!intersection, `${name}: overlapping ${metrics[a].id}/${metrics[b].id} targets`);
          }
        }
        for (const item of metrics) {
          await page.locator(`[data-module="${item.id}"] .compass-touch-label div`).tap();
          await page.waitForURL(`**/personal-space/${item.id}/`);
          assert.equal(new URL(page.url()).pathname, `/personal-space/${item.id}/`);
          await page.goBack();
        }
        records.push({ count, engine: name, metrics });
      } finally { await browser.close(); }
    }
  } finally {
    if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  }
}
assert.deepEqual(snapshot('src'), before, 'Mobile probes must not change real modules or content');
writeFileSync('.cache/mobile-probe-output.txt', isolatedRoot);
writeFileSync(join(isolatedRoot, 'measurements.json'), JSON.stringify(records, null, 2));
log(`4–7 module mobile acceptance passed: ${isolatedRoot}`);
