import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import siteConfig from './site.config.json' with { type: 'json' };
import { htmlConfigPlugin } from './tools/html-config.ts';

/**
 * - `vite build` (mode "production") refuses placeholder values in site.config.json.
 * - `vite build --mode check` accepts them, to verify the pipeline before real IDs exist.
 * - Output goes to docs/, which GitHub Pages serves from the main branch.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [tailwindcss(), htmlConfigPlugin(siteConfig, { production: mode === 'production' })],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'tools/**/*.ts'],
      exclude: ['src/main.ts'],
      reporter: ['text'],
    },
  },
}));
