import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./web/', import.meta.url)),
  base: '/studio-assets/',
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL('../.cache/studio/web/', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    rolldownOptions: { output: { entryFileNames: 'main.js', assetFileNames: 'style.css' } },
  },
});
