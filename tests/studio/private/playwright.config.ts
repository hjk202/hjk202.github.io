import { defineConfig } from '@playwright/test';
// Local Playwright's error-context snapshot includes textarea values. Private tests must not persist them.
// This disables diagnostic DOM copies only; errors and every assertion remain intact.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
export default defineConfig({
  globalSetup: './build-probe.mjs',
  testIgnore:'site.spec.ts',
  testDir: '.', testMatch: '**/*.spec.ts', outputDir: '../../../.cache/studio-batch/m12/private-browser-results',
  fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
  use: { trace: 'off', screenshot: 'off', viewport: { width: 1280, height: 900 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
});
