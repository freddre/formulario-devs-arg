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

/** Accessible name of the iframe. */
export const FORM_FRAME_TITLE = 'Formulario para sumar tu juego a los lanzamientos argentinos de Steam';

const FRAME_BASE = 'relative block w-full border-0';
/** The empty form is tall; the confirmation page that replaces it is short. */
const FRAME_HEIGHT_VIEW = 'h-[1900px] sm:h-[1600px]';
const FRAME_HEIGHT_SUBMIT = 'h-[420px]';

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
