/**
 * Register the application service worker.
 * The service worker enables offline usage after the first load.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const baseUrl = import.meta.env?.BASE_URL || '/';
    const swUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}sw.js`.replace(/\/{2,}/g, '/');
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: baseUrl,
    });

    // Check for updates immediately upon page load
    if (typeof registration.update === 'function') {
      void registration.update();
    }

    // Listen for new service worker taking control and auto-reload to apply new code immediately
    if (typeof navigator.serviceWorker?.addEventListener === 'function') {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Force purge all service worker caches and reload the application.
 * Allows mobile users to immediately get the newest version with 1 tap.
 */
export async function forcePurgeCacheAndReload(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
  } catch (e) {
    console.error('Failed to purge caches:', e);
  } finally {
    window.location.reload();
  }
}

