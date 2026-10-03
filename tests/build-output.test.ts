import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import siteConfigFile from '../site.config.json';

/**
 * Post-build checks. They run against the build output when it exists:
 * `docs/` by default, or the folder in BUILD_DIR (for example `.check-build`).
 * Run `npm run verify` (build, then tests) to get them executed.
 */
const buildDir = process.env['BUILD_DIR'] ?? 'docs';
const indexPath = join(buildDir, 'index.html');
const isProductionDir = buildDir === 'docs';

describe.skipIf(!existsSync(indexPath))(`build output in ${buildDir}`, () => {
  const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  const assets = existsSync(join(buildDir, 'assets')) ? readdirSync(join(buildDir, 'assets')) : [];
  const css = assets
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(join(buildDir, 'assets', name), 'utf8'))
    .join('\n');

  it('declares Argentine Spanish and keeps the document title', () => {
    expect(html).toContain('lang="es-AR"');
    expect(html).toContain('<title>Sumá tu juego a los lanzamientos argentinos de Steam</title>');
  });

  it('has no unresolved template markers', () => {
    expect(html).not.toMatch(/\{\{|\}\}/);
  });

  it('embeds the configured GA4 ID and form link', () => {
    expect(html).toContain(`gtag/js?id=${siteConfigFile.analytics.measurementId}`);
    expect(html).toContain(`gtag('config', '${siteConfigFile.analytics.measurementId}')`);
    expect(html).toContain(`href="${siteConfigFile.form.viewUrl}"`);
  });

  it('uses relative asset URLs so it works under /formulario-devs-arg/', () => {
    expect(html).toMatch(/src="\.\/assets\/[^"]+\.js"/);
    expect(html).toMatch(/href="\.\/favicon\.svg"/);
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/);
  });

  it('ships the stylesheet with classes used only in the HTML and in the TypeScript sources', () => {
    expect(css).toContain('.bg-amber-400');
    expect(css).toContain('height:max(2440px,');
    // Confirmation-page steps: the base height and the first min-width step.
    expect(css).toContain('.h-\\[539px\\]');
    expect(css).toContain('.min-\\[360px\\]\\:h-\\[479px\\]');
  });

  it('adds .nojekyll so GitHub Pages serves the files as they are', () => {
    expect(existsSync(join(buildDir, '.nojekyll'))).toBe(true);
  });

  it.skipIf(!isProductionDir)('docs/ is built from real values, not from placeholders', () => {
    expect(html).not.toContain('G-XXXXXXXXXX');
    expect(html).not.toContain('FORM_ID');
    const script = assets
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(join(buildDir, 'assets', name), 'utf8'))
      .join('\n');
    // The bundle also holds the placeholder constants used by the config validator,
    // so check the embedded config values instead of the bare placeholder words.
    expect(script).toContain(siteConfigFile.analytics.measurementId);
    expect(script).toContain(siteConfigFile.form.viewUrl);
    expect(script).not.toContain('https://docs.google.com/forms/d/e/FORM_ID/viewform');
  });
});
