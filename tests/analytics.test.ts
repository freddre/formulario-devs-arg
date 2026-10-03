import { describe, expect, it, vi } from 'vitest';
import { ANALYTICS_EVENTS, track, type GtagHost } from '../src/analytics';

describe('ANALYTICS_EVENTS', () => {
  it('uses the event names configured in GA4', () => {
    expect(ANALYTICS_EVENTS.formVisible).toBe('form_visible');
    expect(ANALYTICS_EVENTS.gameSubmitted).toBe('game_submitted');
  });
});

describe('track', () => {
  it('returns false and does nothing when gtag is missing', () => {
    expect(track(ANALYTICS_EVENTS.formVisible, {}, {})).toBe(false);
  });

  it('returns false when gtag is not a function', () => {
    const host = { gtag: 'nope' } as unknown as GtagHost;
    expect(track(ANALYTICS_EVENTS.formVisible, {}, host)).toBe(false);
  });

  it('calls gtag("event", name, params) and returns true', () => {
    const gtag = vi.fn();
    expect(track(ANALYTICS_EVENTS.gameSubmitted, { submission_number: 2 }, { gtag })).toBe(true);
    expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'game_submitted', { submission_number: 2 });
  });

  it('defaults params to an empty object', () => {
    const gtag = vi.fn();
    track(ANALYTICS_EVENTS.formVisible, undefined, { gtag });
    expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'form_visible', {});
  });

  it('swallows errors thrown by gtag', () => {
    const gtag = vi.fn(() => {
      throw new Error('blocked');
    });
    expect(track(ANALYTICS_EVENTS.formVisible, {}, { gtag })).toBe(false);
  });

  it('uses window.gtag by default', () => {
    const gtag = vi.fn();
    Object.assign(window, { gtag });
    try {
      expect(track(ANALYTICS_EVENTS.formVisible)).toBe(true);
      expect(gtag).toHaveBeenCalledOnce();
    } finally {
      Reflect.deleteProperty(window, 'gtag');
    }
  });
});
