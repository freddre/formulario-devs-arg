/**
 * Thin wrapper over Google Analytics 4 (`gtag`). Nothing here throws:
 * if gtag is missing (ad blocker, dev build) the call is a no-op.
 */

/** Custom events sent by this site. `page_view` is sent automatically by gtag. */
export const ANALYTICS_EVENTS = {
  /** The form entered the viewport (first time per page load). */
  formVisible: 'form_visible',
  /** A visitor submitted the form (key event in GA4). */
  gameSubmitted: 'game_submitted',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Parameters accepted by an event: flat key/value pairs, as gtag expects. */
export type EventParams = Readonly<Record<string, string | number | boolean>>;

/** Subset of `window` used by this module (injectable in tests). */
export interface GtagHost {
  gtag?: (command: 'event', eventName: string, params?: EventParams) => void;
}

/**
 * Sends a GA4 event.
 * @returns true when the event was handed to gtag, false when gtag is unavailable or threw.
 */
export function track(
  eventName: AnalyticsEventName,
  params: EventParams = {},
  host: GtagHost = window as unknown as GtagHost,
): boolean {
  if (typeof host.gtag !== 'function') {
    return false;
  }
  try {
    host.gtag('event', eventName, params);
    return true;
  } catch {
    return false;
  }
}
