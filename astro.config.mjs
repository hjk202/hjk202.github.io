import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import process from 'node:process';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://hjk202.github.io',
  base: process.env.BASE_PATH || '/',
  integrations: [mdx()],
});
