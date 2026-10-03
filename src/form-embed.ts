/**
 * Builds the Google Form iframe and wires the two analytics signals around it:
 *  - `form_visible`: the form entered the viewport (once per page load).
 *  - `game_submitted`: the iframe reported a "response sent" load (see form-tracker.ts).
 *
 * Browser APIs that are missing in jsdom or old browsers are injectable so the logic is testable.
 */
import { buildEmbedUrl } from './config';
import { createFormTracker, type FormPhase } from './form-tracker';

export interface EmbedOptions {
  /** Element that will receive the iframe. */
  readonly mount: HTMLElement;
  /** Public view URL of the Google Form (without `embedded=true`). */
  readonly viewUrl: string;
  /** Accessible name of the iframe. */
  readonly title: string;
  /** Tailwind classes for the iframe (height, width, background). */
  readonly className: string;
  /** Called once when the form first becomes visible. */
  readonly onVisible: () => void;
  /** Called for every real iframe load: `view` = form shown, `submit` = response sent. */
  readonly onPhase: (phase: FormPhase, loads: number, iframe: HTMLIFrameElement) => void;
  /** Detects the initial about:blank document. Defaults to {@link isBlankFrame}. */
  readonly isBlank?: (iframe: HTMLIFrameElement) => boolean;
  /** Defaults to the global IntersectionObserver; when absent the form counts as visible at once. */
  readonly observerFactory?: ObserverFactory;
}

/** Minimal contract of IntersectionObserver used here. */
export interface ObserverHandle {
  observe(target: Element): void;
  disconnect(): void;
}

export type ObserverFactory = (
  callback: (entries: ReadonlyArray<Pick<IntersectionObserverEntry, 'isIntersecting'>>) => void,
  init: IntersectionObserverInit,
) => ObserverHandle;

export interface EmbedHandle {
  readonly iframe: HTMLIFrameElement;
  /** Stops observing and removes listeners; the iframe stays in the page. */
  destroy(): void;
}

/**
 * True when the iframe still shows its initial about:blank document.
 * Reading the location of a cross-origin document throws, which means a real page is loaded.
 */
export function isBlankFrame(iframe: HTMLIFrameElement): boolean {
  try {
    return iframe.contentWindow?.location.href === 'about:blank';
  } catch {
    return false;
  }
}

function defaultObserverFactory(): ObserverFactory | undefined {
  if (typeof IntersectionObserver === 'undefined') {
    return undefined;
  }
  return (callback, init) => new IntersectionObserver((entries) => callback(entries), init);
}

/**
 * Creates the iframe with `src` already set (so the browser fires a single real load),
 * then inserts it into the mount point.
 */
export function mountFormEmbed(options: EmbedOptions): EmbedHandle {
  const isBlank = options.isBlank ?? isBlankFrame;

  const iframe = document.createElement('iframe');
  const tracker = createFormTracker((phase, loads) => options.onPhase(phase, loads, iframe));
  iframe.title = options.title;
  iframe.className = options.className;
  iframe.setAttribute('loading', 'lazy');
  iframe.src = buildEmbedUrl(options.viewUrl);

  const onLoad = (): void => {
    if (!isBlank(iframe)) {
      tracker.handleLoad();
    }
  };
  iframe.addEventListener('load', onLoad);
  options.mount.appendChild(iframe);

  let reportedVisible = false;
  const reportVisible = (): void => {
    if (!reportedVisible) {
      reportedVisible = true;
      options.onVisible();
    }
  };

  const observe = options.observerFactory ?? defaultObserverFactory();
  let observer: ObserverHandle | undefined;
  if (observe === undefined) {
    reportVisible();
  } else {
    observer = observe(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          reportVisible();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -20% 0px' },
    );
    observer.observe(options.mount);
  }

  return {
    iframe,
    destroy(): void {
      observer?.disconnect();
      iframe.removeEventListener('load', onLoad);
    },
  };
}
