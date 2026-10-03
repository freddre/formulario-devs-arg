import { describe, expect, it, vi } from 'vitest';
import { createFormTracker } from '../src/form-tracker';

describe('createFormTracker', () => {
  it('alternates view and submit starting with view', () => {
    const tracker = createFormTracker();
    const phases = [tracker.handleLoad(), tracker.handleLoad(), tracker.handleLoad(), tracker.handleLoad()];
    expect(phases).toEqual(['view', 'submit', 'view', 'submit']);
  });

  it('counts the loads it has seen', () => {
    const tracker = createFormTracker();
    expect(tracker.loads).toBe(0);
    tracker.handleLoad();
    tracker.handleLoad();
    tracker.handleLoad();
    expect(tracker.loads).toBe(3);
  });

  it('reports every load to the callback with the running count', () => {
    const onPhase = vi.fn();
    const tracker = createFormTracker(onPhase);
    tracker.handleLoad();
    tracker.handleLoad();
    expect(onPhase.mock.calls).toEqual([
      ['view', 1],
      ['submit', 2],
    ]);
  });

  it('keeps independent state per tracker', () => {
    const first = createFormTracker();
    const second = createFormTracker();
    first.handleLoad();
    expect(second.handleLoad()).toBe('view');
  });
});
