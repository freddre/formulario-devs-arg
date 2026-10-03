import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import siteConfigFile from '../site.config.json';
import {
  FORM_FRAME_TITLE,
  FORM_LOADING_ID,
  FORM_MOUNT_ID,
  FRAME_HEIGHT_SUBMIT,
  FRAME_HEIGHT_VIEW,
  SUBMIT_STATUS_ID,
  SUBMIT_STATUS_TEXT,
  frameClassFor,
  initApp,
  type AppDeps,
} from '../src/app';
import { ANALYTICS_EVENTS } from '../src/analytics';
import { validateSiteConfig } from '../src/config';
import { fakeObserver, loadEvent } from './helpers';

const config = validateSiteConfig(siteConfigFile, { production: false });

describe('frameClassFor', () => {
  it('uses the tall responsive frame for the form and a short one for the confirmation', () => {
    expect(frameClassFor('view')).toContain(FRAME_HEIGHT_VIEW);
    expect(frameClassFor('view')).not.toContain(FRAME_HEIGHT_SUBMIT);
    expect(frameClassFor('submit')).toContain(FRAME_HEIGHT_SUBMIT);
    expect(frameClassFor('submit')).not.toContain(FRAME_HEIGHT_VIEW);
  });

  it('keeps the shared classes in both phases', () => {
    expect(frameClassFor('view')).toContain('w-full');
    expect(frameClassFor('submit')).toContain('w-full');
  });
});

describe('index.html contract', () => {
  const html = readFileSync('index.html', 'utf8');

  it('contains the elements initApp looks for', () => {
    expect(html).toContain(`id="${FORM_MOUNT_ID}"`);
    expect(html).toContain(`id="${SUBMIT_STATUS_ID}"`);
    expect(html).toContain(`id="${FORM_LOADING_ID}"`);
  });

  it('declares Argentine Spanish', () => {
    expect(html).toContain('lang="es-AR"');
  });
});

