/**
 * Wires the page: mounts the Google Form iframe and reports the two analytics events.
 * All browser dependencies are injectable so this module is testable without a real browser.
 */
import { ANALYTICS_EVENTS, track as defaultTrack, type AnalyticsEventName, type EventParams } from './analytics';
import type { SiteConfig } from './config';
import { mountFormEmbed, type EmbedHandle, type ObserverFactory } from './form-embed';
import type { FormPhase } from './form-tracker';

/** `id` of the element that receives the iframe (see index.html). */
export const FORM_MOUNT_ID = 'form-mount';
/** `id` of the visually hidden live region that announces a received submission. */
export const SUBMIT_STATUS_ID = 'submit-status';
/** `id` of the "loading" hint that sits behind the iframe until the form has loaded. */
export const FORM_LOADING_ID = 'form-loading';

/** Accessible name of the iframe. */
export const FORM_FRAME_TITLE = 'Formulario para sumar tu juego a los lanzamientos argentinos de Steam';

const FRAME_BASE = 'relative block w-full border-0';
/**
 * Height of the embedded form page. Google's embed does not report its height to the parent, so
 * it is estimated from the viewport width V (the iframe is V - 32 px wide, at most 736 px).
 * Measured content height of the 10-question form, with a validation error showing (2026-10-03):
 *   V=320 -> 3006, 340 -> 2898, 360 -> 2815, 375 -> 2775, 390 -> 2751, 414 -> 2671, 450 -> 2592,
 *   500 -> 2528, 550 -> 2428, 600 -> 2408, 640 -> 2344, 700 -> 2334, V>=768 -> 2314.
 * The expression is the upper envelope of two straight lines (through the 320 / 414 / 768 px points)
 * plus a 120 px safety margin, with a floor for wide screens. `tests/form-height.test.ts` checks it
 * against the table. Re-measure and update both when the form gets more questions or Google changes the embed.
 */
export const FRAME_HEIGHT_VIEW = 'h-[max(2440px,calc(3126px_-_3.56*(100vw_-_320px)),calc(3205px_-_100vw))]';
/**
 * The confirmation page that replaces the form is short, and its height only changes where its texts wrap.
 * Measured content height (2026-10-03, on an 8 px width grid) by viewport width V:
 *   V<=352 -> 489, 360-408 -> 429, 416-440 -> 389, 448-576 -> 369, 584-616 -> 349, V>=624 -> 309.
 * Each step switches at the first measured width of the shorter content, so the unmeasured gap before it
 * keeps the taller height, and every step adds a 50 px margin (Google's texts change with the visitor's language).
 */
export const FRAME_HEIGHT_SUBMIT = [
  'h-[539px]',
  'min-[360px]:h-[479px]',
  'min-[416px]:h-[439px]',
  'min-[448px]:h-[419px]',
  'min-[584px]:h-[399px]',
  'min-[624px]:h-[359px]',
].join(' ');

/** Text read by screen readers once the confirmation page has loaded. */
export const SUBMIT_STATUS_TEXT = 'Recibimos tu envío. ¡Gracias por sumar tu juego!';

/** Tailwind classes of the iframe for each phase (tall form, short confirmation). */
export function frameClassFor(phase: FormPhase): string {
  return `${FRAME_BASE} ${phase === 'view' ? FRAME_HEIGHT_VIEW : FRAME_HEIGHT_SUBMIT}`;
}

export interface AppDeps {
  readonly document: Document;
  readonly config: SiteConfig;
  /** Defaults to the GA4 wrapper. */
  readonly track?: (eventName: AnalyticsEventName, params?: EventParams) => boolean;
  readonly observerFactory?: ObserverFactory;
  readonly isBlank?: (iframe: HTMLIFrameElement) => boolean;
  /** Defaults to Element.scrollIntoView honouring prefers-reduced-motion. */
  readonly reveal?: (element: HTMLElement) => void;
}

function revealElement(element: HTMLElement): void {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  element.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Mounts the form and starts tracking.
 * @returns the embed handle, or null when the page has no mount point.
 */
export function initApp(deps: AppDeps): EmbedHandle | null {
  const mount = deps.document.getElementById(FORM_MOUNT_ID);
  if (mount === null) {
    return null;
  }
  const status = deps.document.getElementById(SUBMIT_STATUS_ID);
  const loading = deps.document.getElementById(FORM_LOADING_ID);
  const track = deps.track ?? defaultTrack;
  const reveal = deps.reveal ?? revealElement;

  return mountFormEmbed({
    mount,
    viewUrl: deps.config.form.viewUrl,
    title: FORM_FRAME_TITLE,
    className: frameClassFor('view'),
    onVisible: () => {
      track(ANALYTICS_EVENTS.formVisible);
    },
    onPhase: (phase, _loads, iframe) => {
      // The form is on screen now: drop the hint so screen readers stop reading "Cargando formulario…".
      loading?.remove();
      iframe.className = frameClassFor(phase);
      if (status !== null) {
        status.textContent = phase === 'submit' ? SUBMIT_STATUS_TEXT : '';
      }
      if (phase === 'submit') {
        track(ANALYTICS_EVENTS.gameSubmitted);
        reveal(mount);
      }
    },
    ...(deps.observerFactory === undefined ? {} : { observerFactory: deps.observerFactory }),
    ...(deps.isBlank === undefined ? {} : { isBlank: deps.isBlank }),
  });
}
