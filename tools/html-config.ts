/**
 * Build-time HTML templating. `index.html` contains `{{name}}` placeholders and
 * `{{#if name}}...{{/if}}` blocks; this module fills them from `site.config.json`.
 * A placeholder without a value fails the build instead of shipping as literal text.
 */
import type { Plugin } from 'vite';
import { validateSiteConfig, type SiteConfig, type ValidateOptions } from '../src/config.ts';

export type TemplateValues = Readonly<Record<string, string>>;

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for use in HTML text nodes and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Flattens the validated config into the placeholders used by index.html. */
export function templateValues(config: SiteConfig): TemplateValues {
  return {
    siteUrl: config.siteUrl,
    measurementId: config.analytics.measurementId,
    formViewUrl: config.form.viewUrl,
    steamGroupName: config.steamGroup.name,
    steamGroupUrl: config.steamGroup.url,
    contactLabel: config.contact.label,
    contactHref: config.contact.href,
    cutoffText: config.cutoffText,
  };
}

const IF_BLOCK = /\{\{#if ([A-Za-z][A-Za-z0-9]*)\}\}([\s\S]*?)\{\{\/if\}\}/g;
const PLACEHOLDER = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g;
const LEFTOVER = /\{\{[^}]*\}\}/;

/**
 * Renders the template:
 *  1. `{{#if key}}...{{/if}}` blocks (not nestable) are kept only when `values[key]` is not empty.
 *  2. `{{key}}` is replaced by the HTML-escaped value.
 * @throws Error when a placeholder has no value or malformed markers remain.
 */
export function renderTemplate(html: string, values: TemplateValues): string {
  const lookup = (key: string): string => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`html-config: no value for placeholder "{{${key}}}"`);
    }
    return value;
  };

  const withBlocks = html.replace(IF_BLOCK, (_match, key: string, body: string) =>
    lookup(key).trim() === '' ? '' : body,
  );
  const rendered = withBlocks.replace(PLACEHOLDER, (_match, key: string) => escapeHtml(lookup(key)));

  const leftover = LEFTOVER.exec(rendered);
  if (leftover) {
    throw new Error(`html-config: malformed template marker "${leftover[0]}"`);
  }
  return rendered;
}

/**
 * Vite plugin: validates `site.config.json` when the config is loaded and fills `index.html`.
 * With `production: true`, placeholder values (GA4 ID, form ID) abort the build.
 */
export function htmlConfigPlugin(rawConfig: unknown, options: ValidateOptions): Plugin {
  const values = templateValues(validateSiteConfig(rawConfig, options));
  return {
    name: 'html-config',
    transformIndexHtml: {
      order: 'pre',
      handler: (html: string): string => renderTemplate(html, values),
    },
  };
}
