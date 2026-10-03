import { vi } from 'vitest';
import type { ObserverFactory, ObserverHandle } from '../src/form-embed';

export interface FakeObserver {
  readonly factory: ObserverFactory;
  readonly handle: ObserverHandle & { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  /** Simulates the browser reporting an intersection change. */
  fire(isIntersecting: boolean): void;
}

/** IntersectionObserver stand-in that records calls and lets the test trigger the callback. */
export function fakeObserver(): FakeObserver {
  let callback: Parameters<ObserverFactory>[0] | undefined;
  const handle = { observe: vi.fn(), disconnect: vi.fn() };
  const factory: ObserverFactory = (cb) => {
    callback = cb;
    return handle;
  };
  return {
    factory,
    handle,
    fire: (isIntersecting) => callback?.([{ isIntersecting }]),
  };
}

/** Dispatches the `load` event of an iframe, as the browser does after each navigation. */
export function loadEvent(iframe: HTMLIFrameElement): void {
  iframe.dispatchEvent(new Event('load'));
}
