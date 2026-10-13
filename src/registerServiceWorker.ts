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
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}