describe('initApp', () => {
  let track: Mock<NonNullable<AppDeps['track']>>;
  let reveal: Mock<NonNullable<AppDeps['reveal']>>;

  beforeEach(() => {
    document.body.innerHTML =
      `<div id="${FORM_MOUNT_ID}"><p id="${FORM_LOADING_ID}">Cargando formulario…</p></div>` +
      `<p id="${SUBMIT_STATUS_ID}"></p>`;
    track = vi.fn(() => true);
    reveal = vi.fn();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'gtag');
  });

  function start(extra: Partial<AppDeps> = {}) {
    const observer = fakeObserver();
    const handle = initApp({
      document,
      config,
      track,
      reveal,
      isBlank: () => false,
      observerFactory: observer.factory,
      ...extra,
    });
    if (handle === null) {
      throw new Error('initApp returned null');
    }
    return { handle, observer };
  }

  it('returns null and does nothing when the page has no mount point', () => {
    document.body.innerHTML = '';
    expect(initApp({ document, config, track })).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('mounts an accessible iframe pointing at the configured form', () => {
    const { handle } = start();
    const frame = document.querySelector(`#${FORM_MOUNT_ID} iframe`);
    expect(frame).toBe(handle.iframe);
    expect(handle.iframe.title).toBe(FORM_FRAME_TITLE);
    expect(handle.iframe.src).toBe(`${config.form.viewUrl}?embedded=true`);
    expect(handle.iframe.className).toBe(frameClassFor('view'));
  });

  it('sends form_visible once when the form scrolls into view', () => {
    const { observer } = start();
    expect(track).not.toHaveBeenCalled();
    observer.fire(true);
    observer.fire(true);
    expect(track).toHaveBeenCalledExactlyOnceWith(ANALYTICS_EVENTS.formVisible);
  });

  it('does not send game_submitted for the first load (form shown)', () => {
    const { handle } = start();
    loadEvent(handle.iframe);
    expect(track).not.toHaveBeenCalled();
    expect(handle.iframe.className).toBe(frameClassFor('view'));
  });

  it('keeps the loading hint until the form has loaded, then removes it', () => {
    const { handle } = start();
    expect(document.getElementById(FORM_LOADING_ID)).not.toBeNull();
    loadEvent(handle.iframe);
    expect(document.getElementById(FORM_LOADING_ID)).toBeNull();
  });

  it('works without the loading hint', () => {
    document.getElementById(FORM_LOADING_ID)?.remove();
    const { handle } = start();
    expect(() => loadEvent(handle.iframe)).not.toThrow();
  });

  it('sends game_submitted, shrinks the frame, announces and reveals on the second load', () => {
    const { handle } = start();
    loadEvent(handle.iframe);
    loadEvent(handle.iframe);

    expect(track).toHaveBeenCalledExactlyOnceWith(ANALYTICS_EVENTS.gameSubmitted);
    expect(handle.iframe.className).toBe(frameClassFor('submit'));
    expect(document.getElementById(SUBMIT_STATUS_ID)?.textContent).toBe(SUBMIT_STATUS_TEXT);
    expect(reveal).toHaveBeenCalledExactlyOnceWith(document.getElementById(FORM_MOUNT_ID));
  });

  it('restores the tall frame and clears the announcement when the form is shown again', () => {
    const { handle } = start();
    loadEvent(handle.iframe);
    loadEvent(handle.iframe);
    loadEvent(handle.iframe);

    expect(handle.iframe.className).toBe(frameClassFor('view'));
    expect(document.getElementById(SUBMIT_STATUS_ID)?.textContent).toBe('');
  });

  it('counts a second submission in the same visit', () => {
    const { handle } = start();
    for (let index = 0; index < 4; index += 1) {
      loadEvent(handle.iframe);
    }
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenLastCalledWith(ANALYTICS_EVENTS.gameSubmitted);
  });

  it('works without the status element', () => {
    document.getElementById(SUBMIT_STATUS_ID)?.remove();
    const { handle } = start();
    loadEvent(handle.iframe);
    expect(() => loadEvent(handle.iframe)).not.toThrow();
    expect(track).toHaveBeenCalledOnce();
  });

  it('works with the real browser defaults: no IntersectionObserver means the form counts as visible at once', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    try {
      const handle = initApp({ document, config, track, reveal });
      expect(handle).not.toBeNull();
      expect(track).toHaveBeenCalledExactlyOnceWith(ANALYTICS_EVENTS.formVisible);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to window.gtag and a reveal that tolerates missing browser APIs', () => {
    const gtag = vi.fn();
    Object.assign(window, { gtag });
    const observer = fakeObserver();
    const handle = initApp({ document, config, isBlank: () => false, observerFactory: observer.factory });
    if (handle === null) {
      throw new Error('initApp returned null');
    }
    observer.fire(true);
    loadEvent(handle.iframe);
    expect(() => loadEvent(handle.iframe)).not.toThrow();
    expect(gtag.mock.calls.map((call) => call[1])).toEqual(['form_visible', 'game_submitted']);
  });

  it('scrolls smoothly unless the visitor prefers reduced motion', () => {
    const scrollIntoView = vi.fn();
    const mount = document.getElementById(FORM_MOUNT_ID);
    if (mount === null) {
      throw new Error('missing mount');
    }
    mount.scrollIntoView = scrollIntoView;
    const matchMedia = vi.fn((query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);

    const observer = fakeObserver();
    const handle = initApp({ document, config, track, isBlank: () => false, observerFactory: observer.factory });
    if (handle === null) {
      throw new Error('initApp returned null');
    }
    loadEvent(handle.iframe);
    loadEvent(handle.iframe);
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'auto', block: 'start' });

    matchMedia.mockImplementation(() => ({ matches: false }) as MediaQueryList);
    loadEvent(handle.iframe);
    loadEvent(handle.iframe);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
    vi.unstubAllGlobals();
  });
});
