import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pwaManifest, createPwaManifest } from '../src/pwaConfig';
import { registerServiceWorker } from '../src/registerServiceWorker';

describe('PWA Manifest configuration', () => {
  it('has required PWA manifest fields', () => {
    expect(pwaManifest.name).toBe('Mobilius');
    expect(pwaManifest.short_name).toBe('Mobilius');
    expect(pwaManifest.id).toBe('/');
    expect(pwaManifest.start_url).toBe('/');
    expect(pwaManifest.scope).toBe('/');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.icons.length).toBeGreaterThan(0);
    expect(pwaManifest.icons[0]?.src).toBe('/icons/icon-192.png');
  });

  it('generates unique id, scope, start_url, and icon paths for GitHub Pages subpath isolation', () => {
    const ghManifest = createPwaManifest('/mobilius/');

    // Crucial for allowing multiple PWAs on the same domain (e.g. *.github.io):
    expect(ghManifest.id).toBe('/mobilius/');
    expect(ghManifest.scope).toBe('/mobilius/');
    expect(ghManifest.start_url).toBe('/mobilius/');

    // Icons must be served from the subpath without double slashes
    for (const icon of ghManifest.icons) {
      expect(icon.src.startsWith('/mobilius/')).toBe(true);
      expect(icon.src).not.toContain('//');
    }

    // Different subpaths on same domain have independent IDs and scopes (no collision)
    const otherManifest = createPwaManifest('/other-app/');
    expect(otherManifest.id).not.toBe(ghManifest.id);
    expect(otherManifest.scope).not.toBe(ghManifest.scope);
    expect(otherManifest.start_url).not.toBe(ghManifest.start_url);
  });
});

describe('Service Worker registration', () => {
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
      writable: true,
    });
  });

  it('registers the service worker when supported', async () => {
    const mockRegistration = {} as ServiceWorkerRegistration;
    const registerMock = vi.fn().mockResolvedValue(mockRegistration);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: registerMock },
      configurable: true,
      writable: true,
    });

    const result = await registerServiceWorker();

    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(result).toBe(mockRegistration);
  });

  it('returns null and handles registration failure', async () => {
    const registerMock = vi.fn().mockRejectedValue(new Error('Registration failed'));
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: registerMock },
      configurable: true,
      writable: true,
    });

    const result = await registerServiceWorker();

    expect(result).toBeNull();
    expect(consoleErrorMock).toHaveBeenCalled();
  });
});
