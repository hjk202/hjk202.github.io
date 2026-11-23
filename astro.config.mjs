import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import process from 'node:process';
import { satteri } from '@astrojs/markdown-satteri';
import { writingMarkdown } from './src/modules/think/markdown.mjs';

export default defineConfig({
  output: 'static',
  // Public links use full navigation; avoid speculative fetches during document unload.
  prefetch: false,
  markdown: { processor: satteri(writingMarkdown) },
  site: process.env.SITE_URL || 'https://hjk202.github.io',
  base: process.env.BASE_PATH || '/',
  integrations: [mdx()],
});
