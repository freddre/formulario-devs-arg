/**
 * Typed shape and validation of `site.config.json`, the single place that holds the
 * public (non-secret) values of the site. Pure functions only: no I/O, no DOM.
 *
 * Used at runtime (src/main.ts) and at build time (vite.config.ts through tools/html-config.ts).
 */

/** A link with a human readable label (used for the contact shown on the page). */
export interface LinkConfig {
  readonly label: string;
  readonly href: string;
}

/** Shape of `site.config.json`. Every field is required except `cutoffText`, which may be empty. */
export interface SiteConfig {
  /** Public URL of the deployed site, always with a trailing slash. */
  readonly siteUrl: string;
  readonly analytics: { readonly measurementId: string };
  readonly form: {
    /** Public `.../forms/d/e/<id>/viewform` URL of the Google Form (without query string). */
    readonly viewUrl: string;
  };
  readonly steamGroup: { readonly name: string; readonly url: string };
  readonly contact: LinkConfig;
  /** Optional line shown under the hero (for example the weekly submission deadline). Empty hides it. */
  readonly cutoffText: string;
}

export interface ValidateOptions {
  /** When true, placeholder values (`G-XXXXXXXXXX`, `FORM_ID`) are rejected. */
  readonly production: boolean;
}

/** Thrown when `site.config.json` is invalid. `problems` lists every issue found. */
export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid site.config.json:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/** GA4 Measurement ID, for example `G-AB12CD34EF`. */
export const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,12}$/;
/** Placeholder written in the repository until the real GA4 ID is known. */
export const MEASUREMENT_ID_PLACEHOLDER = 'G-XXXXXXXXXX';
/** Public Google Form URL: `https://docs.google.com/forms/d/e/<id>/viewform`. */
export const FORM_VIEW_URL_PATTERN = /^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform$/;
/** Placeholder written in the repository until the real form exists. */
export const FORM_ID_PLACEHOLDER = 'FORM_ID';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(parent: unknown, key: string, path: string, problems: string[]): string {
  const value = isRecord(parent) ? parent[key] : undefined;
  if (typeof value !== 'string') {
    problems.push(`${path} must be a string`);
    return '';
  }
  return value;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function requireHttpsUrl(value: string, path: string, problems: string[]): void {
  if (!isHttpsUrl(value)) {
    problems.push(`${path} must be an absolute https:// URL (got "${value}")`);
  }
}

function requireText(value: string, path: string, problems: string[]): void {
  if (value.trim() === '') {
    problems.push(`${path} must not be empty`);
  }
}

/**
 * Validates an untrusted value (parsed JSON) and returns it typed.
 * Throws {@link ConfigError} listing every problem, so one build run reports all of them.
 */
export function validateSiteConfig(raw: unknown, options: ValidateOptions): SiteConfig {
  const problems: string[] = [];
  const root: unknown = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) {
    problems.push('config must be a JSON object');
  }
  const field = (key: string): unknown => (isRecord(root) ? root[key] : undefined);

  const siteUrl = readString(root, 'siteUrl', 'siteUrl', problems);
  requireHttpsUrl(siteUrl, 'siteUrl', problems);
  if (siteUrl !== '' && !siteUrl.endsWith('/')) {
    problems.push('siteUrl must end with "/"');
  }

  const measurementId = readString(field('analytics'), 'measurementId', 'analytics.measurementId', problems);
  if (measurementId === MEASUREMENT_ID_PLACEHOLDER) {
    if (options.production) {
      problems.push('analytics.measurementId is still the placeholder G-XXXXXXXXXX');
    }
  } else if (!MEASUREMENT_ID_PATTERN.test(measurementId)) {
    problems.push(`analytics.measurementId must look like G-XXXXXXXXXX (got "${measurementId}")`);
  }

  const viewUrl = readString(field('form'), 'viewUrl', 'form.viewUrl', problems);
  if (viewUrl.includes(`/${FORM_ID_PLACEHOLDER}/`)) {
    if (options.production) {
      problems.push('form.viewUrl still contains the FORM_ID placeholder');
    }
  } else if (!FORM_VIEW_URL_PATTERN.test(viewUrl)) {
    problems.push(`form.viewUrl must look like https://docs.google.com/forms/d/e/<id>/viewform (got "${viewUrl}")`);
  }

  const groupName = readString(field('steamGroup'), 'name', 'steamGroup.name', problems);
  const groupUrl = readString(field('steamGroup'), 'url', 'steamGroup.url', problems);
  requireText(groupName, 'steamGroup.name', problems);
  requireHttpsUrl(groupUrl, 'steamGroup.url', problems);

  const contactLabel = readString(field('contact'), 'label', 'contact.label', problems);
  const contactHref = readString(field('contact'), 'href', 'contact.href', problems);
  requireText(contactLabel, 'contact.label', problems);
  requireHttpsUrl(contactHref, 'contact.href', problems);

  const cutoffText = readString(root, 'cutoffText', 'cutoffText', problems);

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return {
    siteUrl,
    analytics: { measurementId },
    form: { viewUrl },
    steamGroup: { name: groupName, url: groupUrl },
    contact: { label: contactLabel, href: contactHref },
    cutoffText: cutoffText.trim(),
  };
}

/**
 * URL loaded inside the iframe: the public view URL plus `embedded=true`
 * (Google's embed mode, without the form header chrome).
 */
export function buildEmbedUrl(viewUrl: string): string {
  const url = new URL(viewUrl);
  url.searchParams.set('embedded', 'true');
  return url.toString();
}
