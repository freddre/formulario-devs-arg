import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import siteConfigFile from '../site.config.json';
import { validateSiteConfig } from '../src/config';
import { renderTemplate, templateValues } from '../tools/html-config';

/**
 * Content and structure of the rendered page (index.html filled with site.config.json).
 * Guards the branding (community, not Valve), the accessibility basics and the links inside the page.
 */
const config = validateSiteConfig(siteConfigFile, { production: false });
const rendered = renderTemplate(readFileSync('index.html', 'utf8'), templateValues(config));

let doc: Document;

beforeAll(() => {
  doc = new DOMParser().parseFromString(rendered, 'text/html');
});

function meta(attribute: 'name' | 'property', key: string): string | null {
  return doc.querySelector(`meta[${attribute}="${key}"]`)?.getAttribute('content') ?? null;
}

describe('branding', () => {
  it('names the project "Comunidad Steam Argentina"', () => {
    expect(config.steamGroup.name).toBe('Comunidad Steam Argentina');
    expect(doc.querySelector('header')?.textContent).toContain('Comunidad Steam Argentina');
    expect(doc.querySelector('footer')?.textContent).toContain('Comunidad Steam Argentina');
    expect(doc.title).toContain('Comunidad Steam Argentina');
    expect(meta('property', 'og:site_name')).toBe('Comunidad Steam Argentina');
  });

  it('never presents "Steam Argentina" without "Comunidad", so it cannot pass as an official Steam page', () => {
    expect(rendered).not.toMatch(/(?<!Comunidad )Steam Argentina/);
    expect(rendered).not.toMatch(/lanzamientos argentinos de Steam/);
  });

  it('says in the footer that the project is independent of Valve', () => {
    const footer = doc.querySelector('footer')?.textContent ?? '';
    expect(footer).toMatch(/independiente/);
    expect(footer).toMatch(/No está afiliado ni respaldado por Valve Corporation/);
    expect(footer).toMatch(/Steam es una\s+marca registrada de Valve Corporation/);
  });

  it('starts with the skip link followed by the header, with no decorative bar above it', () => {
    const topLevel = [...doc.body.children].map((element) => element.tagName.toLowerCase());
    expect(topLevel).toEqual(['svg', 'a', 'header', 'main', 'footer']);
    expect(doc.body.children[1]?.getAttribute('href')).toBe('#formulario');
  });
});

describe('document', () => {
  it('has a single h1 that carries the pitch', () => {
    const headings = doc.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Sumá tu juego a los lanzamientos argentinos en Steam',
    );
  });

  it('has unique ids, and every in-page link and <use> points to one of them', () => {
    const ids = [...doc.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    const targets = [...doc.querySelectorAll('a[href^="#"], use[href^="#"]')].map((element) =>
      (element.getAttribute('href') ?? '').slice(1),
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((target) => !ids.includes(target))).toEqual([]);
  });

  it('points every aria-labelledby to an existing heading', () => {
    const labels = [...doc.querySelectorAll('[aria-labelledby]')].map(
      (element) => element.getAttribute('aria-labelledby') ?? '',
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(doc.getElementById(label)?.textContent?.trim()).toBeTruthy();
    }
  });

  it('hides every SVG from assistive technology (they are all decorative)', () => {
    const svgs = [...doc.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.filter((svg) => svg.closest('[aria-hidden="true"]') === null)).toHaveLength(0);
  });

  it('opens external links in a new tab safely and announces it', () => {
    const external = [...doc.querySelectorAll('a[target="_blank"]')];
    expect(external.length).toBeGreaterThanOrEqual(4);
    for (const link of external) {
      expect(link.getAttribute('rel')).toContain('noopener');
    }
    const links = [...doc.querySelectorAll('a[href^="https://discord.gg"], a[href^="https://steamcommunity.com"]')];
    for (const link of links) {
      expect(link.textContent).toContain('se abre en una pestaña nueva');
    }
  });

  it('keeps the fallback link to the form above the embedded form', () => {
    const fallback = doc.querySelector(`a[href="${config.form.viewUrl}"]`);
    const mount = doc.getElementById('form-mount');
    expect(fallback).not.toBeNull();
    expect(mount).not.toBeNull();
    if (fallback !== null && mount !== null) {
      expect(fallback.compareDocumentPosition(mount) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('share preview', () => {
  it('describes the page for social networks with an absolute large image', () => {
    expect(meta('property', 'og:title')).toBe('Sumá tu juego a los lanzamientos argentinos en Steam');
    expect(meta('property', 'og:description')).toContain('Comunidad Steam Argentina');
    expect(meta('property', 'og:image')).toBe(`${config.siteUrl}og-image.png`);
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'og:image:alt')).toContain('Comunidad Steam Argentina');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });
});
