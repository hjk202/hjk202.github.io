import { defineConfig } from '@playwright/test';
const origin = `http://127.0.0.1:${process.env.E2E_PORT ?? '4410'}`;
const base = process.env.E2E_BASE_PATH ?? '/';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: process.env.E2E_HEAD === '1' ? '**/head.spec.ts' : process.env.E2E_MOBILE === '1' ? '**/mobile.spec.ts' : process.env.E2E_DESIGN_PROBE === '1' ? '**/design-probe.spec.ts' : process.env.E2E_EXTENSION === '1' ? '**/extension.spec.ts' : process.env.E2E_CONTENT_PROBE === '1' ? '**/content-probe.spec.ts' : process.env.E2E_EMPTY_PROBE === '1' ? '**/content-empty.spec.ts' : ['**/spotlight.spec.ts', '**/visual.spec.ts', '**/acceptance.spec.ts', '**/content.spec.ts', '**/mobile.spec.ts', '**/head.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `${origin}${base}`, browserName: process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium', viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_EXTERNAL_SERVER === '1' ? undefined : { command: 'node tests/serve.mjs', url: `${origin}${base}`, reuseExistingServer: false, timeout: 30_000 },
});
