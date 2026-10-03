import { describe, expect, it } from 'vitest';
import { FRAME_HEIGHT_VIEW } from '../src/app';

/**
 * Content height (px) of the embedded Google Form, 11 questions, with validation errors showing.
 * Measured in Chrome on 2026-10-03 as the iframe's `scrollHeight`, by viewport width (px).
 * To re-measure: load the live page at each width, click "Enviar" on the empty form and read
 * `document.scrollingElement.scrollHeight` inside the iframe. Update this table and FRAME_HEIGHT_VIEW together.
 */
const MEASURED: ReadonlyArray<{ readonly viewport: number; readonly content: number }> = [
  { viewport: 320, content: 3189 },
  { viewport: 360, content: 2998 },
  { viewport: 390, content: 2914 },
  { viewport: 414, content: 2834 },
  { viewport: 600, content: 2571 },
  { viewport: 640, content: 2527 },
  { viewport: 700, content: 2497 },
  { viewport: 768, content: 2477 },
  { viewport: 1024, content: 2477 },
  { viewport: 1280, content: 2477 },
];

/** Smallest spare room (px) the frame must keep below the measured content. */
const MIN_SPARE = 100;
/** More blank space than this under the form would look broken. */
const MAX_SPARE = 280;

/** Evaluates a Tailwind `h-[...]` utility made of max()/calc()/100vw for a viewport width. */
function evaluateHeight(utility: string, viewportWidth: number): number {
  const match = /^h-\[(.+)\]$/.exec(utility);
  const expression = match?.[1];
  if (expression === undefined) {
    throw new Error(`Not an arbitrary height utility: ${utility}`);
  }
  const js = expression
    .replaceAll('_', ' ')
    .replaceAll('100vw', String(viewportWidth))
    .replaceAll('px', '')
    .replaceAll('calc(', '(')
    .replaceAll('max(', 'Math.max(');
  const value: unknown = new Function(`"use strict"; return (${js});`)();
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Could not evaluate ${utility} at ${viewportWidth}px`);
  }
  return value;
}

describe('FRAME_HEIGHT_VIEW', () => {
  it('is a Tailwind arbitrary height built from max(), calc() and 100vw only', () => {
    expect(FRAME_HEIGHT_VIEW).toMatch(/^h-\[max\(.+\)\]$/);
    expect(FRAME_HEIGHT_VIEW).not.toContain(' ');
  });

  it.each(MEASURED)(
    'fits the form with $viewport px of viewport and leaves a reasonable margin ($content px of content)',
    ({ viewport, content }) => {
      const height = evaluateHeight(FRAME_HEIGHT_VIEW, viewport);
      expect(height - content).toBeGreaterThanOrEqual(MIN_SPARE);
      expect(height - content).toBeLessThanOrEqual(MAX_SPARE);
    },
  );

  it('never shrinks as the screen gets narrower', () => {
    let previous = 0;
    for (let viewport = 1920; viewport >= 280; viewport -= 8) {
      const height = evaluateHeight(FRAME_HEIGHT_VIEW, viewport);
      expect(height).toBeGreaterThanOrEqual(previous);
      previous = height;
    }
  });

  it('stays at the wide-screen floor on large monitors and grows on very small phones', () => {
    const floor = evaluateHeight(FRAME_HEIGHT_VIEW, 1280);
    expect(evaluateHeight(FRAME_HEIGHT_VIEW, 2560)).toBe(floor);
    expect(evaluateHeight(FRAME_HEIGHT_VIEW, 280)).toBeGreaterThan(evaluateHeight(FRAME_HEIGHT_VIEW, 320));
  });
});
