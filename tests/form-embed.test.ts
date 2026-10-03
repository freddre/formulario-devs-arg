import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBlankFrame, mountFormEmbed, type ObserverFactory } from '../src/form-embed';
import { fakeObserver, loadEvent } from './helpers';

const VIEW_URL = 'https://docs.google.com/forms/d/e/abc123/viewform';

describe('mountFormEmbed', () => {
  let mount: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    mount = document.createElement('div');
    document.body.append(mount);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mountWith(overrides: Partial<Parameters<typeof mountFormEmbed>[0]> = {}) {
    const onVisible = vi.fn();
    const onPhase = vi.fn();
    const observer = fakeObserver();
    const handle = mountFormEmbed({
      mount,
      viewUrl: VIEW_URL,
      title: 'Formulario de prueba',
      className: 'h-10 w-full',
      onVisible,
      onPhase,
      isBlank: () => false,
      observerFactory: observer.factory,
      ...overrides,
    });
    return { handle, onVisible, onPhase, observer };
  }

  it('creates the iframe inside the mount with title, classes, lazy loading and the embed URL', () => {
    const { handle } = mountWith();
    expect(mount.contains(handle.iframe)).toBe(true);
    expect(handle.iframe.title).toBe('Formulario de prueba');
    expect(handle.iframe.className).toBe('h-10 w-full');
    expect(handle.iframe.getAttribute('loading')).toBe('lazy');
    expect(handle.iframe.getAttribute('src')).toBe(`${VIEW_URL}?embedded=true`);
  });

  it('sets src before the iframe is inserted into the document', () => {
    let srcAtInsertion: string | null = null;
    const insert = mount.appendChild.bind(mount);
    vi.spyOn(mount, 'appendChild').mockImplementation(((node: Node) => {
      srcAtInsertion = (node as HTMLIFrameElement).getAttribute('src');
      return insert(node);
    }) as typeof mount.appendChild);

    mountWith();
    expect(srcAtInsertion).toBe(`${VIEW_URL}?embedded=true`);
  });

  it('reports each real load with its phase, the load count and the iframe', () => {
    const { handle, onPhase } = mountWith();
    loadEvent(handle.iframe);
    loadEvent(handle.iframe);
    loadEvent(handle.iframe);
    expect(onPhase.mock.calls).toEqual([
      ['view', 1, handle.iframe],
      ['submit', 2, handle.iframe],
      ['view', 3, handle.iframe],
    ]);
  });

  it('ignores loads of the blank document', () => {
    let blank = true;
    const { handle, onPhase } = mountWith({ isBlank: () => blank });
    loadEvent(handle.iframe);
    expect(onPhase).not.toHaveBeenCalled();
    blank = false;
    loadEvent(handle.iframe);
    expect(onPhase).toHaveBeenCalledExactlyOnceWith('view', 1, handle.iframe);
  });

  it('observes the mount with a bottom margin and reports visibility once', () => {
    const { onVisible, observer } = mountWith();
    expect(observer.handle.observe).toHaveBeenCalledExactlyOnceWith(mount);

    observer.fire(false);
    expect(onVisible).not.toHaveBeenCalled();

    observer.fire(true);
    observer.fire(true);
    expect(onVisible).toHaveBeenCalledOnce();
    expect(observer.handle.disconnect).toHaveBeenCalled();
  });

  it('passes the observer options (threshold 0, 20% bottom margin)', () => {
    const factory = vi.fn<ObserverFactory>(() => ({ observe: vi.fn(), disconnect: vi.fn() }));
    mountWith({ observerFactory: factory });
    expect(factory.mock.calls[0]?.[1]).toEqual({ threshold: 0, rootMargin: '0px 0px -20% 0px' });
  });

  it('reports visibility immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onVisible = vi.fn();
    mountFormEmbed({
      mount,
      viewUrl: VIEW_URL,
      title: 't',
      className: 'c',
      onVisible,
      onPhase: vi.fn(),
      isBlank: () => false,
    });
    expect(onVisible).toHaveBeenCalledOnce();
  });

  it('uses the global IntersectionObserver when available', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let capturedInit: IntersectionObserverInit | undefined;
    let capturedCallback: IntersectionObserverCallback | undefined;
    class FakeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, init?: IntersectionObserverInit) {
        capturedCallback = callback;
        capturedInit = init;
      }
      observe = observe;
      disconnect = disconnect;
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const onVisible = vi.fn();
    mountFormEmbed({
      mount,
      viewUrl: VIEW_URL,
      title: 't',
      className: 'c',
      onVisible,
      onPhase: vi.fn(),
      isBlank: () => false,
    });
    expect(observe).toHaveBeenCalledExactlyOnceWith(mount);
    expect(capturedInit).toEqual({ threshold: 0, rootMargin: '0px 0px -20% 0px' });
    capturedCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(onVisible).toHaveBeenCalledOnce();
  });

  it('destroy() disconnects the observer and stops reporting loads', () => {
    const { handle, onPhase, observer } = mountWith();
    handle.destroy();
    expect(observer.handle.disconnect).toHaveBeenCalled();
    loadEvent(handle.iframe);
    expect(onPhase).not.toHaveBeenCalled();
    expect(mount.contains(handle.iframe)).toBe(true);
  });

  it('uses isBlankFrame by default and counts a cross-origin document as a real load', () => {
    const onPhase = vi.fn();
    const handle = mountFormEmbed({
      mount,
      viewUrl: VIEW_URL,
      title: 't',
      className: 'c',
      onVisible: vi.fn(),
      onPhase,
      observerFactory: fakeObserver().factory,
    });
    Object.defineProperty(handle.iframe, 'contentWindow', {
      get: () => ({
        get location(): Location {
          throw new DOMException('Blocked a frame', 'SecurityError');
        },
      }),
    });
    loadEvent(handle.iframe);
    expect(onPhase).toHaveBeenCalledExactlyOnceWith('view', 1, handle.iframe);
  });
});

describe('isBlankFrame', () => {
  function frameWithHref(href: string): HTMLIFrameElement {
    return { contentWindow: { location: { href } } } as unknown as HTMLIFrameElement;
  }

  it('is true for about:blank', () => {
    expect(isBlankFrame(frameWithHref('about:blank'))).toBe(true);
  });

  it('is false for a real same-origin document', () => {
    expect(isBlankFrame(frameWithHref('https://example.com/'))).toBe(false);
  });

  it('is false when there is no window yet', () => {
    expect(isBlankFrame({ contentWindow: null } as unknown as HTMLIFrameElement)).toBe(false);
  });

  it('is false when reading the location throws (cross-origin document)', () => {
    const frame = {
      get contentWindow(): never {
        throw new DOMException('Blocked a frame', 'SecurityError');
      },
    } as unknown as HTMLIFrameElement;
    expect(isBlankFrame(frame)).toBe(false);
  });
});
