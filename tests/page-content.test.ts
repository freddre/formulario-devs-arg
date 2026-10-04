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

describe('hero', () => {
  const header = (): Element => {
    const element = doc.querySelector('header');
    if (element === null) {
      throw new Error('the page has no header');
    }
    return element;
  };

  it('has no decorative graphics: the only SVG is the arrow of the call to action', () => {
    const svgs = header().querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0]?.querySelector('use')?.getAttribute('href')).toBe('#arrow-down');
    expect(doc.getElementById('sol')).toBeNull();
  });

  it('highlights "argentinos" in yellow in the heading', () => {
    const accent = header().querySelector('h1 span');
    expect(accent?.textContent).toBe('argentinos');
    expect(accent?.className).toContain('text-amber-400');
  });

  it('does not list quick facts under the button', () => {
    expect(header().querySelector('ul')).toBeNull();
    expect(header().textContent).not.toMatch(/Lleva menos de 2 minutos/);
    expect(header().textContent).not.toMatch(/Solo para estudios con base en Argentina/);
  });

  it('starts the call to action sentence on its own line', () => {
    const intro = [...header().querySelectorAll('p')].find((p) => p.textContent?.includes('Cargá el tuyo'));
    expect(intro).toBeDefined();
    expect(intro?.innerHTML).toMatch(/de acá\.\s*<br>\s*Cargá el tuyo en este formulario/);
  });
});

describe('sections', () => {
  const headings = (): string[] =>
    [...doc.querySelectorAll('main h2')].map((heading) => heading.textContent?.trim() ?? '');

  it('puts who can participate right below how it works, ahead of the form', () => {
    expect(headings()).toEqual(['Cómo funciona', 'Quiénes pueden participar', 'Cargá tu juego', 'Privacidad']);
  });

  it('still sends the skip link and the call to action to the form', () => {
    const targets = [...doc.querySelectorAll('a[href="#formulario"]')];
    expect(targets).toHaveLength(2);
    expect(doc.getElementById('formulario')?.querySelector('h2')?.textContent).toBe('Cargá tu juego');
  });
});

describe('eligibility list', () => {
  const section = (): Element => {
    const element = doc.getElementById('requisitos-titulo')?.closest('section');
    if (element === undefined || element === null) {
      throw new Error('the page has no eligibility section');
    }
    return element;
  };
  const items = (): Element[] => [...section().querySelectorAll('ul > li')];
  /** Icon of one list item: the SVG inside its decorative tile. */
  const iconOf = (item: Element): Element | null => item.querySelector('[aria-hidden="true"] svg');
  const markup = (svg: Element | null): string => svg?.innerHTML.replace(/\s+/g, ' ').trim() ?? '';

  it('keeps the four requirements, in order', () => {
    const texts = items().map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain('con base en Argentina');
    expect(texts[1]).toContain('su página en Steam');
    expect(texts[2]).toContain('acceso anticipado');
    expect(texts[3]).toContain('Revisamos todos los envíos');
  });

  it('gives every item its own drawn icon instead of a repeated check mark', () => {
    const icons = items().map(iconOf);
    expect(icons.every((icon) => icon !== null)).toBe(true);
    expect(icons.every((icon) => icon?.querySelector('use') === null)).toBe(true);
    expect(doc.getElementById('check')).toBeNull();

    const drawings = icons.map(markup);
    expect(drawings.every((drawing) => drawing.length > 0)).toBe(true);
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  it('does not reuse an icon of the steps above', () => {
    const steps = doc.getElementById('como-funciona-titulo')?.closest('section');
    const stepIcons = [...(steps?.querySelectorAll('svg') ?? [])].map(markup);
    expect(stepIcons).toHaveLength(3);
    for (const item of items()) {
      expect(stepIcons).not.toContain(markup(iconOf(item)));
    }
  });

  it('uses the same celeste tile as the steps, with a larger fixed-size icon that never shrinks', () => {
    for (const item of items()) {
      const tile = item.firstElementChild;
      expect(tile?.getAttribute('aria-hidden')).toBe('true');
      expect(tile?.className).toContain('size-12');
      expect(tile?.className).toContain('shrink-0');
      expect(tile?.className).toContain('bg-celeste-400/15');
      expect(tile?.className).toContain('ring-celeste-400/30');
      expect(iconOf(item)?.getAttribute('class')).toBe('size-7');
    }
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
