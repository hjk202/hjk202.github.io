import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout, clearTimeout } from 'node:timers';
import { URL } from 'node:url';
import process from 'node:process';
import { log } from 'node:console';
import { chromium, webkit } from '@playwright/test';

const { outputs } = JSON.parse(fs.readFileSync('.cache/studio-m1/integration-output.json', 'utf8'));
const results = [];
let port = 4450;
for (const name of ['updated-root', 'updated-base', 'hidden-root', 'hidden-base', 'empty-root', 'empty-base']) {
  const output = outputs[name];
  const origin = `http://127.0.0.1:${port++}`;
  const home = origin + output.base;
  const server = spawn(process.execPath, ['tests/serve.mjs'], { env: { ...process.env, E2E_PORT: new URL(origin).port, E2E_BASE_PATH: output.base, E2E_DIST: output.directory }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static test server did not start')), 15000);
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Static test server exited: ${code}`)); });
      server.stdout.on('data', data => { if (data.toString().includes('Production test server ready')) { clearTimeout(timer); resolve(); } });
      server.stderr.on('data', data => process.stderr.write(data));
    });
    for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();
        const errors = [], failed = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('requestfailed', request => failed.push(request.url()));
        const index = await (await context.request.get(home + 'search-index.json')).json();
        assert.equal(index.modules.find(module => module.id === 'think').count, output.count);
        await page.goto(home + 'think/');
        if (output.probe) {
          assert.ok((await page.locator('main').innerText()).includes('M1_NOTE_UPDATED_INLINE'));
          await page.getByRole('link', { name: 'Studio M1 内容验证', exact: true }).click();
          await page.waitForURL(home + 'think/content-probe/');
          assert.ok((await page.locator('.prose').innerText()).includes('M1_UPDATED_BODY'));
          const image = page.getByRole('img', { name: 'Fixture image' });
          await image.waitFor({ state: 'visible' });
          assert.ok(await image.evaluate(element => element.naturalWidth > 0));
          assert.equal((await context.request.get(new URL(await image.getAttribute('src'), page.url()).href)).status(), 200);
          await page.getByRole('link', { name: /返回 Think/ }).click();
          await page.waitForURL(home + 'think/');
          await page.getByRole('button', { name: 'Search my space', exact: true }).click();
          await page.getByRole('combobox').fill('Studio M1');
          await page.getByRole('combobox').press('Enter');
          await page.waitForURL(home + 'think/content-probe/');
          await page.reload();
          assert.ok((await page.locator('.prose').innerText()).includes('M1_UPDATED_BODY'));
        } else {
          assert.ok(!(await page.locator('main').innerText()).includes('M1_NOTE_UPDATED_INLINE'));
          for (const url of ['think/content-probe/', 'think/authoring-note/', 'think/authoring-draft/']) assert.equal((await context.request.get(home + url)).status(), 404);
          if (output.count === 0) assert.ok((await page.locator('main').innerText()).includes('暂无公开文章'));
          else assert.ok((await page.locator('main').innerText()).includes('我为什么越来越喜欢从底层理解一个东西'));
        }
        await page.screenshot({ path: `.cache/studio-m1/${name}-${engineName}.png`, fullPage: true });
        await page.getByRole('link', { name: 'Home', exact: true }).click();
        await page.waitForURL(home);
        assert.equal(await page.locator('[data-compass-link]').count(), 4);
        await page.getByRole('link', { name: `Think, ${output.count} ${output.count === 1 ? 'entry' : 'entries'}`, exact: true }).click();
        await page.waitForURL(home + 'think/');
        assert.deepEqual(errors, []);
        assert.deepEqual(failed, []);
        results.push({ stage: name, engine: engineName, count: output.count, pageerrors: errors, failedRequests: failed });
      } finally { await browser.close(); }
    }
  } finally {
    if (server.exitCode === null) { const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill(); await stopped; }
  }
}
fs.writeFileSync('.cache/studio-m1/smoke.json', JSON.stringify(results, null, 2));
log(`Studio M1 browser smoke passed: ${results.length} stage/engine combinations, no pageerrors or failed requests.`);
