import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import { encryptVault, decryptVault } from '../../../src/core/vault/crypto.ts';
import type { Envelope } from '../../../src/core/vault/crypto.ts';
import type { PrivateSession } from '../../../studio/private/session.ts';
import type { privateSelection } from '../../../studio/contracts/private.ts';

type ProbeWindow = Window & { __privateProbe: { PrivateSession: new () => PrivateSession; privateSelection: typeof privateSelection } };
const password = 'NON_SENSITIVE_BROWSER_INTEROP_2026';
const snapshot = { revision: '2'.repeat(64), slugs: ['parent'] };
function payload() {
  return { version: 1, modules: {
    think: { posts: [{ id: 'a'.repeat(32), title: '非敏感标题', summary: '说明', kind: 'article', date: '2026-10-23', body: 'non-sensitive-' + randomUUID() }] },
    keep: { bookmarks: [] }, me: { paragraphs: ['非敏感介绍'] }, build: { projects: [], supplements: [] },
  }, assets: {} };
}
const test = base.extend<{ probe: true }>({
  probe: async ({ page }, use) => {
    const cache = resolve('.cache/studio-batch/m12'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'browser-'));
    fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
    const errors: string[] = [], external: string[] = [], requests: string[] = [];
    page.on('pageerror', () => errors.push('PAGE_ERROR'));
    const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/private-probe/web'), ai: { environment: {} } });
    page.on('request', request => { requests.push(request.method()); if (new URL(request.url()).origin !== session.origin) external.push('EXTERNAL_REQUEST'); });
    try { await page.goto(session.origin+'/#think'); await page.waitForFunction(() => !!(window as unknown as ProbeWindow).__privateProbe); await use(true); }
    finally {
      await page.evaluate(() => { document.body.replaceChildren(); sessionStorage.clear(); localStorage.clear(); });
      expect((await session.close()).ok).toBe(true); expect(errors).toEqual([]); expect(external).toEqual([]); expect(requests.every(method => method === 'GET')).toBe(true);
      expect(relative(cache, root).startsWith('browser-')).toBe(true); fs.rmSync(root, { recursive: true });
    }
  },
});
test('M12 real Node/browser crypto interoperates and preserves untouched package fields without application uploads', async ({ page, probe }) => {
  expect(probe).toBe(true); const original = payload(), envelope = await encryptVault(original, password);
  const result = await page.evaluate(async ({ envelope, password, snapshot }) => {
    const Session = (window as unknown as ProbeWindow).__privateProbe.PrivateSession, session = new Session();
    await session.unlock(envelope, password, snapshot); const before = session.snapshot(), candidate = session.snapshot();
    (candidate.modules.think as { posts: { title: string }[] }).posts[0]!.title = '修改非敏感标题'; session.replaceCandidate(candidate);
    const sealed = await session.seal(password, snapshot), retained = JSON.stringify(session.snapshot().modules.me) === JSON.stringify(before.modules.me);
    session.lock();
    return { envelope: sealed.envelope, untouchedModuleRetained: retained, locked: !session.unlocked, persistentStoresEmpty: localStorage.length === 0 && sessionStorage.length === 0 };
  }, { envelope, password, snapshot });
  expect(result.untouchedModuleRetained && result.locked && result.persistentStoresEmpty).toBe(true);
  const recovered = await decryptVault(result.envelope as Envelope, password), expected = structuredClone(original); expected.modules.think.posts[0]!.title = '修改非敏感标题';
  expect(JSON.stringify(recovered) === JSON.stringify(expected)).toBe(true); expect(result.envelope.iterations).toBe(600000);
});
test('M12 late unlock/seal cannot reopen locked state and invalid modules/relations fail before encryption', async ({ page, probe }) => {
  expect(probe).toBe(true); const envelope = await encryptVault(payload(), password);
  const result = await page.evaluate(async ({ envelope, password, snapshot }) => {
    const Session = (window as unknown as ProbeWindow).__privateProbe.PrivateSession, session = new Session();
    let lateUnlock = false, lateSeal = false, invalid = false;
    const pending = session.unlock(envelope, password, snapshot); session.lock(); try { await pending; } catch { lateUnlock = !session.unlocked; }
    await session.unlock(envelope, password, snapshot);
    const candidate = session.snapshot(); (candidate.modules.think as { posts: Record<string, unknown>[] }).posts[0]!.published = false; session.replaceCandidate(candidate);
    try { await session.seal(password, snapshot); } catch { invalid = true; }
    await session.unlock(envelope, password, snapshot); const sealing = session.seal(password, snapshot); session.lock(); try { await sealing; } catch { lateSeal = !session.unlocked; }
    return { lateUnlock, lateSeal, invalid, storesEmpty: localStorage.length === 0 && sessionStorage.length === 0 };
  }, { envelope, password, snapshot });
  expect(Object.values(result).every(value => value === true)).toBe(true);
});
test('M12 browser selection messages cannot carry a filesystem path, secret or payload', async ({ page, probe }) => {
  expect(probe).toBe(true);
  const valid = { type: 'studio:private-select', requestId: randomUUID(), mode: 'open' };
  const result = await page.evaluate(valid => {
    const check = (window as unknown as ProbeWindow).__privateProbe.privateSelection;
    return check(valid) && [{ ...valid, path: 'C:/outside.json' }, { ...valid, password: 'NON_SENSITIVE' }, { ...valid, payload: {} }, { ...valid, mode: 'shell' }].every(value => !check(value));
  }, valid);
  expect(result).toBe(true);
});

test('M12 private preview permits volatile Blob images while connections remain same-origin', async ({ page, probe }) => {
  expect(probe).toBe(true);
  const response = await page.request.get(page.url());
  const policy = response.headers()['content-security-policy'];
  expect(policy).toContain('img-src data: blob:');
  expect(policy).toContain("connect-src 'self';");
  const loaded = await page.evaluate(async () => {
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    const image = new Image();
    try {
      const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('PRIVATE_IMAGE_FAILED')); });
      image.src = url; document.body.append(image); await loaded;
      return image.naturalWidth === 1;
    } finally { image.remove(); image.src = ''; URL.revokeObjectURL(url); }
  });
  expect(loaded).toBe(true);
});
