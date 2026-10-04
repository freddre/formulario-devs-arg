import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateSiteConfig, type SiteConfig } from '../src/config';
import { escapeHtml, htmlConfigPlugin, renderTemplate, templateValues } from '../tools/html-config';

const fixture = {
  siteUrl: 'https://freddre.github.io/formulario-devs-arg/',
  analytics: { measurementId: 'G-AB12CD34EF' },
  form: { viewUrl: 'https://docs.google.com/forms/d/e/abc123/viewform' },
  steamGroup: { name: 'Comunidad Steam Argentina', url: 'https://steamcommunity.com/groups/argentina' },
  contact: { label: 'el Discord de la Comunidad Steam Argentina', href: 'https://discord.gg/VPhJYNKMTE' },
  cutoffText: '',
};

const config: SiteConfig = validateSiteConfig(fixture, { production: true });
const placeholderConfig = {
  ...fixture,
  analytics: { measurementId: 'G-XXXXXXXXXX' },
  form: { viewUrl: 'https://docs.google.com/forms/d/e/FORM_ID/viewform' },
};

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    );
  });

  it('leaves plain text, accents and inverted marks untouched', () => {
    expect(escapeHtml('¡Cargá tu juego, che!')).toBe('¡Cargá tu juego, che!');
  });
});

describe('templateValues', () => {
  it('maps every config field used by index.html', () => {
    expect(templateValues(config)).toEqual({
      siteUrl: config.siteUrl,
      measurementId: 'G-AB12CD34EF',
      formViewUrl: 'https://docs.google.com/forms/d/e/abc123/viewform',
      steamGroupName: 'Comunidad Steam Argentina',
      steamGroupUrl: 'https://steamcommunity.com/groups/argentina',
      contactLabel: 'el Discord de la Comunidad Steam Argentina',
      contactHref: 'https://discord.gg/VPhJYNKMTE',
      cutoffText: '',
    });
  });
});

describe('renderTemplate', () => {
  it('replaces placeholders, repeated ones included', () => {
    expect(renderTemplate('{{a}} y {{b}} y {{a}}', { a: 'uno', b: 'dos' })).toBe('uno y dos y uno');
  });

  it('escapes the substituted values', () => {
    expect(renderTemplate('<a title="{{t}}">{{t}}</a>', { t: 'a "b" & <c>' })).toBe(
      '<a title="a &quot;b&quot; &amp; &lt;c&gt;">a &quot;b&quot; &amp; &lt;c&gt;</a>',
    );
  });

  it('keeps an {{#if}} block only when the value is not empty', () => {
    const template = 'antes{{#if x}} [{{x}}]{{/if}} después';
    expect(renderTemplate(template, { x: 'dato' })).toBe('antes [dato] después');
    expect(renderTemplate(template, { x: '' })).toBe('antes después');
    expect(renderTemplate(template, { x: '   ' })).toBe('antes después');
  });

  it('handles multi-line {{#if}} blocks', () => {
    const template = 'a\n{{#if x}}\n<p>{{x}}</p>\n{{/if}}\nb';
    expect(renderTemplate(template, { x: 'hola' })).toBe('a\n\n<p>hola</p>\n\nb');
    expect(renderTemplate(template, { x: '' })).toBe('a\n\nb');
  });

  it('throws for a placeholder without a value', () => {
    expect(() => renderTemplate('{{missing}}', {})).toThrow('no value for placeholder "{{missing}}"');
    expect(() => renderTemplate('{{#if missing}}x{{/if}}', {})).toThrow('missing');
  });

  it('throws for malformed markers instead of shipping them', () => {
    expect(() => renderTemplate('{{#if x}}sin cierre', { x: 'v' })).toThrow('malformed template marker');
    expect(() => renderTemplate('{{ spaced }}', {})).toThrow('malformed template marker');
  });

  it('leaves text without markers unchanged', () => {
    const html = '<p>function f() { return { a: 1 }; }</p>';
    expect(renderTemplate(html, {})).toBe(html);
  });
});

describe('index.html against the real template values', () => {
  const html = readFileSync('index.html', 'utf8');

  it('renders completely with the cutoff line hidden', () => {
    const rendered = renderTemplate(html, templateValues(config));
    expect(rendered).not.toMatch(/\{\{|\}\}/);
    expect(rendered).toContain(`https://www.googletagmanager.com/gtag/js?id=${config.analytics.measurementId}`);
    expect(rendered).toContain(`gtag('config', '${config.analytics.measurementId}')`);
    expect(rendered).toContain(`href="${config.form.viewUrl}"`);
    expect(rendered).toContain(`<link rel="canonical" href="${config.siteUrl}" />`);
    expect(rendered).not.toContain('bg-amber-400/15 px-3 py-2 font-medium');
  });

  it('shows the cutoff line when configured', () => {
    const withCutoff = { ...config, cutoffText: 'Cargá tu juego antes del domingo.' };
    const rendered = renderTemplate(html, templateValues(withCutoff));
    expect(rendered).toContain('Cargá tu juego antes del domingo.');
  });
});

describe('htmlConfigPlugin', () => {
  it('is a pre-order transformIndexHtml plugin that renders the template', () => {
    const plugin = htmlConfigPlugin(config, { production: true });
    expect(plugin.name).toBe('html-config');
    const hook = plugin.transformIndexHtml;
    if (typeof hook !== 'object' || hook === null || typeof hook.handler !== 'function') {
      throw new Error('transformIndexHtml must be an object hook');
    }
    expect(hook.order).toBe('pre');
    const context = { path: '/index.html', filename: 'index.html' };
    const pluginContext = {} as ThisParameterType<typeof hook.handler>;
    expect(hook.handler.call(pluginContext, '<p>{{measurementId}}</p>', context)).toBe('<p>G-AB12CD34EF</p>');
  });

  it('refuses the placeholder config in production but not otherwise', () => {
    expect(() => htmlConfigPlugin(placeholderConfig, { production: true })).toThrow(/placeholder/);
    expect(() => htmlConfigPlugin(placeholderConfig, { production: false })).not.toThrow();
  });
});
