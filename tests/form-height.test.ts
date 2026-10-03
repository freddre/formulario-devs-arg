import { describe, expect, it } from 'vitest';
import { FRAME_HEIGHT_SUBMIT, FRAME_HEIGHT_VIEW } from '../src/app';

interface Sample {
  readonly viewport: number;
  readonly content: number;
}

/**
 * Content height (px) of the embedded Google Form, 10 questions, with a validation error showing.
 * Measured in Chrome on 2026-10-03, by viewport width (px).
 * To re-measure: load the live page at each width, click "Enviar" on the empty form, force the iframe to
 * 100 px tall and read `document.scrollingElement.scrollHeight` inside it. With a taller frame that value is
 * just the frame height, so it must be read while the frame is short.
 * Update this table and FRAME_HEIGHT_VIEW together.
 */
const MEASURED_VIEW: ReadonlyArray<Sample> = [
  { viewport: 320, content: 3006 },
  { viewport: 340, content: 2898 },
  { viewport: 360, content: 2815 },
  { viewport: 375, content: 2775 },
  { viewport: 390, content: 2751 },
  { viewport: 414, content: 2671 },
  { viewport: 450, content: 2592 },
  { viewport: 500, content: 2528 },
  { viewport: 550, content: 2428 },
  { viewport: 600, content: 2408 },
  { viewport: 640, content: 2344 },
  { viewport: 700, content: 2334 },
  { viewport: 768, content: 2314 },
  { viewport: 1024, content: 2314 },
  { viewport: 1280, content: 2314 },
];

/**
 * Content height (px) of the confirmation page ("Enviar otra respuesta"), measured the same way on an 8 px
 * width grid on 2026-10-03. It only changes at the widths where the texts wrap, so each entry is the first and
 * the last width of a step (plus a few wide screens).
 */
const MEASURED_SUBMIT: ReadonlyArray<Sample> = [
  { viewport: 320, content: 489 },
  { viewport: 352, content: 489 },
  { viewport: 360, content: 429 },
  { viewport: 408, content: 429 },
  { viewport: 416, content: 389 },
  { viewport: 440, content: 389 },
  { viewport: 448, content: 369 },
  { viewport: 576, content: 369 },
  { viewport: 584, content: 349 },
  { viewport: 616, content: 349 },
  { viewport: 624, content: 309 },
  { viewport: 800, content: 309 },
  { viewport: 1280, content: 309 },
];

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

/**
 * Height (px) given by mobile-first utilities such as `h-[539px] min-[360px]:h-[479px]` at a viewport width:
 * the one with the largest min-width that still applies.
 */
function evaluateSteps(utilities: string, viewportWidth: number): number {
  let height: number | undefined;
  let appliedFrom = -1;
  for (const token of utilities.split(' ')) {
    const match = /^(?:min-\[(\d+)px\]:)?h-\[(\d+)px\]$/.exec(token);
    const value = match?.[2];
    if (match === null || value === undefined) {
      throw new Error(`Not a stepped height utility: ${token}`);
    }
    const minWidth = match[1] === undefined ? 0 : Number(match[1]);
    if (minWidth <= viewportWidth && minWidth > appliedFrom) {
      appliedFrom = minWidth;
      height = Number(value);
    }
  }
  if (height === undefined) {
    throw new Error(`No height applies at ${viewportWidth}px`);
  }
  return height;
}

describe('FRAME_HEIGHT_VIEW', () => {
  /** Smallest spare room (px) the frame must keep below the measured content. */
  const MIN_SPARE = 100;
  /** More blank space than this under the form would look broken. */
  const MAX_SPARE = 280;

  it('is a Tailwind arbitrary height built from max(), calc() and 100vw only', () => {
    expect(FRAME_HEIGHT_VIEW).toMatch(/^h-\[max\(.+\)\]$/);
    expect(FRAME_HEIGHT_VIEW).not.toContain(' ');
  });

  it.each(MEASURED_VIEW)(
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

describe('FRAME_HEIGHT_SUBMIT', () => {
  /** Google's texts change with the visitor's language, so keep a little room under the content. */
  const MIN_SPARE = 40;
  const MAX_SPARE = 60;

  it('is a base height followed by mobile-first min-width steps', () => {
    const tokens = FRAME_HEIGHT_SUBMIT.split(' ');
    expect(tokens[0]).toMatch(/^h-\[\d+px\]$/);
    for (const token of tokens) {
      expect(token).toMatch(/^(?:min-\[\d+px\]:)?h-\[\d+px\]$/);
    }
  });

  it.each(MEASURED_SUBMIT)(
    'fits the confirmation page with $viewport px of viewport ($content px of content)',
    ({ viewport, content }) => {
      const height = evaluateSteps(FRAME_HEIGHT_SUBMIT, viewport);
      expect(height - content).toBeGreaterThanOrEqual(MIN_SPARE);
      expect(height - content).toBeLessThanOrEqual(MAX_SPARE);
    },
  );

  it('keeps the taller height in the unmeasured gap just before each step', () => {
    // [first width measured with the shorter content, content of the step before it]
    const steps: ReadonlyArray<readonly [number, number]> = [
      [360, 489],
      [416, 429],
      [448, 389],
      [584, 369],
      [624, 349],
    ];
    for (const [width, previousContent] of steps) {
      expect(evaluateSteps(FRAME_HEIGHT_SUBMIT, width - 1) - previousContent).toBeGreaterThanOrEqual(MIN_SPARE);
    }
  });

  it('never shrinks as the screen gets narrower', () => {
    let previous = 0;
    for (let viewport = 1920; viewport >= 280; viewport -= 8) {
      const height = evaluateSteps(FRAME_HEIGHT_SUBMIT, viewport);
      expect(height).toBeGreaterThanOrEqual(previous);
      previous = height;
    }
  });
});
