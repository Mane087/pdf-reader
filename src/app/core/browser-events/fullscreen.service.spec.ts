import { TestBed } from '@angular/core/testing';

import { FullscreenService, isFullscreenSupported } from './fullscreen.service';

/**
 * jsdom implements none of the fullscreen API, so every member used by the
 * service is defined here and restored after each spec.
 */
describe('FullscreenService', () => {
  const overriddenKeys = ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen'] as const;
  let originalDescriptors: Partial<Record<string, PropertyDescriptor | undefined>>;
  let requestFullscreen: jest.Mock<Promise<void>, []>;
  let exitFullscreen: jest.Mock<Promise<void>, []>;

  function defineOnDocument(key: string, value: unknown): void {
    Object.defineProperty(document, key, { value, configurable: true });
  }

  function setFullscreenElement(element: Element | null): void {
    defineOnDocument('fullscreenElement', element);
  }

  function setUpFullscreenApi({ isSupported = true } = {}): void {
    requestFullscreen = jest.fn<Promise<void>, []>(() => Promise.resolve());
    exitFullscreen = jest.fn<Promise<void>, []>(() => Promise.resolve());
    defineOnDocument('fullscreenEnabled', isSupported);
    setFullscreenElement(null);
    defineOnDocument('exitFullscreen', exitFullscreen);
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: isSupported ? requestFullscreen : undefined,
      configurable: true,
    });
  }

  beforeEach(() => {
    originalDescriptors = Object.fromEntries(
      overriddenKeys.map((key) => [key, Object.getOwnPropertyDescriptor(document, key)]),
    );
    setUpFullscreenApi();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    for (const key of overriddenKeys) {
      const descriptor = originalDescriptors[key];
      if (descriptor) {
        Object.defineProperty(document, key, descriptor);
      } else {
        delete (document as unknown as Record<string, unknown>)[key];
      }
    }
    delete (document.documentElement as unknown as Record<string, unknown>)['requestFullscreen'];
  });

  it('reports support when the browser exposes the API', () => {
    expect(isFullscreenSupported()).toBe(true);
    expect(TestBed.inject(FullscreenService).canUseFullscreen).toBe(true);
  });

  it('reports no support when the document cannot go fullscreen', () => {
    setUpFullscreenApi({ isSupported: false });

    expect(isFullscreenSupported()).toBe(false);
    expect(TestBed.inject(FullscreenService).canUseFullscreen).toBe(false);
  });

  it('starts out of fullscreen', () => {
    expect(TestBed.inject(FullscreenService).isFullscreen()).toBe(false);
  });

  it('requests fullscreen on the document element', async () => {
    await TestBed.inject(FullscreenService).toggle();

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('exits fullscreen when the document already is fullscreen', async () => {
    setFullscreenElement(document.documentElement);

    await TestBed.inject(FullscreenService).toggle();

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('does nothing when the API is unavailable', async () => {
    setUpFullscreenApi({ isSupported: false });

    await TestBed.inject(FullscreenService).toggle();

    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('keeps the previous state when the browser rejects the request', async () => {
    const service = TestBed.inject(FullscreenService);
    requestFullscreen.mockRejectedValueOnce(new Error('user gesture required'));

    await expect(service.toggle()).resolves.toBeUndefined();
    expect(service.isFullscreen()).toBe(false);
  });

  it('tracks the state reported by the fullscreenchange event', () => {
    const service = TestBed.inject(FullscreenService);
    TestBed.tick();

    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));
    TestBed.tick();
    expect(service.isFullscreen()).toBe(true);

    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    TestBed.tick();
    expect(service.isFullscreen()).toBe(false);
  });
});
