import { describe, expect, it } from 'vitest';
import siteConfigFile from '../site.config.json';
import {
  buildEmbedUrl,
  ConfigError,
  FORM_VIEW_URL_PATTERN,
  MEASUREMENT_ID_PATTERN,
  validateSiteConfig,
} from '../src/config';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd/viewform';

const valid = {
  siteUrl: 'https://freddre.github.io/formulario-devs-arg/',
  analytics: { measurementId: 'G-AB12CD34EF' },
  form: { viewUrl: FORM_URL },
  steamGroup: { name: 'Steam Argentina', url: 'https://steamcommunity.com/groups/argentina' },
  contact: { label: 'el Discord de Steam Argentina', href: 'https://discord.gg/VPhJYNKMTE' },
  cutoffText: '  Cargá tu juego antes del domingo.  ',
};

function problemsOf(raw: unknown, production: boolean): readonly string[] {
  try {
    validateSiteConfig(raw, { production });
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.problems;
    }
    throw error;
  }
  return [];
}

describe('validateSiteConfig', () => {
  it('accepts a complete config in production and trims cutoffText', () => {
    const config = validateSiteConfig(valid, { production: true });
    expect(config.siteUrl).toBe(valid.siteUrl);
    expect(config.analytics.measurementId).toBe('G-AB12CD34EF');
    expect(config.form.viewUrl).toBe(FORM_URL);
    expect(config.contact.href).toBe('https://discord.gg/VPhJYNKMTE');
    expect(config.cutoffText).toBe('Cargá tu juego antes del domingo.');
  });

  it('accepts an empty cutoffText', () => {
    expect(validateSiteConfig({ ...valid, cutoffText: '' }, { production: true }).cutoffText).toBe('');
  });

  it('accepts placeholders outside production', () => {
    const placeholders = {
      ...valid,
      analytics: { measurementId: 'G-XXXXXXXXXX' },
      form: { viewUrl: 'https://docs.google.com/forms/d/e/FORM_ID/viewform' },
    };
    expect(problemsOf(placeholders, false)).toEqual([]);
  });

  it('rejects placeholders in production, naming both', () => {
    const placeholders = {
      ...valid,
      analytics: { measurementId: 'G-XXXXXXXXXX' },
      form: { viewUrl: 'https://docs.google.com/forms/d/e/FORM_ID/viewform' },
    };
    const problems = problemsOf(placeholders, true);
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toContain('G-XXXXXXXXXX');
    expect(problems.join('\n')).toContain('FORM_ID');
  });

  it.each(['G-123', 'UA-12345678-1', 'g-ab12cd34ef', '', 'G-AB12CD34EF-EXTRA'])(
    'rejects the Measurement ID %j',
    (measurementId) => {
      expect(problemsOf({ ...valid, analytics: { measurementId } }, false)).not.toEqual([]);
    },
  );

  it.each([
    'http://docs.google.com/forms/d/e/abc/viewform',
    'https://example.com/forms/d/e/abc/viewform',
    'https://docs.google.com/forms/d/e/abc/edit',
    'https://docs.google.com/forms/d/e/abc/viewform?embedded=true',
    'not a url',
  ])('rejects the form URL %j', (viewUrl) => {
    expect(problemsOf({ ...valid, form: { viewUrl } }, false)).not.toEqual([]);
  });

  it('requires https URLs and a trailing slash on siteUrl', () => {
    expect(problemsOf({ ...valid, siteUrl: 'http://freddre.github.io/formulario-devs-arg/' }, false)).not.toEqual([]);
    expect(problemsOf({ ...valid, siteUrl: 'https://freddre.github.io/formulario-devs-arg' }, false)).toContain(
      'siteUrl must end with "/"',
    );
  });

  it('requires non-empty labels and https links for the group and the contact', () => {
    const problems = problemsOf(
      {
        ...valid,
        steamGroup: { name: ' ', url: 'steamcommunity.com/groups/argentina' },
        contact: { label: '', href: 'mailto:someone@example.com' },
      },
      false,
    );
    expect(problems).toHaveLength(4);
  });

  it('reports every problem at once, including missing and mistyped fields', () => {
    const problems = problemsOf({ siteUrl: 42, analytics: null }, false);
    expect(problems).toContain('siteUrl must be a string');
    expect(problems).toContain('analytics.measurementId must be a string');
    expect(problems).toContain('form.viewUrl must be a string');
    expect(problems).toContain('cutoffText must be a string');
  });

  it.each([null, 'text', 7, ['array']])('rejects a non-object config %j', (raw) => {
    expect(problemsOf(raw, false)).toContain('config must be a JSON object');
  });

  it('puts all problems in the error message', () => {
    expect(() => validateSiteConfig({}, { production: false })).toThrow(/Invalid site\.config\.json:\n- /);
  });

  it('accepts the repository site.config.json outside production', () => {
    expect(problemsOf(siteConfigFile, false)).toEqual([]);
  });

  it('exposes patterns that match real-looking values', () => {
    expect(MEASUREMENT_ID_PATTERN.test('G-ABC123DEF4')).toBe(true);
    expect(FORM_VIEW_URL_PATTERN.test(FORM_URL)).toBe(true);
  });
});

describe('buildEmbedUrl', () => {
  it('adds embedded=true', () => {
    expect(buildEmbedUrl(FORM_URL)).toBe(`${FORM_URL}?embedded=true`);
  });

  it('keeps existing query parameters and does not duplicate embedded', () => {
    expect(buildEmbedUrl(`${FORM_URL}?usp=sf_link`)).toBe(`${FORM_URL}?usp=sf_link&embedded=true`);
    expect(buildEmbedUrl(`${FORM_URL}?embedded=false`)).toBe(`${FORM_URL}?embedded=true`);
  });
});
