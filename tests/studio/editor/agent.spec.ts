import fs from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { connectThinkAgent } from '../../../studio/adapters/agent/client.ts';
import type { AgentResult } from '../../../studio/adapters/agent/client.ts';
import type { ThinkReadResult, ThinkSummary, ThinkWriteResult } from '../../../studio/contracts/think.ts';
import { startStudioHttp } from '../../../studio/server/http.ts';

function value<T>(result: AgentResult<unknown>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value as T;
}

test('Agent and Web share one API and protect each other from stale saves', async ({ page }, info) => {
  const cache = resolve('.cache/studio-m6'); fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'browser-'));
  const content = join(root, 'src/modules/think/content'); fs.mkdirSync(content, { recursive: true });
  const file = join(content, 'original-name.md');
  fs.writeFileSync(file, '---\n# Non-sensitive M6 fixture\nslug: agent-web\npublished: false\n---\nORIGINAL_BODY\n');
  const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/web'), ai: { environment: {} } });
  const agent = value<import('../../../studio/adapters/agent/client.ts').ThinkAgent>(await connectThinkAgent({ origin: session.origin, allowWrite: true }));
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).origin !== session.origin) external.push(request.url()); });
  try {
    await page.goto(session.origin);
    await page.locator('#documents button').filter({ hasText: 'agent-web' }).click();
    await expect(page.locator('#body')).toHaveValue('ORIGINAL_BODY\n');
    await page.locator('#body').fill('WEB_UNSAVED_BUFFER');
    const entries = value<ThinkSummary[]>(await agent.execute({ id: 'list', operation: 'listThink', params: {} }));
    const source = value<ThinkReadResult>(await agent.execute({ id: 'read', operation: 'readThink', params: { key: entries[0]!.key } }));
    const saved = value<ThinkWriteResult>(await agent.execute({ id: 'save', operation: 'saveThink', params: { key: source.key, expectedRevision: source.revision, document: { ...source.document!, body: 'AGENT_BODY\n' } } }));
    await page.locator('#save').click();
    await expect(page.locator('#message')).toContainText('REVISION_CONFLICT');
    await expect(page.locator('#body')).toHaveValue('WEB_UNSAVED_BUFFER');
    expect(fs.readFileSync(file, 'utf8')).toContain('AGENT_BODY\n');
    await page.screenshot({ path: info.outputPath('agent-web-conflict.png'), fullPage: true });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '重新读取源文件', exact: true }).click();
    await expect(page.locator('#body')).toHaveValue('AGENT_BODY\n');
    await page.locator('#body').fill('WEB_CONFIRMED_EDIT\n');
    await page.locator('#save').click();
    await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）');
    await expect(page.locator('#save')).toBeEnabled();
    const conflict = await agent.execute({ id: 'stale', operation: 'saveThink', params: { key: source.key, expectedRevision: saved.revision, document: { ...source.document!, body: 'MUST_NOT_OVERWRITE' } } });
    expect(conflict.ok).toBe(false); if (!conflict.ok) expect(conflict.error.code).toBe('REVISION_CONFLICT');
    const bytes = fs.readFileSync(file, 'utf8'); expect(bytes).toContain('WEB_CONFIRMED_EDIT\n'); expect(bytes).toContain('published: false'); expect(bytes).toContain('# Non-sensitive M6 fixture');
    expect(fs.readdirSync(content)).toEqual(['original-name.md']);
    expect(errors).toEqual([]); expect(external).toEqual([]);
    await info.attach('agent-web-boundaries', { contentType: 'application/json', body: JSON.stringify({ oneHttpService: true, agentAndWebConflicts: true, buffersPreserved: true, sourceNameAndPublishedPreserved: true, errors, external }) });
  } finally {
    agent.close(); expect((await session.close()).ok).toBe(true);
    expect(relative(cache, root).startsWith('browser-') && !relative(cache, root).includes('..')).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
