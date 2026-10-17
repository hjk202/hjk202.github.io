import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './editor',
  testMatch: '**/*.spec.ts',
  outputDir: '../../.cache/studio-m5/test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  // Traces/HAR would persist authentication headers and buffers. Use non-sensitive screenshots only.
  use: { viewport: { width: 1280, height: 900 }, trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
});
